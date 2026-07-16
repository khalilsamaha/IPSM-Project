import type { Prisma, PrismaClient } from "@prisma/client";
import { calculateShiftTotals } from "@/lib/shifts/calculations";

export const OPEN_SHIFT_STATUSES = ["OPEN", "REOPENED"] as const;

export async function getCurrentOpenShift(prisma: PrismaClient | Prisma.TransactionClient, userId: string) {
  return prisma.cashierShift.findFirst({ where: { userId, status: { in: [...OPEN_SHIFT_STATUSES] } }, orderBy: { openedAt: "desc" } });
}

export async function requireCurrentOpenShift(prisma: PrismaClient | Prisma.TransactionClient, userId: string) {
  const shift = await getCurrentOpenShift(prisma, userId);
  if (!shift) throw new Error("Open your shift before recording payments or expenses.");
  return shift;
}

export async function calculateShiftTotalsFromDb(prisma: PrismaClient | Prisma.TransactionClient, shiftId: string) {
  const shift = await prisma.cashierShift.findUnique({ where: { id: shiftId }, include: { payments: true, expenses: true } });
  if (!shift) throw new Error("Shift not found.");
  return { shift, totals: calculateShiftTotals({ openingCashCents: shift.openingCashCents, payments: shift.payments, expenses: shift.expenses }) };
}
