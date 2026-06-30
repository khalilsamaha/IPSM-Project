export function formatCurrencyInput(cents: number) {
  return (cents / 100).toFixed(2);
}

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(date));
}

export function dollarsToCents(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  return Math.round(Number(value) * 100);
}
