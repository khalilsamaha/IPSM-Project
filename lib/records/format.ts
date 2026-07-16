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
  const { day, month, year } = dateParts(date);
  return `${day}/${month}/${year.slice(-2)}`;
}

export function formatFormalDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  const { day, month, year } = dateParts(date);
  return `${day}/${month}/${year}`;
}

export function formatDateInput(date: Date | string | null | undefined) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function dollarsToCents(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  return Math.round(Number(value) * 100);
}
