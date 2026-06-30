import { z } from "zod";
import { dollarsToCents, formatCurrency, formatCurrencyInput } from "@/lib/records/format";

export const expensePaymentMethods = ["cash", "card", "check", "ach", "bank_transfer", "other"] as const;

export const expenseSchema = z.object({
  id: z.string().uuid().optional(),
  category: z.string().trim().min(1, "Category is required").max(80),
  description: z.string().trim().min(1, "Description is required").max(240),
  amount: z.string().trim().min(1, "Amount is required"),
  expenseDate: z.string().min(1, "Expense date is required").transform((value) => new Date(value)),
  paymentMethod: z.enum(expensePaymentMethods),
}).refine((value) => dollarsToCents(value.amount) > 0, { path: ["amount"], message: "Amount must be greater than zero" });

export function parseExpenseForm(input: Record<string, FormDataEntryValue>) {
  const parsed = expenseSchema.parse(input);
  const { amount, ...rest } = parsed;
  return { ...rest, amountCents: dollarsToCents(amount), incurredAt: rest.expenseDate };
}

export function formatExpenseAmount(cents: number) {
  return formatCurrency(cents);
}

export function formatExpenseAmountInput(cents: number) {
  return formatCurrencyInput(cents);
}
