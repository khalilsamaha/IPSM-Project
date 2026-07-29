export function minutesBetween(startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

export function calculatePayrollItemAmountCents(minutes: number, hourlyRateSnapshotCents: number) {
  return Math.round((minutes * hourlyRateSnapshotCents) / 60);
}

export function calculateGrossPayrollCents(items: { amountCents: number }[], adjustmentCents = 0) {
  return items.reduce((sum, item) => sum + item.amountCents, 0) + adjustmentCents;
}

export function periodsOverlap(start: Date, end: Date, existingStart: Date, existingEnd: Date) {
  return start <= existingEnd && end >= existingStart;
}

export type MonthlyPayrollRow = { teacherId: string; teacherName: string; completedMinutes: number; missedPayableMinutes: number; adjustmentCents: number; grossAmountCents: number; status: string };
export function monthlyPayrollSummary(rows: MonthlyPayrollRow[]) {
  const teachers = new Map<string, Omit<MonthlyPayrollRow, "status">>();
  for (const row of rows) {
    const current = teachers.get(row.teacherId) ?? { teacherId: row.teacherId, teacherName: row.teacherName, completedMinutes: 0, missedPayableMinutes: 0, adjustmentCents: 0, grossAmountCents: 0 };
    current.completedMinutes += row.completedMinutes; current.missedPayableMinutes += row.missedPayableMinutes; current.adjustmentCents += row.adjustmentCents; current.grossAmountCents += row.grossAmountCents;
    teachers.set(row.teacherId, current);
  }
  return { rollup: [...teachers.values()], gross: rows.reduce((s,r)=>s+r.grossAmountCents,0), draft: rows.filter(r=>r.status==="DRAFT").reduce((s,r)=>s+r.grossAmountCents,0), approved: rows.filter(r=>r.status==="APPROVED").reduce((s,r)=>s+r.grossAmountCents,0), paid: rows.filter(r=>r.status==="PAID").reduce((s,r)=>s+r.grossAmountCents,0) };
}
