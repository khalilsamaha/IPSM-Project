import { formatDateShort } from "@/lib/date-time";

export function formatCurrencyInput(cents: number) {
  return (cents / 100).toFixed(2);
}

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function dateParts(date: Date | string) {
  const value = new Date(date);
  const day = String(value.getUTCDate()).padStart(2, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const year = String(value.getUTCFullYear());
  return { day, month, year };
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  // Date-only database values must retain their calendar day; instants use business time.
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year.slice(-2)}`;
  }
  return formatDateShort(date);
}

export function formatFormalDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  const { day, month, year } = dateParts(date);
  return `${day}/${month}/${year}`;
}

function timeParts(date: Date | string) {
  const value = new Date(date);
  const hours = String(value.getUTCHours()).padStart(2, "0");
  const minutes = String(value.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  return `${formatDate(date)} ${timeParts(date)}`;
}

export function formatFormalDateTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  return `${formatFormalDate(date)} ${timeParts(date)}`;
}

export function formatDateInput(date: Date | string | null | undefined) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function dollarsToCents(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  return Math.round(Number(value) * 100);
}
