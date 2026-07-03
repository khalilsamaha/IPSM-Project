const MS_PER_DAY = 24 * 60 * 60 * 1000;

function utcDateOnly(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function inclusiveDaysBetween(startDate: Date, endDate: Date) {
  return Math.max(1, Math.floor((utcDateOnly(endDate) - utcDateOnly(startDate)) / MS_PER_DAY) + 1);
}

export function calculateProratedFeeCents(fullPriceCents: number, seasonStartDate: Date, seasonEndDate: Date, enrollmentStartDate: Date, enrollmentEndDate: Date) {
  const seasonDays = inclusiveDaysBetween(seasonStartDate, seasonEndDate);
  const activeEnrollmentDays = inclusiveDaysBetween(enrollmentStartDate, enrollmentEndDate);
  return Math.round((fullPriceCents * activeEnrollmentDays) / seasonDays);
}

export function formatDateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}
