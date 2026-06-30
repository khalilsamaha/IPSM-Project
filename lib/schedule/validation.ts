import { z } from "zod";

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
  teacherId: z.string().uuid({ message: "Teacher is required" }),
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
