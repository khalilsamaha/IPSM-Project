import { describe, expect, it } from "vitest";
import { calculateProfitLossCents, estimateTeacherSalaryCents, sumExpenseCents, sumOutstandingCents, sumRevenueCents } from "@/lib/reports/calculations";

describe("report calculations", () => {
  it("excludes voided payments from revenue", () => {
    expect(sumRevenueCents([
      { totalAmountCents: 10000, voidedAt: null },
      { totalAmountCents: 5000, voidedAt: new Date("2026-01-02") },
    ])).toBe(10000);
  });

  it("sums outstanding balances from enrollment remaining cents", () => {
    expect(sumOutstandingCents([{ remainingCents: 2500 }, { remainingCents: 7500 }])).toBe(10000);
  });

  it("excludes archived expenses by default", () => {
    const expenses = [
      { amountCents: 3000, archivedAt: null },
      { amountCents: 2000, archivedAt: new Date("2026-02-01") },
    ];
    expect(sumExpenseCents(expenses)).toBe(3000);
    expect(sumExpenseCents(expenses, true)).toBe(5000);
  });

  it("calculates profit and loss as revenue minus active expenses", () => {
    expect(calculateProfitLossCents([{ totalAmountCents: 12000, voidedAt: null }], [{ amountCents: 4500, archivedAt: null }])).toBe(7500);
  });

  it("uses zero salary until teaching hours are tracked", () => {
    expect(estimateTeacherSalaryCents(5000, null)).toBe(0);
    expect(estimateTeacherSalaryCents(5000, 3)).toBe(15000);
  });
});
