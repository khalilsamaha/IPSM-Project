"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { requireCurrentOpenShift } from "@/lib/shifts/service";
import { logServerError } from "@/lib/server-log";

const inputSchema = z.object({
  id: z.string().uuid(),
  paymentMethod: z.enum(["cash", "whish"]),
});

function payrollPath(id: string, kind: "error" | "success", message: string) {
  return `/payroll/${id}?${kind}=${encodeURIComponent(message)}`;
}

function errorMessage(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Choose a valid payment method.";
  return error instanceof Error ? error.message : "Unable to attach payroll to the shift.";
}

export async function reconcilePaidPayrollToShift(formData: FormData) {
  const rawId = String(formData.get("id") ?? "");
  try {
    const session = await requireSession();
    if (!isAdminOrHigher(session.role)) {
      throw new Error("You are not authorized to reconcile payroll payments.");
    }
    const input = inputSchema.parse(Object.fromEntries(formData));
    const user = await prisma.userProfile.findUnique({
      where: { authId: session.userId },
      select: { id: true },
    });
    if (!user) throw new Error("Your user profile could not be found.");
    const shift = await requireCurrentOpenShift(prisma, user.id);

    await prisma.$transaction(async (tx) => {
      const payroll = await tx.teacherPayroll.findUnique({
        where: { id: input.id },
        include: { teacher: true },
      });
      if (!payroll) throw new Error("Payroll not found.");
      if (payroll.status !== "PAID" || !payroll.paidAt) {
        throw new Error("Only a previously paid payroll can be reconciled to a shift.");
      }

      const priorLinks = await tx.auditLog.findMany({
        where: {
          entity: "TeacherPayroll",
          entityId: input.id,
          action: { in: ["mark_paid", "payroll_shift_reconciled"] },
        },
        select: { metadata: true },
      });
      const alreadyLinked = priorLinks.some((entry) => {
        const metadata = entry.metadata;
        return Boolean(
          metadata &&
          typeof metadata === "object" &&
          "shiftId" in metadata &&
          typeof (metadata as { shiftId?: unknown }).shiftId === "string",
        );
      });
      if (alreadyLinked) {
        throw new Error("This payroll is already attached to a shift.");
      }

      const duplicateExpense = await tx.expense.findFirst({
        where: {
          OR: [
            { payrollId: input.id },
            { shiftId: shift.id, category: "Teacher Payroll", description: { contains: input.id }, archivedAt: null },
          ],
        },
      });
      if (duplicateExpense) {
        throw new Error("A shift expense already exists for this payroll.");
      }

      const currentShift = await tx.cashierShift.findUnique({ where: { id: shift.id } });
      if (!currentShift || !["OPEN", "REOPENED"].includes(currentShift.status)) throw new Error("The shift is no longer open. Reload and retry.");
      const expense = await tx.expense.create({
        data: {
          payrollId: input.id,
          createdById: user.id,
          category: "Teacher Payroll",
          description: `${payroll.teacher.fullName} payroll ${payroll.payrollMonth ?? payroll.periodStart.toISOString().slice(0, 7)} [${payroll.id}]`,
          amountCents: payroll.grossAmountCents,
          incurredAt: shift.businessDate,
          expenseDate: shift.businessDate,
          paymentMethod: input.paymentMethod,
          shiftId: shift.id,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "payroll_shift_reconciled",
          entity: "TeacherPayroll",
          entityId: payroll.id,
          actorId: session.userId,
          createdById: user.id,
          metadata: {
            shiftId: shift.id,
            expenseId: expense.id,
            paymentMethod: input.paymentMethod,
            amountCents: payroll.grossAmountCents,
            originalPaidAt: payroll.paidAt.toISOString(),
            reason: "Legacy paid payroll did not capture a shift or payment method.",
          },
        },
      });
    });

    revalidatePath(`/payroll/${input.id}`);
    revalidatePath(`/shifts/${shift.id}`);
    revalidatePath("/shifts");
    revalidatePath("/reports");
    revalidatePath("/expenses");
    redirect(payrollPath(input.id, "success", "Paid payroll attached to the current shift successfully."));
  } catch (error) {
    logServerError("payroll.shiftReconciliation", error, { payrollId: rawId });
    redirect(payrollPath(rawId, "error", errorMessage(error)));
  }
}
