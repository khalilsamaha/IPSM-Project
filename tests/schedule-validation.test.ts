import { describe, expect, it } from "vitest";
import { getAvailableGaps, remainingHours, scheduleSessionSchema, teacherAvailabilitySchema, timeWindowsOverlap, totalAvailableHours } from "@/lib/schedule/validation";

describe("schedule validation", () => {
  it("rejects sessions whose end time is not after start time", () => {
    const result = scheduleSessionSchema.safeParse({ studentId: "20000000-0000-0000-0000-000000000001", teacherId: "80000000-0000-0000-0000-000000000001", enrollmentId: "", seasonId: "", title: "Piano", sessionDate: "2026-06-15", startTime: "11:00", endTime: "10:00", status: "SCHEDULED", notes: "" });
    expect(result.success).toBe(false);
  });

  it("accepts optional room ids on schedule sessions", () => {
    const result = scheduleSessionSchema.safeParse({ studentId: "20000000-0000-0000-0000-000000000001", teacherId: "80000000-0000-0000-0000-000000000001", roomId: "", enrollmentId: "", seasonId: "", title: "Piano", sessionDate: "2026-06-15", startTime: "10:00", endTime: "11:00", status: "SCHEDULED", notes: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.roomId).toBeNull();
  });

  it("detects overlapping time windows", () => {
    expect(timeWindowsOverlap({ startTime: "10:00", endTime: "11:00" }, { startTime: "10:30", endTime: "11:30" })).toBe(true);
    expect(timeWindowsOverlap({ startTime: "10:00", endTime: "11:00" }, { startTime: "11:00", endTime: "12:00" })).toBe(false);
  });

  it("returns teacher availability gaps around booked sessions", () => {
    expect(getAvailableGaps([{ startTime: "10:00", endTime: "11:00" }], "09:00", "12:00")).toEqual([{ startTime: "09:00", endTime: "10:00" }, { startTime: "11:00", endTime: "12:00" }]);
  });

  it("validates teacher availability and calculates remaining hours", () => {
    const result = teacherAvailabilitySchema.safeParse({ teacherId: "80000000-0000-0000-0000-000000000001", dayOfWeek: "3", startTime: "10:00", endTime: "15:00", seasonId: "", effectiveFrom: "", effectiveTo: "", status: "ACTIVE", notes: "" });
    expect(result.success).toBe(true);
    expect(totalAvailableHours([{ startTime: "10:00", endTime: "15:00" }])).toBe(5);
    expect(remainingHours([{ startTime: "10:00", endTime: "15:00" }], [{ startTime: "11:00", endTime: "12:30" }])).toBe(3.5);
  });
});
