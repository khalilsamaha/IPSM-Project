import { parseIsoDateOnly } from "@/lib/date-time";

function dateOnly(value: Date | string) {
  return typeof value === "string" ? parseIsoDateOnly(value) : new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function firstWeekdayOnOrAfter(value: Date | string, weekday: number) {
  const date = dateOnly(value);
  date.setUTCDate(date.getUTCDate() + ((weekday - date.getUTCDay() + 7) % 7));
  return date;
}

export function lastWeekdayOnOrBefore(value: Date | string, weekday: number) {
  const date = dateOnly(value);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() - weekday + 7) % 7));
  return date;
}

export function defaultAvailabilityRange(seasonStart: Date | string, seasonEnd: Date | string, weekday: number, businessDate = new Date()) {
  const start = dateOnly(seasonStart); const end = dateOnly(seasonEnd); const today = dateOnly(businessDate);
  if (today > end) throw new Error("The selected season has already ended.");
  const effectiveFrom = firstWeekdayOnOrAfter(today > start ? today : start, weekday);
  const effectiveTo = lastWeekdayOnOrBefore(end, weekday);
  if (effectiveFrom > effectiveTo) throw new Error("No selected weekday remains in this season.");
  return { effectiveFrom, effectiveTo };
}

export function validateAvailabilityRange(input: { seasonStart: Date; seasonEnd: Date; weekday: number; effectiveFrom: Date; effectiveTo: Date }) {
  const { seasonStart, seasonEnd, weekday, effectiveFrom, effectiveTo } = input;
  if (effectiveFrom < seasonStart || effectiveTo > seasonEnd) throw new Error("Effective dates must be inside the season.");
  if (effectiveFrom > effectiveTo) throw new Error("Effective from must not be after effective to.");
  if (effectiveFrom.getUTCDay() !== weekday || effectiveTo.getUTCDay() !== weekday) throw new Error("Effective dates must match the selected weekday.");
}
