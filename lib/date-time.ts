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
export function parseDisplayDate(value: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(value.trim());
  if (!m) throw new Error("Enter a valid date in dd/mm/yy format.");
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
    throw new Error("Enter a valid calendar date.");
  return formatDateForInput(d);
}
export function displayDateFromIso(value: string) {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw new Error("Invalid ISO date.");
  return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
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
