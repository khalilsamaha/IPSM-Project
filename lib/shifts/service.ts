import type { Prisma, PrismaClient } from "@prisma/client";
import { calculateShiftTotals } from "@/lib/shifts/calculations";
import { APP_TIME_ZONE, formatDateForInput } from "@/lib/date-time";

export const OPEN_SHIFT_STATUSES = ["OPEN", "REOPENED"] as const;

export async function getCurrentOpenShift(prisma: PrismaClient | Prisma.TransactionClient, userId: string) {
  return prisma.cashierShift.findFirst({ where: { userId, status: { in: [...OPEN_SHIFT_STATUSES] } }, orderBy: { openedAt: "desc" } });
}

export async function requireCurrentOpenShift(prisma: PrismaClient | Prisma.TransactionClient, userId: string) {
  const shift = await getCurrentOpenShift(prisma, userId);
  if (!shift) throw new Error("Open your shift before recording payments or expenses.");
  const today = currentBusinessDate();
  if (formatDateForInput(shift.businessDate) < today) {
    await autoCloseShift(prisma, shift.id);
    throw new Error("Your previous-day shift was automatically closed. Open today’s shift before recording this transaction.");
  }
  return shift;
}

export function currentBusinessDate(now = new Date(), timeZone = APP_TIME_ZONE) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export async function autoCloseShift(prisma: PrismaClient | Prisma.TransactionClient, shiftId: string) {
  const { shift, totals } = await calculateShiftTotalsFromDb(prisma, shiftId);
  if (!OPEN_SHIFT_STATUSES.includes(shift.status as (typeof OPEN_SHIFT_STATUSES)[number])) return false;
  const receiptNumbers = await prisma.payment.findMany({ where: { shiftId, receiptNumber: { not: null } }, select: { receiptNumber: true }, orderBy: { receiptNumber: "asc" } });
  const closedAt = new Date();
  const snapshot = { version: 1, closingMode: "automatic", openingCashCents: shift.openingCashCents, ...totals, declaredCashCents: null, differenceCents: null, receiptCount: receiptNumbers.length, firstReceiptNumber: receiptNumbers[0]?.receiptNumber ?? null, lastReceiptNumber: receiptNumbers.at(-1)?.receiptNumber ?? null, closedAt: closedAt.toISOString() };
  await prisma.cashierShift.update({ where: { id: shiftId }, data: { status: "AUTO_CLOSED", closedAt, expectedCashCents: totals.expectedCashCents, declaredCashCents: null, differenceCents: null, closingSnapshot: { automatic: snapshot } } });
  await prisma.auditLog.create({ data: { action: "auto_close", entity: "CashierShift", entityId: shiftId, metadata: snapshot } });
  return true;
}

export async function closeStaleShifts(prisma: PrismaClient, now = new Date()) {
  const today = currentBusinessDate(now);
  const stale = await prisma.cashierShift.findMany({ where: { status: { in: [...OPEN_SHIFT_STATUSES] }, businessDate: { lt: new Date(`${today}T00:00:00.000Z`) } }, select: { id: true } });
  let closed = 0;
  for (const row of stale) if (await prisma.$transaction((tx) => autoCloseShift(tx, row.id))) closed++;
  return { closed, businessDate: today };
}

export async function calculateShiftTotalsFromDb(prisma: PrismaClient | Prisma.TransactionClient, shiftId: string) {
  const shift = await prisma.cashierShift.findUnique({ where: { id: shiftId }, include: { payments: true, expenses: true } });
  if (!shift) throw new Error("Shift not found.");
  return { shift, totals: calculateShiftTotals({ openingCashCents: shift.openingCashCents, payments: shift.payments, expenses: shift.expenses }) };
}
