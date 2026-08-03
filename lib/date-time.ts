const DEFAULT_APP_TIME_ZONE = "Asia/Beirut";
const APP_TIME_ZONE = process.env.APP_TIME_ZONE?.trim() || DEFAULT_APP_TIME_ZONE;

export function formatDateShort(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function formatDateTimeShort(value: Date | string) {
  return `${formatDateShort(value)} ${new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(typeof value === "string" ? new Date(value) : value)}`;
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
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/** Parse a school date without relying on implementation-dependent Date parsing.
 * Two digit years use a documented 1970-2069 window (00-69 => 2000-2069,
 * 70-99 => 1970-1999). Four digit years are accepted from 1900 through 2099.
 */
export type LocalizedDateFormat = "dd/mm/yy" | "dd/mm/yyyy";

export function parseDisplayDate(
  value: string,
  displayFormat: LocalizedDateFormat = "dd/mm/yy",
) {
  const yearPattern = displayFormat === "dd/mm/yyyy" ? "\\d{4}" : "\\d{2}";
  const match = new RegExp(`^(\\d{2})\\/(\\d{2})/(${yearPattern})$`).exec(
    value.trim(),
  );
  const formatError = `Enter a valid date in ${displayFormat} format.`;
  if (!match) throw new Error(formatError);

  const shortYear = Number(match[3]);
  const year =
    match[3].length === 2
      ? shortYear <= 69
        ? 2000 + shortYear
        : 1900 + shortYear
      : shortYear;
  const month = Number(match[2]);
  const day = Number(match[1]);
  if (year < 1900 || year > 2099) {
    throw new Error("Year must be between 1900 and 2099.");
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(
      displayFormat === "dd/mm/yyyy"
        ? formatError
        : "Enter a valid calendar date.",
    );
  }
  return formatDateForInput(date);
}

export function displayDateFromIso(
  value: string,
  displayFormat: LocalizedDateFormat = "dd/mm/yy",
) {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid ISO date.");
  return `${match[3]}/${match[2]}/${
    displayFormat === "dd/mm/yyyy" ? match[1] : match[1].slice(2)
  }`;
}

/** Parse an ISO date-only value as UTC, rejecting rollover dates such as 2024-02-31. */
export function parseIsoDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) throw new Error("Enter a valid date.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Enter a valid calendar date.");
  }
  return date;
}

export { APP_TIME_ZONE, DEFAULT_APP_TIME_ZONE };

export class BusinessTimeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessTimeConfigurationError";
  }
}

/**
 * Resolve the business timezone from one canonical source.
 *
 * Production should normally define APP_TIME_ZONE explicitly, but the school has
 * always used Asia/Beirut as its documented default. Business-time calculations
 * must therefore use the same fallback as display formatting instead of reading
 * the raw environment variable a second time.
 */
export function businessTimeZone(value?: string) {
  const resolved = value?.trim() || APP_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en", { timeZone: resolved }).format(new Date());
  } catch {
    throw new BusinessTimeConfigurationError("APP_TIME_ZONE is invalid.");
  }
  return resolved;
}

/** Converts a date-only value and HH:mm wall time in an IANA zone to an instant.
 * The iterative Intl calculation handles ordinary DST offsets and rejects nonexistent wall times.
 */
export function sessionEndInstant(input: {
  sessionDate: Date | string;
  endTime: string;
  timeZone?: string;
}) {
  const zone = businessTimeZone(input.timeZone);
  const date =
    typeof input.sessionDate === "string"
      ? parseIsoDateOnly(input.sessionDate)
      : input.sessionDate;
  const match = /^(\d{2}):(\d{2})$/.exec(input.endTime);
  if (
    !match ||
    +match[1] > 23 ||
    +match[2] > 59 ||
    Number.isNaN(date.valueOf())
  ) {
    throw new Error("Invalid lesson date or end time.");
  }

  const wanted = {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: +match[1],
    minute: +match[2],
  };
  let instant = Date.UTC(
    wanted.year,
    wanted.month - 1,
    wanted.day,
    wanted.hour,
    wanted.minute,
  );
  const partsAt = (milliseconds: number) =>
    Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(milliseconds)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, +part.value]),
    );

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const got = partsAt(instant);
    const wall = Date.UTC(
      got.year,
      got.month - 1,
      got.day,
      got.hour,
      got.minute,
    );
    instant +=
      Date.UTC(
        wanted.year,
        wanted.month - 1,
        wanted.day,
        wanted.hour,
        wanted.minute,
      ) - wall;
  }

  const got = partsAt(instant);
  if (
    got.year !== wanted.year ||
    got.month !== wanted.month ||
    got.day !== wanted.day ||
    got.hour !== wanted.hour ||
    got.minute !== wanted.minute
  ) {
    throw new Error("Lesson end time does not exist in the business timezone.");
  }
  return new Date(instant);
}
