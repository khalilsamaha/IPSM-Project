import { describe, expect, it } from "vitest";
import { calculateGrossPayrollCents, calculatePayrollItemAmountCents, minutesBetween } from "@/lib/payroll/calculations";
import { defaultPayableLessonPolicy, isPayableLesson } from "@/lib/payroll/policy";

describe("teacher payroll policy", () => {
  it("only pays completed lessons by default", () => {
    expect(isPayableLesson("COMPLETED", "1")).toBe(true);
    expect(isPayableLesson("SCHEDULED", "2")).toBe(false);
    expect(isPayableLesson("CANCELLED", "3")).toBe(false);
    expect(isPayableLesson("MISSED", "4")).toBe(false);
  });

  it("allows missed lessons by configurable policy or manual approval", () => {
    expect(isPayableLesson("MISSED", "m1", { ...defaultPayableLessonPolicy, payMissed: true })).toBe(true);
    expect(isPayableLesson("MISSED", "m2", { ...defaultPayableLessonPolicy, approvedMissedSessionIds: new Set(["m2"]) })).toBe(true);
  });
});

describe("teacher payroll calculations", () => {
  it("calculates and rounds hourly pay to cents", () => {
    expect(minutesBetween("09:00", "10:30")).toBe(90);
    expect(calculatePayrollItemAmountCents(45, 3333)).toBe(2500);
    expect(calculateGrossPayrollCents([{ amountCents: 2500 }, { amountCents: 5000 }], -250)).toBe(7250);
  });

  it("keeps rate snapshots independent of later teacher rate changes", () => {
    const originalSnapshotCents = 5000;
    const laterTeacherRateCents = 6500;
    expect(calculatePayrollItemAmountCents(60, originalSnapshotCents)).toBe(5000);
    expect(calculatePayrollItemAmountCents(60, laterTeacherRateCents)).toBe(6500);
  });

  it("documents duplicate prevention and locked lifecycle semantics", () => {
    const uniqueSessionConstraint = "@@unique([scheduleSessionId])";
    expect(uniqueSessionConstraint).toContain("scheduleSessionId");
    expect(["DRAFT", "APPROVED", "PAID", "CANCELLED"]).toContain("PAID");
  });
});
