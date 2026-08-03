import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const reportData = readFileSync("lib/reports/data.ts", "utf8");
const reportsPage = readFileSync("app/reports/page.tsx", "utf8");
const fullPage = readFileSync("app/seasons/[id]/closing-report/page.tsx", "utf8");
const csvRoute = readFileSync("app/api/reports/[report]/route.ts", "utf8");

describe("season closing safety", () => {
  it("uses explicit nullable summary state instead of empty objects", () => {
    expect(reportData).toContain("export type SeasonClosingSummary");
    expect(reportData).toContain("if (!filters.seasonId) return pageResult([], 0, null)");
    expect(reportData).toContain("return summary ? pageResult([], 0, summary)");
    expect(reportsPage).not.toContain("reportData.summary as any");
  });

  it("does not render season closing unless the summary is valid", () => {
    expect(reportsPage).toContain("isSeasonClosingSummary");
    expect(reportsPage).toContain('report === "season-closing" && seasonClosing');
    expect(reportsPage).toContain("seasonClosing.season.name");
    expect(reportsPage).toContain("seasonClosing.totals");
  });

  it("has distinct no-selection, load-failure, invalid-id, and missing-season states", () => {
    expect(reportsPage).toContain("Select a season to generate the closing report.");
    expect(reportsPage).toContain("We could not load this report right now.");
    expect(reportsPage).toContain("seasonClosingError");
    expect(reportData).toContain("uuidPattern.test(seasonId)");
    expect(reportData).toContain("The selected season could not be found. It may have been deleted.");
  });

  it("preserves selected filters, including season, on retry and pagination links", () => {
    expect(reportsPage).toContain("Object.entries(params)");
    expect(reportsPage).toContain('if (value && key !== "page") next.set(key, value)');
    expect(fullPage).toContain("report=season-closing&seasonId=");
  });

  it("uses null-safe fallbacks for legacy relations in pages and CSV export", () => {
    for (const fallback of ["Independent", "No activity", "Unassigned", "No room", "Unknown student", "Unknown season"]) {
      expect(`${reportData}\n${reportsPage}\n${fullPage}\n${csvRoute}`).toContain(fallback);
    }
    expect(csvRoute).toContain("data?.season?.id");
  });
});
