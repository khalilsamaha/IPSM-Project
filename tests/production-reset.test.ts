import { describe, expect, it } from "vitest";
import { getProductionResetPlan, hasProductionResetSelection, type ProductionResetSelection } from "@/lib/production-reset";

const empty: ProductionResetSelection = { operationalData: false, financialData: false, scheduleData: false, studentsFamilies: false, teachers: false, seasons: false };

describe("production reset planning", () => {
  it("requires at least one selected scope", () => {
    expect(hasProductionResetSelection(empty)).toBe(false);
    expect(hasProductionResetSelection({ ...empty, financialData: true })).toBe(true);
  });

  it("deletes financial records in dependency-safe order", () => {
    expect(getProductionResetPlan({ ...empty, financialData: true })).toEqual(["receipt", "paymentItem", "payment", "expense"]);
  });

  it("adds dependent records before deleting students and families", () => {
    expect(getProductionResetPlan({ ...empty, studentsFamilies: true })).toEqual(["receipt", "paymentItem", "payment", "scheduleSession", "enrollment", "student", "family"]);
  });

  it("removes teacher and season dependencies before parent records", () => {
    expect(getProductionResetPlan({ ...empty, teachers: true, seasons: true })).toEqual(["scheduleSession", "enrollment", "teacherAvailability", "teacherCourse", "teacher", "season"]);
  });
});
