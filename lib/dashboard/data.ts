import { prisma } from "@/lib/prisma";
import { calculateDashboardMetrics } from "./metrics";

export async function getDashboardMetrics() {
  const [students, families, enrollments, payments, expenses] = await Promise.all([
    prisma.student.findMany({ select: { status: true } }),
    prisma.family.findMany({ select: { status: true } }),
    prisma.enrollment.findMany({ select: { status: true, remainingCents: true } }),
    prisma.payment.findMany({ select: { totalAmountCents: true, paymentDate: true, voidedAt: true } }),
    prisma.expense.findMany({ select: { amountCents: true, expenseDate: true } }),
  ]);

  return calculateDashboardMetrics({ students, families, enrollments, payments, expenses });
}
