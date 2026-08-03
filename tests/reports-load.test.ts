import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("reports production loading", () => {
  const page = readFileSync("app/reports/page.tsx", "utf8");
  const data = readFileSync("lib/reports/data.ts", "utf8");

  it("loads only lookups, dashboard aggregates, and the selected detailed report", () => {
    expect(page).toContain("getReportDashboardSummary(params)");
    expect(page).toContain("loadReport(report, params, { skip, take }, dashboard)");
    expect(page).toContain("getShiftClosureReport(params, { skip, take })");
    expect(page).not.toContain("getRevenueReport(params), getOutstandingReport(params)");
  });

  it("uses database counts and pagination for detailed reports", () => {
    expect(data).toContain("export async function loadReport");
    expect(data).toContain("prisma.payment.count");
    expect(data).toContain("prisma.enrollment.count");
    expect(data).toContain("skip: pagination.skip");
    expect(data).toContain("take: pagination.take");
  });

  it("renders nullable report relations with safe fallbacks", () => {
    expect(page).toContain('"No season"');
    expect(page).toContain('"No activity"');
    expect(page).toContain('row.teacher?.fullName ?? "—"');
    expect(page).not.toContain('"Independent"');
  });
});
