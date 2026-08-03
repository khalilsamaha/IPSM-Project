import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { attendanceBlockReason, attendanceTarget } from "@/lib/attendance/policy";

const attendanceAction = readFileSync("actions/attendance.ts", "utf8");
const attendancePage = readFileSync("app/attendance/page.tsx", "utf8");

describe("attendance transition safeguards", () => {
  it("allows scheduled completion and admin correction from cancelled to completed", () => {
    expect(attendanceBlockReason("SCHEDULED", null, "complete")).toBeNull();
    expect(attendanceBlockReason("CANCELLED", null, "complete")).toBeNull();
    expect(attendanceTarget("complete")).toBe("COMPLETED");
    expect(attendanceBlockReason("MISSED", null, "revert")).toBeNull();
  });

  it.each(["DRAFT", "APPROVED", "PAID"] as const)(
    "protects %s payroll-linked sessions",
    (status) => expect(attendanceBlockReason("CANCELLED", status, "complete")).toMatch(/payroll|Paid/),
  );

  it("blocks invalid and duplicate transitions", () => {
    expect(attendanceBlockReason("MISSED", null, "complete")).toMatch(/scheduled or cancelled/);
    expect(attendanceBlockReason("CANCELLED", null, "cancel")).toMatch(/already/);
  });

  it("requires and audits a reason for cancelled-to-completed corrections", () => {
    expect(attendanceAction).toContain("A reason is required to correct a cancelled lesson to completed.");
    expect(attendanceAction).toContain("cancelledToCompleted");
    expect(attendanceAction).toContain("previousStatuses");
  });

  it("redirects failures to a visible attendance alert", () => {
    expect(attendanceAction).toContain('url.searchParams.set("error", attendanceErrorMessage(error))');
    expect(attendancePage).toContain("p.error");
    expect(attendancePage).toContain('role="alert"');
    expect(attendancePage).toContain('aria-live="assertive"');
  });
});
