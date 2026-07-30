const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Asia/Beirut";
export function formatDateShort(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}
export function formatDateTimeShort(value: Date | string) {
  return `${formatDateShort(value)} ${new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(typeof value === "string" ? new Date(value) : value)}`;
}
export function formatTime24(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(typeof value === "string" ? new Date(value) : value);
}
export function formatDateForInput(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
/** Parse a school date without relying on implementation-dependent Date parsing.
 * Two digit years use a documented 1970-2069 window (00-69 => 2000-2069,
 * 70-99 => 1970-1999). Four digit years are accepted from 1900 through 2099.
 */
export type LocalizedDateFormat = "dd/mm/yy" | "dd/mm/yyyy";
export function parseDisplayDate(value: string, displayFormat: LocalizedDateFormat = "dd/mm/yy") {
  const yearPattern = displayFormat === "dd/mm/yyyy" ? "\\d{4}" : "\\d{2}";
  const m = new RegExp(`^(\\d{2})\\/(\\d{2})\\/(${yearPattern})$`).exec(value.trim());
  const formatError = `Enter a valid date in ${displayFormat} format.`;
  if (!m) throw new Error(formatError);
  const shortYear = Number(m[3]);
  const year =
    m[3].length === 2
      ? shortYear <= 69
        ? 2000 + shortYear
        : 1900 + shortYear
      : shortYear;
  const month = Number(m[2]),
    day = Number(m[1]);
  if (year < 1900 || year > 2099)
    throw new Error("Year must be between 1900 and 2099.");
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  )
    throw new Error(displayFormat === "dd/mm/yyyy" ? formatError : "Enter a valid calendar date.");
  return formatDateForInput(d);
}
export function displayDateFromIso(value: string, displayFormat: LocalizedDateFormat = "dd/mm/yy") {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw new Error("Invalid ISO date.");
  return `${m[3]}/${m[2]}/${displayFormat === "dd/mm/yyyy" ? m[1] : m[1].slice(2)}`;
}
/** Parse an ISO date-only value as UTC, rejecting rollover dates such as 2024-02-31. */
export function parseIsoDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) throw new Error("Enter a valid date.");
  const year = Number(match[1]),
    month = Number(match[2]),
    day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    throw new Error("Enter a valid calendar date.");
  return date;
}
export { APP_TIME_ZONE };

export class BusinessTimeConfigurationError extends Error {
  constructor(message: string) { super(message); this.name = "BusinessTimeConfigurationError"; }
}
export function businessTimeZone(value = process.env.APP_TIME_ZONE) {
  if (!value) throw new BusinessTimeConfigurationError("APP_TIME_ZONE is required.");
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date()); }
  catch { throw new BusinessTimeConfigurationError("APP_TIME_ZONE is invalid."); }
  return value;
}
/** Converts a date-only value and HH:mm wall time in an IANA zone to an instant.
 * The iterative Intl calculation handles ordinary DST offsets and rejects nonexistent wall times.
 */
export function sessionEndInstant(input: { sessionDate: Date | string; endTime: string; timeZone?: string }) {
  const zone = businessTimeZone(input.timeZone);
  const date = typeof input.sessionDate === "string" ? parseIsoDateOnly(input.sessionDate) : input.sessionDate;
  const match = /^(\d{2}):(\d{2})$/.exec(input.endTime);
  if (!match || +match[1] > 23 || +match[2] > 59 || Number.isNaN(date.valueOf())) throw new Error("Invalid lesson date or end time.");
  const wanted = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: +match[1], minute: +match[2] };
  let instant = Date.UTC(wanted.year, wanted.month - 1, wanted.day, wanted.hour, wanted.minute);
  const partsAt = (ms: number) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: zone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(ms).filter(p=>p.type!=="literal").map(p=>[p.type,+p.value]));
  for (let i=0;i<3;i++) { const got=partsAt(instant); const wall=Date.UTC(got.year,got.month-1,got.day,got.hour,got.minute); instant += Date.UTC(wanted.year,wanted.month-1,wanted.day,wanted.hour,wanted.minute)-wall; }
  const got=partsAt(instant);
  if (got.year!==wanted.year || got.month!==wanted.month || got.day!==wanted.day || got.hour!==wanted.hour || got.minute!==wanted.minute) throw new Error("Lesson end time does not exist in the business timezone.");
  return new Date(instant);
}
