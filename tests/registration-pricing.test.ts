import { describe, expect, it } from "vitest";
import { findApplicableCoursePrice } from "@/lib/registration/pricing";

describe("findApplicableCoursePrice", () => {
  const base = { courseId: "course-1", levelId: "level-1" };

  it("finds exact season pricing before fallback", () => {
    const price = findApplicableCoursePrice([
      { ...base, seasonId: null, status: "ACTIVE", price: "100.00" },
      { ...base, seasonId: "season-1", status: "ACTIVE", price: "120.00" },
    ], "course-1", "level-1", "season-1");
    expect(price?.price).toBe("120.00");
  });

  it("falls back to all-seasons pricing", () => {
    const price = findApplicableCoursePrice([{ ...base, seasonId: null, status: "ACTIVE", price: "100.00" }], "course-1", "level-1", "season-2");
    expect(price?.price).toBe("100.00");
  });

  it("ignores archived pricing", () => {
    const price = findApplicableCoursePrice([{ ...base, seasonId: "season-1", status: "ARCHIVED", price: "120.00" }], "course-1", "level-1", "season-1");
    expect(price).toBeUndefined();
  });

  it("returns undefined when no pricing matches", () => {
    const price = findApplicableCoursePrice([{ courseId: "other", levelId: "level-1", seasonId: null, status: "ACTIVE", price: "100.00" }], "course-1", "level-1", "season-1");
    expect(price).toBeUndefined();
  });
});
