import { describe, expect, it } from "vitest";
import { generateWeeklyDates } from "@/lib/schedule/recurring";
import { weeklyTeacherTotals, windowApplies } from "@/lib/schedule/weekly-availability";

const date = (value: string) => new Date(`${value}T00:00:00Z`);
describe("recurring weekly date generation", () => {
  const limits = { enrollmentStart: date("2026-09-01"), enrollmentEnd: date("2027-06-30"), seasonStart: date("2026-09-10"), seasonEnd: date("2027-07-15") };
  it("starts on the next selected weekday and includes an end boundary", () => { expect(generateWeeklyDates({ dayOfWeek: 2, startsOn: date("2026-09-10"), endsOn: date("2026-09-29") }, limits).map((d) => d.toISOString().slice(0, 10))).toEqual(["2026-09-15", "2026-09-22", "2026-09-29"]); });
  it("includes a start date which is the selected weekday", () => { expect(generateWeeklyDates({ dayOfWeek: 2, startsOn: date("2026-09-15"), endsOn: date("2026-09-15") }, limits)).toHaveLength(1); });
  it("intersects enrollment and season boundaries", () => { expect(generateWeeklyDates({ dayOfWeek: 2, startsOn: date("2026-08-01"), endsOn: date("2027-08-01") }, limits).at(0)?.toISOString().slice(0, 10)).toBe("2026-09-15"); expect(generateWeeklyDates({ dayOfWeek: 2, startsOn: date("2026-08-01"), endsOn: date("2027-08-01") }, limits).at(-1)?.toISOString().slice(0, 10)).toBe("2027-06-29"); });
});

describe("weekly availability calculations", () => {
  const windows = [{ teacherId: "t1", dayOfWeek: 2, startTime: "09:00", endTime: "12:00", seasonId: "s1", effectiveFrom: date("2026-09-01"), effectiveTo: date("2026-12-31") }, { teacherId: "t1", dayOfWeek: 2, startTime: "14:00", endTime: "16:00" }];
  it("supports multiple windows and season/effective ranges", () => { expect(windowApplies(windows[0], date("2026-09-15"), "s1")).toBe(true); expect(windowApplies(windows[0], date("2027-01-05"), "s1")).toBe(false); });
  it("reports available, booked and remaining hours", () => { expect(weeklyTeacherTotals(windows, [{ teacherId: "t1", sessionDate: date("2026-09-15"), startTime: "10:00", endTime: "11:00" }])).toEqual({ available: 5, booked: 1, remaining: 4 }); });
});
