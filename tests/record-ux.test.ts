import { describe, expect, it } from "vitest";
import { navSections } from "@/components/records/sidebar-nav";
import { canViewNavigationItem } from "@/lib/auth/navigation";
import { canDeleteFamily, canDeletePayment, canDeleteReceipt, canPermanentlyDeleteExpense } from "@/lib/deletion-policy";
import { filtersForReport, sanitizeReportQuery } from "@/lib/reports/filter-config";

describe("record deletion UX policy", () => {
  it.each(["RECEPTION", "ADMIN", "SUPER_ADMIN"] as const)("%s can delete eligible expenses", () => {
    expect(canPermanentlyDeleteExpense({ archivedAt: null, shift: { status: "OPEN" } }).allowed).toBe(true);
  });
  it("blocks closed-shift expenses", () => {
    expect(canPermanentlyDeleteExpense({ shift: { status: "CLOSED" } })).toMatchObject({ allowed: false });
  });
  it("never allows payment or receipt delete", () => {
    expect(canDeletePayment().allowed).toBe(false);
    expect(canDeleteReceipt().allowed).toBe(false);
  });
  it("explains used family dependencies", () => {
    expect(canDeleteFamily({ archived: true, students: 2, payments: 3 }).reason).toBe("This family cannot be deleted because it has 2 students and 3 payments.");
  });
});

describe("sidebar", () => {
  it("has no duplicate hrefs", () => {
    const hrefs = navSections.flatMap((s) => s.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
  it("preserves role visibility", () => {
    expect(canViewNavigationItem("RECEPTION", "/payments")).toBe(true);
    expect(canViewNavigationItem("RECEPTION", "/users")).toBe(false);
    expect(canViewNavigationItem("SUPER_ADMIN", "/settings/production-reset")).toBe(true);
  });
});

describe("report filters", () => {
  it("changes filters by report type", () => {
    expect(filtersForReport("revenue")).toContain("receiptNumber");
    expect(filtersForReport("season-closing")).toEqual(["seasonId"]);
    expect(filtersForReport("expenses")).not.toContain("teacherId");
  });
  it("removes irrelevant filters from query string", () => {
    expect(sanitizeReportQuery("season-closing", { report: "season-closing", seasonId: "s1", teacherId: "t1", dateFrom: "2026-01-01" })).toEqual({ report: "season-closing", seasonId: "s1" });
  });
  it("supports reset filters by keeping only selected report", () => {
    expect(sanitizeReportQuery("revenue", { report: "revenue", category: "Rent" })).toEqual({ report: "revenue" });
  });
});
