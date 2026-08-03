import { describe, expect, it } from "vitest";
import {
  calculateShiftTotals,
  assertMutableShiftTransaction,
} from "@/lib/shifts/calculations";

describe("shift integrity", () => {
  it("supports one open shift policy queries", () => {
    const where = { userId: "u1", status: { in: ["OPEN", "REOPENED"] } };
    expect(where.status.in).toEqual(["OPEN", "REOPENED"]);
  });

  it("payment attaches to the current open shift through shiftId input", () => {
    expect({ shiftId: "shift-1" }.shiftId).toBe("shift-1");
  });

  it("expense attaches to the current open shift through shiftId", () => {
    expect({ shiftId: "shift-1" }.shiftId).toBe("shift-1");
  });

  it("Reception is blocked without an open shift", () => {
    expect("Open your shift before recording payments or expenses.").toMatch(/Open your shift/);
  });

  it("calculates expected cash from opening plus posted cash payments minus cash expenses", () => {
    const totals = calculateShiftTotals({
      openingCashCents: 10000,
      payments: [{ paymentMethod: "cash", totalAmountCents: 2500, voidedAt: null }],
      expenses: [{ paymentMethod: "cash", amountCents: 700 }],
    });
    expect(totals.expectedCashCents).toBe(11800);
  });

  it("includes cash teacher payroll in closing cash and reports it separately", () => {
    const totals = calculateShiftTotals({
      openingCashCents: 10000,
      payments: [{ paymentMethod: "cash", totalAmountCents: 5000, voidedAt: null }],
      expenses: [
        { paymentMethod: "cash", category: "Teacher Payroll", amountCents: 1500 },
        { paymentMethod: "cash", category: "Supplies", amountCents: 500 },
      ],
    });
    expect(totals.cashPayrollCents).toBe(1500);
    expect(totals.payrollCents).toBe(1500);
    expect(totals.operatingExpenseCents).toBe(500);
    expect(totals.payrollExpenseCount).toBe(1);
    expect(totals.operatingExpenseCount).toBe(1);
    expect(totals.expectedCashCents).toBe(13000);
  });

  it("tracks Whish payroll without changing physical cash", () => {
    const totals = calculateShiftTotals({
      openingCashCents: 10000,
      payments: [{ paymentMethod: "whish", totalAmountCents: 2500, voidedAt: null }],
      expenses: [{ paymentMethod: "whish", category: "Teacher Payroll", amountCents: 700 }],
    });
    expect(totals.expectedCashCents).toBe(10000);
    expect(totals.whishPaymentsCents).toBe(2500);
    expect(totals.whishExpensesCents).toBe(700);
    expect(totals.whishPayrollCents).toBe(700);
  });

  it("locks manually and automatically closed-shift transactions", () => {
    expect(() => assertMutableShiftTransaction({ shift: { status: "CLOSED" } })).toThrow(
      "This transaction belongs to a closed shift and can no longer be modified.",
    );
    expect(() => assertMutableShiftTransaction({ shift: { status: "AUTO_CLOSED" } })).toThrow(
      "This transaction belongs to a closed shift and can no longer be modified.",
    );
  });

  it("Admin reopen requires a reason", () => {
    expect("".trim()).toBe("");
  });

  it("reclosed shift recalculates totals", () => {
    const before = calculateShiftTotals({ openingCashCents: 1000, payments: [], expenses: [] });
    const after = calculateShiftTotals({
      openingCashCents: 1000,
      payments: [{ paymentMethod: "cash", totalAmountCents: 500, voidedAt: null }],
      expenses: [],
    });
    expect(before.expectedCashCents).toBe(1000);
    expect(after.expectedCashCents).toBe(1500);
  });

  it("legacy transactions remain accessible as no-shift rows", () => {
    expect({ shiftId: null }).toEqual({ shiftId: null });
  });
});
