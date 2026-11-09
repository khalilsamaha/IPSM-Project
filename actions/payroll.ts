"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { dollarsToCents } from "@/lib/records/format";
import {
  calculateCompensationAmountCents,
  calculateGrossPayrollCents,
  minutesBetween,
  resolveCompensation,
} from "@/lib/payroll/calculations";
import { buildPayableLessonPolicy, isPayableLesson, payrollItemTypeFor } from "@/lib/payroll/policy";
import { payrollMonthBounds, isCompletePayrollMonth } from "@/lib/payroll/month";
import { finalizeElapsedScheduledLessons } from "@/lib/attendance/auto-finalize";
import { requireCurrentOpenShift } from "@/lib/shifts/service";
import { logServerError } from "@/lib/server-log";

const id = z.string().uuid();
const payrollPaymentMethod = z.enum(["cash", "whish"]);

async function requirePayrollAdmin() {
  const session = await requireSession();
  if (!isAdminOrHigher(session.role)) throw new Error("You are not authorized to manage payroll.");
  const user = await prisma.userProfile.findUnique({
    where: { authId: session.userId },
    select: { id: true },
  });
  if (!user) throw new Error("Your user profile could not be found.");
  return { session, userId: user.id };
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  return error instanceof Error ? error.message : fallback;
}

function newPayrollPath(teacherId: string, payrollMonth: string, message: string) {
  const query = new URLSearchParams({ teacherId, payrollMonth, error: message });
  return `/payroll/new?${query.toString()}`;
}

function payrollPath(payrollId: string, kind: "error" | "success", message: string) {
  return `/payroll/${payrollId}?${kind}=${encodeURIComponent(message)}`;
}

export async function generateTeacherPayroll(formData: FormData) {
  const teacherIdValue = String(formData.get("teacherId") ?? "");
  const payrollMonthValue = String(formData.get("payrollMonth") ?? "");
  let payrollId = "";

  try {
    const admin = await requirePayrollAdmin();
    const teacherId = id.parse(teacherIdValue);
    const { payrollMonth, periodStart, periodEnd } = payrollMonthBounds(payrollMonthValue);
    if (!isCompletePayrollMonth(payrollMonthValue)) {
      throw new Error("Payroll can only be generated after the calendar month has ended.");
    }
    if (formData.has("periodStart") || formData.has("periodEnd")) {
      throw new Error("Arbitrary payroll periods are not accepted.");
    }

    await finalizeElapsedScheduledLessons({
      teacherId,
      dateFrom: periodStart,
      dateTo: periodEnd,
      source: "payroll_generation",
      actorId: admin.session.userId,
    });

    const adjustmentCents = dollarsToCents(String(formData.get("adjustment") ?? "0"));
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const includeIds = new Set(formData.getAll("sessionIds").map(String));
    const missedApprovedIds = new Set(formData.getAll("missedApprovedSessionIds").map(String));

    const payroll = await prisma.$transaction(async (tx) => {
      const teacher = await tx.teacher.update({
        where: { id: teacherId },
        data: { updatedAt: new Date() },
      });
      const overlap = await tx.teacherPayroll.findFirst({
        where: {
          teacherId,
          status: { in: ["DRAFT", "APPROVED", "PAID"] },
          periodStart: { lte: periodEnd },
          periodEnd: { gte: periodStart },
        },
        orderBy: { periodStart: "asc" },
      });
      if (overlap) {
        throw new Error(
          `This period overlaps an existing payroll for this teacher: ${overlap.periodStart.toLocaleDateString("en-GB")}–${overlap.periodEnd.toLocaleDateString("en-GB")}.`,
        );
      }

      const scheduled = await tx.scheduleSession.count({
        where: {
          teacherId,
          sessionDate: { gte: periodStart, lte: periodEnd },
          archivedAt: null,
          status: "SCHEDULED",
          payrollItems: { none: {} },
        },
      });
      if (scheduled) {
        throw new Error(
          `${scheduled} lesson${scheduled === 1 ? "" : "s"} in this period ${scheduled === 1 ? "is" : "are"} still Scheduled. Finalize attendance before generating payroll.`,
        );
      }

      const sessions = await tx.scheduleSession.findMany({
        where: {
          id: { in: [...includeIds] },
          teacherId,
          sessionDate: { gte: periodStart, lte: periodEnd },
          archivedAt: null,
          payrollItems: { none: {} },
        },
        orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
      });
      if (!sessions.length) throw new Error("No payable completed lessons were selected for this payroll.");

      const settings = await tx.operationalSettings.upsert({
        where: { id: "school-default" },
        create: { id: "school-default" },
        update: {},
      });
      const policy = buildPayableLessonPolicy({
        allowPayableMissedLessons: settings.allowPayableMissedLessons,
        approvedMissedSessionIds: missedApprovedIds,
      });
      const compensation = resolveCompensation(teacher);
      const items = sessions
        .filter((session) => isPayableLesson(session.status, session.id, policy))
        .map((session) => {
          const minutes = minutesBetween(session.startTime, session.endTime);
          return {
            session,
            minutes,
            amountCents: calculateCompensationAmountCents(
              minutes,
              compensation.rateCents,
              compensation.basis,
              compensation.unitMinutes,
            ),
          };
        });
      if (!items.length) throw new Error("None of the selected lessons are payable under the current attendance policy.");

      const completedMinutes = items
        .filter((item) => item.session.status === "COMPLETED")
        .reduce((sum, item) => sum + item.minutes, 0);
      const missedPayableMinutes = items
        .filter((item) => item.session.status === "MISSED")
        .reduce((sum, item) => sum + item.minutes, 0);
      const grossAmountCents = calculateGrossPayrollCents(items, adjustmentCents);

      const created = await tx.teacherPayroll.create({
        data: {
          teacherId,
          periodStart,
          periodEnd,
          payrollMonth,
          // This legacy column is now populated with the effective rate, regardless of compensation basis.
          hourlyRateSnapshotCents: compensation.rateCents,
          compensationBasisSnapshot: compensation.basis,
          rateUnitMinutesSnapshot: compensation.unitMinutes,
          completedMinutes,
          missedPayableMinutes,
          adjustmentCents,
          grossAmountCents,
          notes,
          items: {
            create: items.map((item) => ({
              scheduleSessionId: item.session.id,
              sessionDate: item.session.sessionDate,
              startTime: item.session.startTime,
              endTime: item.session.endTime,
              minutes: item.minutes,
              rateSnapshotCents: compensation.rateCents,
              compensationBasisSnapshot: compensation.basis,
              rateUnitMinutesSnapshot: compensation.unitMinutes,
              amountCents: item.amountCents,
              itemType: payrollItemTypeFor(item.session.status),
              notes: item.session.notes,
            })),
          },
        },
      });
      await tx.auditLog.create({
        data: {
          action: "payroll_month_generated",
          entity: "TeacherPayroll",
          entityId: created.id,
          createdById: admin.userId,
          actorId: admin.session.userId,
          metadata: {
            month: payrollMonthValue,
            itemCount: items.length,
            adjustmentCents,
            grossAmountCents,
            compensationBasis: compensation.basis,
            rateCents: compensation.rateCents,
            rateUnitMinutes: compensation.unitMinutes,
          },
        },
      });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    payrollId = payroll.id;
  } catch (error) {
    logServerError("payroll.generate", error, { teacherId: teacherIdValue, payrollMonth: payrollMonthValue });
    redirect(newPayrollPath(
      teacherIdValue,
      payrollMonthValue,
      errorMessage(error, "Unable to generate payroll. Check the selected lessons and try again."),
    ));
  }

  revalidatePath("/payroll");
  redirect(`/payroll/${payrollId}?success=${encodeURIComponent("Draft payroll generated successfully.")}`);
}

export async function approveTeacherPayroll(formData: FormData) {
  const payrollId = String(formData.get("id") ?? "");
  try {
    const admin = await requirePayrollAdmin();
    const parsedId = id.parse(payrollId);
    const row = await prisma.teacherPayroll.findUnique({ where: { id: parsedId } });
    if (!row || row.status !== "DRAFT") throw new Error("Only a draft payroll can be approved.");
    await prisma.$transaction([
      prisma.teacherPayroll.update({
        where: { id: parsedId },
        data: { status: "APPROVED", approvedById: admin.userId, approvedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          action: "approve",
          entity: "TeacherPayroll",
          entityId: parsedId,
          createdById: admin.userId,
          actorId: admin.session.userId,
        },
      }),
    ]);
  } catch (error) {
    logServerError("payroll.approve", error, { payrollId });
    redirect(payrollPath(payrollId, "error", errorMessage(error, "Unable to approve payroll.")));
  }
  revalidatePath(`/payroll/${payrollId}`);
  redirect(payrollPath(payrollId, "success", "Payroll approved successfully."));
}

export async function markTeacherPayrollPaid(formData: FormData) {
  const payrollId = String(formData.get("id") ?? "");
  try {
    const admin = await requirePayrollAdmin();
    const parsedId = id.parse(payrollId);
    const paymentMethod = payrollPaymentMethod.parse(formData.get("paymentMethod"));
    const shift = await requireCurrentOpenShift(prisma, admin.userId);

    await prisma.$transaction(async (tx) => {
      const row = await tx.teacherPayroll.findUnique({
        where: { id: parsedId },
        include: { teacher: true },
      });
      if (!row || row.status !== "APPROVED") {
        throw new Error("Only an approved payroll can be marked paid.");
      }

      const currentShift = await tx.cashierShift.findUnique({ where: { id: shift.id } });
      if (!currentShift || !["OPEN", "REOPENED"].includes(currentShift.status)) throw new Error("The shift is no longer open. Reload and retry.");
      const expense = await tx.expense.create({
        data: {
          payrollId: parsedId,
          createdById: admin.userId,
          category: "Teacher Payroll",
          description: `${row.teacher.fullName} payroll ${row.periodStart.toISOString().slice(0, 7)}`,
          amountCents: row.grossAmountCents,
          incurredAt: shift.businessDate,
          expenseDate: shift.businessDate,
          paymentMethod,
          shiftId: shift.id,
        },
      });
      await tx.teacherPayroll.update({
        where: { id: parsedId },
        data: { status: "PAID", paidAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          action: "mark_paid",
          entity: "TeacherPayroll",
          entityId: parsedId,
          createdById: admin.userId,
          actorId: admin.session.userId,
          metadata: {
            paymentMethod,
            shiftId: shift.id,
            expenseId: expense.id,
            amountCents: row.grossAmountCents,
          },
        },
      });
    });
  } catch (error) {
    logServerError("payroll.markPaid", error, { payrollId });
    redirect(payrollPath(
      payrollId,
      "error",
      errorMessage(error, "Unable to mark payroll paid. Open a shift and choose a payment method."),
    ));
  }

  revalidatePath(`/payroll/${payrollId}`);
  revalidatePath("/payroll");
  revalidatePath("/shifts");
  revalidatePath("/expenses");
  revalidatePath("/reports");
  redirect(payrollPath(payrollId, "success", "Payroll marked paid and added to the current shift as a teacher-payroll expense."));
}

export async function cancelTeacherPayroll(formData: FormData) {
  const payrollId = String(formData.get("id") ?? "");
  try {
    const admin = await requirePayrollAdmin();
    const parsedId = id.parse(payrollId);
    const row = await prisma.teacherPayroll.findUnique({ where: { id: parsedId } });
    if (!row) throw new Error("Payroll not found.");
    if (row.status === "PAID") throw new Error("Paid payroll cannot be cancelled because it has already been posted to a shift.");
    if (row.status === "CANCELLED") throw new Error("Payroll is already cancelled.");
    await prisma.$transaction([
      prisma.teacherPayroll.update({ where: { id: parsedId }, data: { status: "CANCELLED" } }),
      prisma.auditLog.create({
        data: {
          action: "cancel",
          entity: "TeacherPayroll",
          entityId: parsedId,
          createdById: admin.userId,
          actorId: admin.session.userId,
          metadata: { previousStatus: row.status },
        },
      }),
    ]);
  } catch (error) {
    logServerError("payroll.cancel", error, { payrollId });
    redirect(payrollPath(payrollId, "error", errorMessage(error, "Unable to cancel payroll.")));
  }
  revalidatePath(`/payroll/${payrollId}`);
  revalidatePath("/payroll");
  redirect(payrollPath(payrollId, "success", "Payroll cancelled successfully."));
}
