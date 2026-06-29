import { describe, expect, it } from "vitest";
import { calculateDashboardMetrics, formatCurrency } from "@/lib/dashboard/metrics";

describe("calculateDashboardMetrics", () => {
  it("aggregates active enrollment, receivables, revenue, expenses, and profit", () => {
    const metrics = calculateDashboardMetrics(
      {
        students: [{ status: "ACTIVE" }, { status: "INACTIVE" }, { status: "ACTIVE" }],
        families: [{ status: "ACTIVE" }, { status: "INACTIVE" }],
        invoices: [
          { status: "SENT", totalCents: 10000, balanceCents: 2500, issuedAt: new Date("2026-06-10T00:00:00Z") },
          { status: "PAID", totalCents: 8000, balanceCents: 0, issuedAt: new Date("2026-06-12T00:00:00Z") },
          { status: "VOID", totalCents: 3000, balanceCents: 3000, issuedAt: new Date("2026-06-13T00:00:00Z") },
          { status: "SENT", totalCents: 12000, balanceCents: 12000, issuedAt: new Date("2026-05-20T00:00:00Z") },
        ],
        expenses: [
          { amountCents: 4000, incurredAt: new Date("2026-06-11T00:00:00Z") },
          { amountCents: 1000, incurredAt: new Date("2026-05-11T00:00:00Z") },
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
