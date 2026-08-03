export type CompensationBasis = "HOURLY" | "SESSION_UNIT";

export function minutesBetween(startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

export function calculatePayrollItemAmountCents(minutes: number, hourlyRateSnapshotCents: number) {
  return Math.round((minutes * hourlyRateSnapshotCents) / 60);
}

export function calculateCompensationAmountCents(
  minutes: number,
  rateCents: number,
  basis: CompensationBasis = "HOURLY",
  unitMinutes = 60,
) {
  if (
    !Number.isInteger(minutes) ||
    minutes < 0 ||
    !Number.isInteger(rateCents) ||
    rateCents < 0 ||
    !Number.isInteger(unitMinutes) ||
    unitMinutes <= 0
  ) {
    throw new Error("Invalid compensation values");
  }
  return Math.round((minutes * rateCents) / (basis === "HOURLY" ? 60 : unitMinutes));
}

export function resolveCompensation(input: {
  compensationBasis: CompensationBasis;
  hourlyRateCents: number;
  sessionRateCents?: number | null;
  sessionUnitMinutes?: number | null;
}) {
  if (input.compensationBasis === "SESSION_UNIT") {
    return {
      basis: "SESSION_UNIT" as const,
      rateCents: input.sessionRateCents ?? 0,
      unitMinutes: input.sessionUnitMinutes ?? 30,
    };
  }
  return {
    basis: "HOURLY" as const,
    rateCents: input.hourlyRateCents,
    unitMinutes: 60,
  };
}

export function compensationRateLabel(input: {
  basis: CompensationBasis;
  unitMinutes: number;
}) {
  return input.basis === "SESSION_UNIT"
    ? `per ${input.unitMinutes}-minute lesson`
    : "per hour";
}

export function calculateGrossPayrollCents(items: { amountCents: number }[], adjustmentCents = 0) {
  return items.reduce((sum, item) => sum + item.amountCents, 0) + adjustmentCents;
}

export function periodsOverlap(start: Date, end: Date, existingStart: Date, existingEnd: Date) {
  return start <= existingEnd && end >= existingStart;
}

export type MonthlyPayrollRow = {
  teacherId: string;
  teacherName: string;
  completedMinutes: number;
  missedPayableMinutes: number;
  adjustmentCents: number;
  grossAmountCents: number;
  status: string;
};

export function monthlyPayrollSummary(rows: MonthlyPayrollRow[]) {
  const teachers = new Map<string, Omit<MonthlyPayrollRow, "status">>();
  for (const row of rows) {
    const current = teachers.get(row.teacherId) ?? {
      teacherId: row.teacherId,
      teacherName: row.teacherName,
      completedMinutes: 0,
      missedPayableMinutes: 0,
      adjustmentCents: 0,
      grossAmountCents: 0,
    };
    current.completedMinutes += row.completedMinutes;
    current.missedPayableMinutes += row.missedPayableMinutes;
    current.adjustmentCents += row.adjustmentCents;
    current.grossAmountCents += row.grossAmountCents;
    teachers.set(row.teacherId, current);
  }
  return {
    rollup: [...teachers.values()],
    gross: rows.reduce((sum, row) => sum + row.grossAmountCents, 0),
    draft: rows.filter((row) => row.status === "DRAFT").reduce((sum, row) => sum + row.grossAmountCents, 0),
    approved: rows.filter((row) => row.status === "APPROVED").reduce((sum, row) => sum + row.grossAmountCents, 0),
    paid: rows.filter((row) => row.status === "PAID").reduce((sum, row) => sum + row.grossAmountCents, 0),
  };
}
