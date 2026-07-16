"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { dollarsToCents } from "@/lib/records/format";
import { calculateGrossPayrollCents, calculatePayrollItemAmountCents, minutesBetween } from "@/lib/payroll/calculations";
import { defaultPayableLessonPolicy, isPayableLesson, payrollItemTypeFor } from "@/lib/payroll/policy";

const id = z.string().uuid();

async function requirePayrollAdmin() {
  const session = await requireSession();
  if (!isAdminOrHigher(session.role)) throw new Error("Not authorized");
  const user = await prisma.userProfile.findUnique({ where: { authId: session.userId }, select: { id: true } });
  return { session, userId: user?.id ?? null };
}

async function audit(action: string, entityId: string, metadata?: unknown) {
  const { session, userId } = await requirePayrollAdmin();
  await prisma.auditLog.create({ data: { action, entity: "TeacherPayroll", entityId, createdById: userId, actorId: session.userId, metadata: metadata as object } });
}

export async function generateTeacherPayroll(formData: FormData) {
  await requirePayrollAdmin();
  const teacherId = id.parse(formData.get("teacherId"));
  const periodStart = new Date(String(formData.get("periodStart")));
  const periodEnd = new Date(String(formData.get("periodEnd")));
  const adjustmentCents = dollarsToCents(String(formData.get("adjustment") ?? "0"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const includeIds = new Set(formData.getAll("sessionIds").map(String));
  const missedApprovedIds = new Set(formData.getAll("missedApprovedSessionIds").map(String));

  const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
  if (!teacher) throw new Error("Teacher not found");

  const sessions = await prisma.scheduleSession.findMany({
    where: { id: { in: Array.from(includeIds) }, teacherId, sessionDate: { gte: periodStart, lte: periodEnd }, archivedAt: null, payrollItems: { none: {} } },
    orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
  });
  const policy = { ...defaultPayableLessonPolicy, approvedMissedSessionIds: missedApprovedIds };
  const items = sessions.filter((session) => isPayableLesson(session.status, session.id, policy)).map((session) => {
    const minutes = minutesBetween(session.startTime, session.endTime);
    return { session, minutes, amountCents: calculatePayrollItemAmountCents(minutes, teacher.hourlyRateCents) };
  });
  const completedMinutes = items.filter((item) => item.session.status === "COMPLETED").reduce((sum, item) => sum + item.minutes, 0);
  const missedPayableMinutes = items.filter((item) => item.session.status === "MISSED").reduce((sum, item) => sum + item.minutes, 0);
  const grossAmountCents = calculateGrossPayrollCents(items, adjustmentCents);

  const payroll = await prisma.teacherPayroll.create({
    data: {
      teacherId, periodStart, periodEnd, hourlyRateSnapshotCents: teacher.hourlyRateCents, completedMinutes, missedPayableMinutes, adjustmentCents, grossAmountCents, notes,
      items: { create: items.map((item) => ({ scheduleSessionId: item.session.id, sessionDate: item.session.sessionDate, startTime: item.session.startTime, endTime: item.session.endTime, minutes: item.minutes, rateSnapshotCents: teacher.hourlyRateCents, amountCents: item.amountCents, itemType: payrollItemTypeFor(item.session.status), notes: item.session.notes })) },
    },
  });
  await audit("create_draft", payroll.id, { itemCount: items.length, adjustmentCents });
  revalidatePath("/payroll");
  redirect(`/payroll/${payroll.id}`);
}

export async function approveTeacherPayroll(formData: FormData) {
  const { userId } = await requirePayrollAdmin();
  const payrollId = id.parse(formData.get("id"));
  const row = await prisma.teacherPayroll.findUnique({ where: { id: payrollId } });
  if (!row || row.status !== "DRAFT") throw new Error("Only draft payroll can be approved.");
  await prisma.teacherPayroll.update({ where: { id: payrollId }, data: { status: "APPROVED", approvedById: userId, approvedAt: new Date() } });
  await audit("approve", payrollId);
  revalidatePath(`/payroll/${payrollId}`);
}

export async function markTeacherPayrollPaid(formData: FormData) {
  await requirePayrollAdmin();
  const payrollId = id.parse(formData.get("id"));
  const row = await prisma.teacherPayroll.findUnique({ where: { id: payrollId } });
  if (!row || row.status !== "APPROVED") throw new Error("Only approved payroll can be marked paid.");
  await prisma.teacherPayroll.update({ where: { id: payrollId }, data: { status: "PAID", paidAt: new Date() } });
  await audit("mark_paid", payrollId);
  revalidatePath(`/payroll/${payrollId}`);
}

export async function cancelTeacherPayroll(formData: FormData) {
  await requirePayrollAdmin();
  const payrollId = id.parse(formData.get("id"));
  const row = await prisma.teacherPayroll.findUnique({ where: { id: payrollId } });
  if (!row || row.status === "PAID") throw new Error("Paid payroll cannot be cancelled.");
  await prisma.teacherPayroll.update({ where: { id: payrollId }, data: { status: "CANCELLED" } });
  await audit("cancel", payrollId, { previousStatus: row.status });
  revalidatePath(`/payroll/${payrollId}`);
}
