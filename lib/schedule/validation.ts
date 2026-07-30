import { z } from "zod";

export const roomStatuses = ["ACTIVE", "ARCHIVED"] as const;
export const teacherAvailabilityStatuses = ["ACTIVE", "ARCHIVED"] as const;

export const scheduleStatuses = ["SCHEDULED", "COMPLETED", "CANCELLED", "MISSED"] as const;
export type ScheduleStatus = (typeof scheduleStatuses)[number];

export type TimeWindow = { startTime: string; endTime: string };

export function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function timeWindowsOverlap(a: TimeWindow, b: TimeWindow) {
  return minutesFromTime(a.startTime) < minutesFromTime(b.endTime) && minutesFromTime(b.startTime) < minutesFromTime(a.endTime);
}

export const scheduleSessionSchema = z.object({
  id: z.string().uuid().optional(),
  studentId: z.string().uuid({ message: "Student is required" }),
  teacherId: z.string().uuid().or(z.literal("")).optional().transform((value) => value || undefined),
  roomId: z.string().uuid().or(z.literal("")).optional().transform((value) => value || null),
  enrollmentId: z.string().uuid().or(z.literal("")).transform((value) => value || null),
  seasonId: z.string().uuid().or(z.literal("")).transform((value) => value || null),
  title: z.string().trim().optional().transform((value) => value || null),
  sessionDate: z.string().min(1, "Date is required").transform((value) => new Date(value)),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Start time is required"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "End time is required"),
  status: z.enum(scheduleStatuses),
  notes: z.string().trim().optional().transform((value) => value || null),
}).refine((value) => minutesFromTime(value.endTime) > minutesFromTime(value.startTime), { message: "End time must be after start time", path: ["endTime"] });

export function getAvailableGaps(bookings: TimeWindow[], dayStart = "08:00", dayEnd = "20:00") {
  const sorted = bookings.slice().sort((a, b) => minutesFromTime(a.startTime) - minutesFromTime(b.startTime));
  const gaps: TimeWindow[] = [];
  let cursor = dayStart;
  for (const booking of sorted) {
    if (minutesFromTime(booking.startTime) > minutesFromTime(cursor)) gaps.push({ startTime: cursor, endTime: booking.startTime });
    if (minutesFromTime(booking.endTime) > minutesFromTime(cursor)) cursor = booking.endTime;
  }
  if (minutesFromTime(cursor) < minutesFromTime(dayEnd)) gaps.push({ startTime: cursor, endTime: dayEnd });
  return gaps;
}


export function hoursForWindow(window: TimeWindow) {
  return Math.max(0, (minutesFromTime(window.endTime) - minutesFromTime(window.startTime)) / 60);
}

export function totalAvailableHours(windows: TimeWindow[]) {
  return windows.reduce((sum, window) => sum + hoursForWindow(window), 0);
}

export function bookedHours(bookings: TimeWindow[]) {
  return totalAvailableHours(bookings);
}

export function remainingHours(availability: TimeWindow[], bookings: TimeWindow[]) {
  return Math.max(0, totalAvailableHours(availability) - bookedHours(bookings));
}

export const roomSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Room name is required"),
  capacity: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  description: z.string().trim().optional().transform((value) => value || null),
  status: z.enum(roomStatuses),
});

export const teacherAvailabilitySchema = z.object({
  id: z.string().uuid().optional(),
  teacherId: z.string().uuid().or(z.literal("")).optional().transform((value) => value || undefined),
  courseId: z.string().uuid().or(z.literal("")).optional().transform((value) => value || null),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Start time is required"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "End time is required"),
  seasonId: z.string().uuid().or(z.literal("")).optional().transform((value) => value || null),
  effectiveFrom: z.string().optional().transform((value) => value ? new Date(value) : null),
  effectiveTo: z.string().optional().transform((value) => value ? new Date(value) : null),
  status: z.enum(teacherAvailabilityStatuses),
  notes: z.string().trim().optional().transform((value) => value || null),
}).refine((value) => minutesFromTime(value.endTime) > minutesFromTime(value.startTime), { message: "End time must be after start time", path: ["endTime"] })
  .refine((value) => !value.effectiveFrom || !value.effectiveTo || value.effectiveTo >= value.effectiveFrom, { message: "Effective to must be after effective from", path: ["effectiveTo"] });
