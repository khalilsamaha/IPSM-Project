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
