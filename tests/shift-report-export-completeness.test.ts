import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { renderShiftClosingPdf, wrapShiftExportText } from "@/lib/shifts/export-pdf";
import { describeShiftPaymentAllocations } from "@/lib/shifts/payment-details";
import { StandardFonts } from "pdf-lib";

const { mockFind, mockCount } = vi.hoisted(() => ({ mockFind: vi.fn(), mockCount: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { cashierShift: { findMany: mockFind, count: mockCount } },
}));
import { getAllShiftClosureRows, getShiftClosureReport, summarizeShiftClosures } from "@/lib/reports/shift-closures";

beforeEach(() => { vi.clearAllMocks(); });

describe("complete, read-only shift reporting", () => {
  it("retains student codes, activity/level, seasons and per-enrollment amounts", () => {
    const data = describeShiftPaymentAllocations([
      { amountCents: 1250, enrollment: {
        student: { studentCode: "STU-1", firstName: "Lea", lastName: "Example" },
        courseName: "Piano", course: { name: "Piano" }, level: { name: "Beginner" }, season: { name: "Winter" },
      } },
      { amountCents: 0, enrollment: {
        student: { studentCode: "STU-1", firstName: "Lea", lastName: "Example" },
        courseName: "Theory", course: null, level: null, season: { name: "Winter" },
      } },
    ]);
    expect(data.students).toContain("STU-1");
    expect(data.students.split("STU-1")).toHaveLength(2);
    expect(data.activities).toContain("Piano / Beginner");
    expect(data.activities).toContain("Theory");
    expect(data.seasons).toBe("Winter");
    expect(data.allocations).toContain("USD 12.50");
    expect(data.allocations).toContain("USD 0.00");
  });

  it("creates valid multi-page PDFs without an artificial 70-line cutoff", async () => {
    const pdf = await renderShiftClosingPdf("synthetic-shift", [
      { title: "Summary", lines: ["Opening cash: 1000"] },
      { title: "Payments", lines: Array.from({ length: 275 }, (_, i) =>
        `Receipt SYN-${i + 1}: Synthetic customer | Method: Cash | Allocation details: Piano / Season A | USD 9.00`) },
      { title: "History", lines: ["2026-01-01 | close | Synthetic audit"] },
    ]);
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBeGreaterThan(2);
    for (const page of doc.getPages()) {
      expect(page.getWidth()).toBeCloseTo(595.28, 2);
      expect(page.getHeight()).toBeCloseTo(841.89, 2);
    }
    expect(pdf.length).toBeGreaterThan(2000);
  });

  it("wraps long unbroken strings instead of truncating", async () => {
    const doc = await PDFDocument.create();
    const font = doc.embedStandardFont(StandardFonts.Helvetica);
    const result = wrapShiftExportText("A".repeat(360), font, 8, 100);
    expect(result.length).toBeGreaterThan(5);
    expect(result.join("")).toBe("A".repeat(360));
  });

  it("uses all 270 matching shifts for totals while retaining paged screen rows", async () => {
    const fixture = Array.from({ length: 270 }, (_, i) => ({
      id: `shift-${i}`, businessDate: new Date("2026-11-12"),
      userId: "owner", user: { name: "Synthetic Reception" },
      openedAt: new Date("2026-11-12"), closedAt: new Date("2026-11-12"),
      openingCashCents: 10000, status: "CLOSED",
      declaredCashCents: 10900, differenceCents: 0, varianceReason: null,
      payments: [{ paymentMethod: "cash", totalAmountCents: 1000, voidedAt: null }],
      expenses: [{ paymentMethod: "cash", amountCents: 100, archivedAt: null, category: "Office Supplies" }],
    }));
    mockCount.mockResolvedValue(270);
    mockFind.mockImplementation(async (args: { skip: number; take: number }) =>
      fixture.slice(args.skip, args.skip + args.take));
    const result = await getShiftClosureReport({ shiftStatus: "CLOSED" }, { skip: 25, take: 25 });
    expect(result.rows).toHaveLength(25);
    expect(result.totalRows).toBe(270);
    expect(result.summary.cashPaymentsCents).toBe(270000);
    expect(result.summary.operatingExpenseCents).toBe(27000);
    expect(result.summary.differencesCents).toBe(0);
    const all = await getAllShiftClosureRows({ shiftStatus: "CLOSED" });
    expect(all).toHaveLength(270);
    expect(summarizeShiftClosures(all)).toEqual(result.summary);
    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ take: 250, skip: 0 }));
    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ take: 250, skip: 250 }));
  });

  it("exports every shift rather than the first 25 and avoids the old PDF cutoff", () => {
    const csv = readFileSync("app/api/reports/[report]/route.ts", "utf8");
    const shiftExport = readFileSync("app/api/shifts/[id]/export/route.ts", "utf8");
    expect(csv).toContain("getAllShiftClosureRows(rawFilters)");
    expect(shiftExport).toContain("renderShiftClosingPdf");
    expect(shiftExport).not.toContain(".slice(0, 70)");
    expect(shiftExport).toContain("Allocation details");
  });
});
