import { describe, expect, it } from "vitest";
import {
  emptyProductionResetSelection,
  getProductionResetPlan,
  hasProductionResetSelection,
  type ProductionResetSelection,
} from "@/lib/production-reset";

function selection(
  patch: Partial<ProductionResetSelection>,
): ProductionResetSelection {
  return { ...emptyProductionResetSelection, ...patch };
}

describe("production reset planning", () => {
  it("requires at least one selected scope", () => {
    expect(hasProductionResetSelection(emptyProductionResetSelection)).toBe(false);
    expect(hasProductionResetSelection(selection({ financialData: true }))).toBe(true);
  });

  it("deletes every blocker before enrollments, teachers, students, families, and seasons", () => {
    const plan = getProductionResetPlan(selection({
      operationalData: true,
      financialData: true,
      scheduleData: true,
      studentsFamilies: true,
      teachers: true,
      seasons: true,
    }));

    expect(plan).toEqual([
      "receipt",
      "paymentItem",
      "payment",
      "expense",
      "cashierShift",
      "teacherPayrollItem",
      "teacherPayroll",
      "scheduleSession",
      "schedulePattern",
      "registrationAttempt",
      "enrollment",
      "teacherAvailability",
      "teacherCourse",
      "teacher",
      "student",
      "family",
      "coursePricingSeasonScoped",
      "season",
    ]);
    expect(plan.indexOf("schedulePattern")).toBeLessThan(plan.indexOf("enrollment"));
    expect(plan.indexOf("teacherPayrollItem")).toBeLessThan(plan.indexOf("scheduleSession"));
    expect(plan.indexOf("registrationAttempt")).toBeLessThan(plan.indexOf("student"));
    expect(plan.indexOf("registrationAttempt")).toBeLessThan(plan.indexOf("family"));
  });

  it("deletes complete financial records in dependency-safe order", () => {
    expect(getProductionResetPlan(selection({ financialData: true }))).toEqual([
      "receipt",
      "paymentItem",
      "payment",
      "expense",
      "cashierShift",
      "teacherPayrollItem",
      "teacherPayroll",
    ]);
  });

  it("removes payroll dependencies when schedule data is reset", () => {
    expect(getProductionResetPlan(selection({ scheduleData: true }))).toEqual([
      "teacherPayrollItem",
      "teacherPayroll",
      "scheduleSession",
      "schedulePattern",
    ]);
  });

  it("removes season-scoped configuration instead of converting it to global data", () => {
    expect(getProductionResetPlan(selection({ seasons: true }))).toEqual([
      "receipt",
      "paymentItem",
      "payment",
      "teacherPayrollItem",
      "teacherPayroll",
      "scheduleSession",
      "schedulePattern",
      "registrationAttempt",
      "enrollment",
      "teacherAvailabilitySeasonScoped",
      "coursePricingSeasonScoped",
      "season",
    ]);
  });
});
