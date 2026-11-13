import { ShiftStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateShiftTotals } from "@/lib/shifts/calculations";

export type ShiftClosureFilters = {
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  shiftStatus?: string;
};

export type ShiftClosureReportRow = {
  id: string;
  businessDate: Date;
  userId: string;
  userName: string;
  status: string;
  openedAt: Date;
  closedAt: Date | null;
  openingCashCents: number;
  cashPaymentsCents: number;
  whishPaymentsCents: number;
  payrollCents: number;
  cashPayrollCents: number;
  whishPayrollCents: number;
  operatingExpenseCents: number;
  expectedCashCents: number;
  declaredCashCents: number | null;
  differenceCents: number | null;
  varianceReason: string | null;
  receiptCount: number;
  payrollCount: number;
  operatingExpenseCount: number;
};

function validDate(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function validShiftStatus(value?: string): value is ShiftStatus {
  return Boolean(value && Object.values(ShiftStatus).includes(value as ShiftStatus));
}

function shiftWhere(filters: ShiftClosureFilters): Prisma.CashierShiftWhereInput {
  const businessDate: Prisma.DateTimeFilter = {};
  if (validDate(filters.dateFrom)) {
    businessDate.gte = new Date(`${filters.dateFrom}T00:00:00.000Z`);
  }
  if (validDate(filters.dateTo)) {
    businessDate.lte = new Date(`${filters.dateTo}T00:00:00.000Z`);
  }

  return {
    ...(Object.keys(businessDate).length ? { businessDate } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(validShiftStatus(filters.shiftStatus) ? { status: filters.shiftStatus } : {}),
  };
}

export async function getShiftClosureLookups() {
  return prisma.userProfile.findMany({
    where: { shiftsOpened: { some: {} } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Shared mapping ensures UI, filtered totals and exports use identical shift rules. */
const shiftInclude = {
  user: { select: { name: true } },
  payments: { select: { paymentMethod: true, totalAmountCents: true, voidedAt: true } },
  expenses: { select: { paymentMethod: true, amountCents: true, category: true, archivedAt: true } },
} satisfies Prisma.CashierShiftInclude;

async function loadShiftBatch(where: Prisma.CashierShiftWhereInput, skip: number, take: number) {
  const shifts = await prisma.cashierShift.findMany({
    where, include: shiftInclude,
    orderBy: [{ businessDate: "desc" }, { openedAt: "desc" }, { id: "desc" }],
    skip, take,
  });
  return shifts.map((shift): ShiftClosureReportRow => {
    const totals = calculateShiftTotals({
      openingCashCents: shift.openingCashCents,
      payments: shift.payments,
      expenses: shift.expenses,
    });
    return {
      id: shift.id,
      businessDate: shift.businessDate,
      userId: shift.userId,
      userName: shift.user.name,
      status: shift.status,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      openingCashCents: shift.openingCashCents,
      cashPaymentsCents: totals.cashPaymentsCents,
      whishPaymentsCents: totals.whishPaymentsCents,
      payrollCents: totals.payrollCents,
      cashPayrollCents: totals.cashPayrollCents,
      whishPayrollCents: totals.whishPayrollCents,
      operatingExpenseCents: totals.operatingExpenseCents,
      expectedCashCents: totals.expectedCashCents,
      declaredCashCents: shift.declaredCashCents,
      differenceCents: shift.differenceCents,
      varianceReason: shift.varianceReason,
      receiptCount: totals.postedPaymentCount,
      payrollCount: totals.payrollExpenseCount,
      operatingExpenseCount: totals.operatingExpenseCount,
    };
  });
}

/** Reads the complete filtered result in bounded batches; no default 25-row limit.
 * Does not create new financial totals or change shift closing data.
 */
export async function getAllShiftClosureRows(filters: ShiftClosureFilters) {
  const where = shiftWhere(filters);
  const rows: ShiftClosureReportRow[] = [];
  const BATCH = 250;
  for (;;) {
    const batch = await loadShiftBatch(where, rows.length, BATCH);
    rows.push(...batch);
    if (batch.length < BATCH) break;
  }
  return rows;
}

export function summarizeShiftClosures(rows: readonly ShiftClosureReportRow[]) {
  return {
    cashPaymentsCents: rows.reduce((sum, row) => sum + row.cashPaymentsCents, 0),
    whishPaymentsCents: rows.reduce((sum, row) => sum + row.whishPaymentsCents, 0),
    payrollCents: rows.reduce((sum, row) => sum + row.payrollCents, 0),
    operatingExpenseCents: rows.reduce((sum, row) => sum + row.operatingExpenseCents, 0),
    differencesCents: rows.reduce((sum, row) => sum + (row.differenceCents ?? 0), 0),
  };
}

export async function getShiftClosureReport(
  filters: ShiftClosureFilters,
  pagination: { skip?: number; take?: number } = {},
) {
  const where = shiftWhere(filters);
  const [totalRows, rows, allRows] = await Promise.all([
    prisma.cashierShift.count({ where }),
    loadShiftBatch(where, pagination.skip ?? 0, pagination.take ?? 25),
    getAllShiftClosureRows(filters),
  ]);
  return { rows, totalRows, summary: summarizeShiftClosures(allRows) };
}
