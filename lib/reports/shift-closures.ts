import type { Prisma } from "@prisma/client";
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

function shiftWhere(filters: ShiftClosureFilters): Prisma.CashierShiftWhereInput {
  const businessDate: Prisma.DateTimeFilter = {};
  if (validDate(filters.dateFrom)) businessDate.gte = new Date(`${filters.dateFrom}T00:00:00.000Z`);
  if (validDate(filters.dateTo)) businessDate.lte = new Date(`${filters.dateTo}T00:00:00.000Z`);

  return {
    ...(Object.keys(businessDate).length ? { businessDate } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.shiftStatus ? { status: filters.shiftStatus as Prisma.EnumShiftStatusFilter } : {}),
  };
}

export async function getShiftClosureLookups() {
  return prisma.userProfile.findMany({
    where: { shiftsOpened: { some: {} } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getShiftClosureReport(
  filters: ShiftClosureFilters,
  pagination: { skip?: number; take?: number } = {},
) {
  const where = shiftWhere(filters);
  const [totalRows, shifts] = await Promise.all([
    prisma.cashierShift.count({ where }),
    prisma.cashierShift.findMany({
      where,
      include: {
        user: { select: { name: true } },
        payments: { select: { paymentMethod: true, totalAmountCents: true, voidedAt: true } },
        expenses: { select: { paymentMethod: true, amountCents: true, category: true, archivedAt: true } },
      },
      orderBy: [{ businessDate: "desc" }, { openedAt: "desc" }],
      skip: pagination.skip ?? 0,
      take: pagination.take ?? 25,
    }),
  ]);

  const rows: ShiftClosureReportRow[] = shifts.map((shift) => {
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

  return {
    rows,
    totalRows,
    summary: {
      cashPaymentsCents: rows.reduce((sum, row) => sum + row.cashPaymentsCents, 0),
      whishPaymentsCents: rows.reduce((sum, row) => sum + row.whishPaymentsCents, 0),
      payrollCents: rows.reduce((sum, row) => sum + row.payrollCents, 0),
      operatingExpenseCents: rows.reduce((sum, row) => sum + row.operatingExpenseCents, 0),
      differencesCents: rows.reduce((sum, row) => sum + (row.differenceCents ?? 0), 0),
    },
  };
}
