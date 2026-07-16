export const newPaymentMethods = ["cash", "whish"] as const;
export type NewPaymentMethod = (typeof newPaymentMethods)[number];
export const paymentMethodLabels: Record<string, string> = { cash: "Cash", whish: "Whish", card: "Card", check: "Check", ach: "ACH", bank_transfer: "Bank Transfer", other: "Other" };
export function formatPaymentMethod(method: string | null | undefined) {
  if (!method) return "—";
  return paymentMethodLabels[method] ?? method.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
export function isNewPaymentMethod(method: string): method is NewPaymentMethod {
  return (newPaymentMethods as readonly string[]).includes(method);
}
