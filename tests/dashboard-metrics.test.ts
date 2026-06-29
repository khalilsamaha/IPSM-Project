import { describe, expect, it } from "vitest";
import { calculateDashboardMetrics, formatCurrency } from "@/lib/dashboard/metrics";

describe("calculateDashboardMetrics", () => {
  it("aggregates active enrollment, receivables, revenue, expenses, and profit", () => {
    const metrics = calculateDashboardMetrics(
      {
        students: [{ status: "ACTIVE" }, { status: "INACTIVE" }, { status: "ACTIVE" }],
        families: [{ status: "ACTIVE" }, { status: "INACTIVE" }],
        enrollments: [
          { status: "ACTIVE", remainingCents: 2500 },
          { status: "PAUSED", remainingCents: 12000 },
          { status: "ENDED", remainingCents: 3000 },
        ],
        payments: [
          { totalAmountCents: 7500, paymentDate: new Date("2026-06-10T00:00:00Z"), voidedAt: null },
          { totalAmountCents: 8000, paymentDate: new Date("2026-06-12T00:00:00Z"), voidedAt: null },
          { totalAmountCents: 3000, paymentDate: new Date("2026-06-13T00:00:00Z"), voidedAt: new Date("2026-06-14T00:00:00Z") },
          { totalAmountCents: 12000, paymentDate: new Date("2026-05-20T00:00:00Z"), voidedAt: null },
        ],
        expenses: [
          { amountCents: 4000, expenseDate: new Date("2026-06-11T00:00:00Z") },
          { amountCents: 1000, expenseDate: new Date("2026-05-11T00:00:00Z") },
        ],
      },
      new Date("2026-06-29T00:00:00Z"),
    );

    expect(metrics).toEqual({
      totalStudents: 2,
      totalFamilies: 1,
      outstandingBalanceCents: 14500,
      monthlyRevenueCents: 15500,
      monthlyExpensesCents: 4000,
      netProfitCents: 11500,
    });
  });
});

describe("formatCurrency", () => {
  it("formats cents as US dollars", () => {
    expect(formatCurrency(123456)).toBe("$1,234.56");
  });
});
