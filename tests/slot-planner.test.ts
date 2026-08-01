import { describe, expect, it } from "vitest";
import {
  buildRecurringSlotPlan,
  buildTeacherSeasonCapacity,
  buildTeacherWeekCapacity,
  splitTeachingWindow,
  type SlotBooking,
  type SlotRule,
} from "@/lib/schedule/slot-planner";

const rule = (overrides: Partial<SlotRule> = {}): SlotRule => ({
  id: "rule-1",
  teacherId: "teacher-1",
  courseId: "course-1",
  courseName: "Piano",
  seasonId: "season-1",
  dayOfWeek: 3,
  startTime: "09:00",
  endTime: "10:30",
  effectiveFrom: "2026-06-10",
  effectiveTo: "2026-09-23",
  ...overrides,
});

const booking = (overrides: Partial<SlotBooking> = {}): SlotBooking => ({
  id: "booking-1",
  teacherId: "teacher-1",
  studentId: "student-1",
  date: "2026-06-17",
  startTime: "09:30",
  endTime: "10:00",
  status: "SCHEDULED",
  studentName: "Jad Dagher",
  familyName: "Dagher Family",
  courseName: "Piano",
  levelName: "Beginner",
  roomName: "Room 1",
  ...overrides,
});

describe("30-minute teaching slots", () => {
  it("splits a teacher window into exact 30-minute cards", () => {
    expect(splitTeachingWindow("09:00", "10:30")).toEqual([
      { startTime: "09:00", endTime: "09:30" },
      { startTime: "09:30", endTime: "10:00" },
      { startTime: "10:00", endTime: "10:30" },
    ]);
  });

  it("marks an entire recurring slot booked when one weekly occurrence conflicts", () => {
    const plan = buildRecurringSlotPlan({
      teacherId: "teacher-1",
      courseId: "course-1",
      seasonId: "season-1",
      seasonStart: "2026-06-10",
      seasonEnd: "2026-09-26",
      requestedStart: "2026-06-10",
      requestedEnd: "2026-09-26",
      rules: [rule()],
      bookings: [booking()],
    });
    expect(plan.slots.map((slot) => [slot.startTime, slot.status])).toEqual([
      ["09:00", "AVAILABLE"],
      ["09:30", "BOOKED"],
      ["10:00", "AVAILABLE"],
    ]);
    expect(plan.slots[1].conflicts[0]).toMatchObject({
      studentName: "Jad Dagher",
      date: "2026-06-17",
    });
  });

  it("skips school closures without making the recurring slot unavailable", () => {
    const plan = buildRecurringSlotPlan({
      teacherId: "teacher-1",
      courseId: "course-1",
      seasonId: "season-1",
      seasonStart: "2026-06-10",
      seasonEnd: "2026-06-24",
      requestedStart: "2026-06-10",
      requestedEnd: "2026-06-24",
      rules: [rule({ effectiveTo: "2026-06-24" })],
      bookings: [],
      closures: [{ startDate: "2026-06-17", endDate: "2026-06-17", name: "Holiday" }],
    });
    expect(plan.slots[0]).toMatchObject({
      status: "AVAILABLE",
      occurrenceCount: 2,
      closureCount: 1,
    });
  });
});

describe("teacher capacity views", () => {
  it("shows student details in the selected week", () => {
    const week = buildTeacherWeekCapacity({
      teacherId: "teacher-1",
      weekStart: "2026-06-15",
      seasonStart: "2026-06-10",
      seasonEnd: "2026-09-26",
      rules: [rule()],
      bookings: [booking()],
    });
    const wednesday = week.find((day) => day.date === "2026-06-17");
    expect(wednesday?.slots.find((slot) => slot.startTime === "09:30")).toMatchObject({
      status: "BOOKED",
      bookings: [{ studentName: "Jad Dagher" }],
    });
  });

  it("calculates season capacity in 30-minute session units", () => {
    const summary = buildTeacherSeasonCapacity({
      teacherId: "teacher-1",
      seasonStart: "2026-06-10",
      seasonEnd: "2026-06-24",
      rules: [rule({ endTime: "10:00", effectiveTo: "2026-06-24" })],
      bookings: [booking()],
    });
    expect(summary.totalSlots).toBe(6);
    expect(summary.bookedSlots).toBe(1);
    expect(summary.availableSlots).toBe(5);
  });
});
