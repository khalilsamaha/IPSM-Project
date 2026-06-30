import { describe, expect, it } from "vitest";
import { formatExpenseAmount, formatExpenseAmountInput, parseExpenseForm } from "@/lib/expenses";

describe("expense validation", () => {
  it("stores valid expense amounts in cents", () => {
    expect(parseExpenseForm({
      category: "Rent",
      description: "Studio rent",
      amount: "123.45",
      expenseDate: "2026-06-15",
      paymentMethod: "ach",
    })).toMatchObject({ category: "Rent", description: "Studio rent", amountCents: 12345, paymentMethod: "ach" });
  });

  it("rejects zero and negative amounts", () => {
    expect(() => parseExpenseForm({ category: "Rent", description: "Studio", amount: "0", expenseDate: "2026-06-15", paymentMethod: "cash" })).toThrow();
    expect(() => parseExpenseForm({ category: "Rent", description: "Studio", amount: "-1", expenseDate: "2026-06-15", paymentMethod: "cash" })).toThrow();
  });

  it("rejects unsupported payment methods", () => {
    expect(() => parseExpenseForm({ category: "Rent", description: "Studio", amount: "1", expenseDate: "2026-06-15", paymentMethod: "crypto" })).toThrow();
  });
});

describe("expense formatting", () => {
  it("formats cents for display and form inputs", () => {
    expect(formatExpenseAmount(12345)).toBe("$123.45");
    expect(formatExpenseAmountInput(12345)).toBe("123.45");
  });
});
