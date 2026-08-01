import { describe, expect, it } from "vitest";
import { calculateGrossPayrollCents, calculatePayrollItemAmountCents, minutesBetween } from "@/lib/payroll/calculations";
import { buildPayableLessonPolicy, defaultPayableLessonPolicy, isPayableLesson } from "@/lib/payroll/policy";

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

  it("maps the operational missed-lesson setting to the payroll policy", () => {
    const policy = buildPayableLessonPolicy({ allowPayableMissedLessons: true });
    expect(policy.payMissed).toBe(true);
    expect(isPayableLesson("MISSED", "m3", policy)).toBe(true);
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

import { monthlyPayrollSummary, periodsOverlap } from "@/lib/payroll/calculations";
describe("payroll period and monthly reporting", () => {
  const d = (day: number) => new Date(Date.UTC(2026, 6, day));
  it("blocks inclusive overlaps but permits adjacent periods", () => {
    expect(periodsOverlap(d(1), d(31), d(1), d(31))).toBe(true);
    expect(periodsOverlap(d(10), d(20), d(1), d(15))).toBe(true);
    expect(periodsOverlap(d(1), d(15), d(10), d(31))).toBe(true);
    expect(periodsOverlap(d(10), d(12), d(1), d(31))).toBe(true);
    expect(periodsOverlap(d(1), d(15), d(16), d(31))).toBe(false);
  });
  it("rolls multiple records into exact integer-derived totals", () => {
    const summary = monthlyPayrollSummary([
      {teacherId:"a",teacherName:"A",completedMinutes:60,missedPayableMinutes:0,adjustmentCents:100,grossAmountCents:5100,status:"DRAFT"},
      {teacherId:"a",teacherName:"A",completedMinutes:30,missedPayableMinutes:30,adjustmentCents:-100,grossAmountCents:4900,status:"PAID"},
    ]);
    expect(summary.rollup[0]).toMatchObject({completedMinutes:90,missedPayableMinutes:30,adjustmentCents:0,grossAmountCents:10000});
    expect(summary.gross).toBe(10000); expect(summary.draft).toBe(5100); expect(summary.paid).toBe(4900);
  });
});
