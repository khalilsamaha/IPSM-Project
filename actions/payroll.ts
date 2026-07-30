"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { dollarsToCents } from "@/lib/records/format";
import { calculateCompensationAmountCents, calculateGrossPayrollCents, minutesBetween } from "@/lib/payroll/calculations";
import { Prisma } from "@prisma/client";
import { defaultPayableLessonPolicy, isPayableLesson, payrollItemTypeFor } from "@/lib/payroll/policy";
import { payrollMonthBounds, isCompletePayrollMonth } from "@/lib/payroll/month";
import { finalizeElapsedScheduledLessons } from "@/lib/attendance/auto-finalize";

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
  const admin = await requirePayrollAdmin();
  const teacherId = id.parse(formData.get("teacherId"));
  const payrollMonthValue = String(formData.get("payrollMonth") ?? "");
  const { payrollMonth, periodStart, periodEnd } = payrollMonthBounds(payrollMonthValue);
  if (!isCompletePayrollMonth(payrollMonthValue)) throw new Error("Payroll can only be generated after the calendar month has ended.");
  if (formData.has("periodStart") || formData.has("periodEnd")) throw new Error("Arbitrary payroll periods are not accepted.");
  await finalizeElapsedScheduledLessons({ teacherId, dateFrom: periodStart, dateTo: periodEnd, source: "payroll_generation", actorId: admin.session.userId });
  const adjustmentCents = dollarsToCents(String(formData.get("adjustment") ?? "0"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const includeIds = new Set(formData.getAll("sessionIds").map(String));
  const missedApprovedIds = new Set(formData.getAll("missedApprovedSessionIds").map(String));

  const payroll = await prisma.$transaction(async (tx) => {
    // Updating the teacher timestamp takes a row lock, serializing payroll generation per teacher.
    const teacher = await tx.teacher.update({ where: { id: teacherId }, data: { updatedAt: new Date() } });
    const overlap = await tx.teacherPayroll.findFirst({ where: { teacherId, status: { in: ["DRAFT", "APPROVED", "PAID"] }, periodStart: { lte: periodEnd }, periodEnd: { gte: periodStart } }, orderBy: { periodStart: "asc" } });
    if (overlap) throw new Error(`This period overlaps an existing payroll for this teacher: ${overlap.periodStart.toLocaleDateString("en-GB")}–${overlap.periodEnd.toLocaleDateString("en-GB")}.`);
    const scheduled = await tx.scheduleSession.count({ where: { teacherId, sessionDate: { gte: periodStart, lte: periodEnd }, archivedAt: null, status: "SCHEDULED", payrollItems: { none: {} } } });
    if (scheduled) throw new Error(`${scheduled} lesson${scheduled === 1 ? "" : "s"} in this period ${scheduled === 1 ? "is" : "are"} still Scheduled. Finalize attendance before generating payroll.`);
    const sessions = await tx.scheduleSession.findMany({ where: { id: { in: [...includeIds] }, teacherId, sessionDate: { gte: periodStart, lte: periodEnd }, archivedAt: null, payrollItems: { none: {} } }, orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }] });
    const settings = await tx.operationalSettings.upsert({ where: { id: "school-default" }, create: { id: "school-default" }, update: {} });
    const policy = { ...defaultPayableLessonPolicy, payMissedLessons: settings.allowPayableMissedLessons, approvedMissedSessionIds: missedApprovedIds };
    const basis = teacher.compensationBasis;
    const rateCents = basis === "SESSION_UNIT" ? teacher.sessionRateCents ?? 0 : teacher.hourlyRateCents;
    const unitMinutes = basis === "SESSION_UNIT" ? teacher.sessionUnitMinutes : 60;
    const items = sessions.filter(s => isPayableLesson(s.status, s.id, policy)).map(session => { const minutes = minutesBetween(session.startTime, session.endTime); return { session, minutes, amountCents: calculateCompensationAmountCents(minutes, rateCents, basis, unitMinutes) }; });
    const completedMinutes = items.filter(i=>i.session.status==="COMPLETED").reduce((s,i)=>s+i.minutes,0); const missedPayableMinutes = items.filter(i=>i.session.status==="MISSED").reduce((s,i)=>s+i.minutes,0);
    const created = await tx.teacherPayroll.create({ data: { teacherId, periodStart, periodEnd, payrollMonth, hourlyRateSnapshotCents: teacher.hourlyRateCents, compensationBasisSnapshot:basis, rateUnitMinutesSnapshot:unitMinutes, completedMinutes, missedPayableMinutes, adjustmentCents, grossAmountCents: calculateGrossPayrollCents(items, adjustmentCents), notes, items: { create: items.map(i=>({ scheduleSessionId:i.session.id, sessionDate:i.session.sessionDate, startTime:i.session.startTime, endTime:i.session.endTime, minutes:i.minutes, rateSnapshotCents:rateCents, compensationBasisSnapshot:basis, rateUnitMinutesSnapshot:unitMinutes, amountCents:i.amountCents, itemType:payrollItemTypeFor(i.session.status), notes:i.session.notes })) } } });
    await tx.auditLog.create({ data: { action: "payroll_month_generated", entity: "TeacherPayroll", entityId: created.id, createdById: admin.userId, actorId: admin.session.userId, metadata: { month: payrollMonthValue, itemCount: items.length, adjustmentCents, grossAmountCents: calculateGrossPayrollCents(items, adjustmentCents), scheduledLessons: scheduled } } });
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
