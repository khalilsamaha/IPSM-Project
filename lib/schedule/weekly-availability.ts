import { hoursForWindow, timeWindowsOverlap, type TimeWindow } from "@/lib/schedule/validation";

export type AvailabilityWindow = TimeWindow & { teacherId: string; dayOfWeek: number; effectiveFrom?: Date | null; effectiveTo?: Date | null; seasonId?: string | null; archivedAt?: Date | null };
export type DatedBooking = TimeWindow & { teacherId: string; sessionDate: Date };
export function windowApplies(window: AvailabilityWindow, date: Date, seasonId?: string) { return window.dayOfWeek === date.getUTCDay() && (!window.seasonId || window.seasonId === seasonId) && (!window.effectiveFrom || window.effectiveFrom <= date) && (!window.effectiveTo || window.effectiveTo >= date); }
export function weeklyTeacherTotals(windows: AvailabilityWindow[], bookings: DatedBooking[], period?: { from: Date; to: Date }) {
  const available = windows.reduce((sum, window) => sum + hoursForWindow(window), 0);
  const booked = bookings.filter((booking) => (!period || (booking.sessionDate >= period.from && booking.sessionDate <= period.to)) && windows.some((window) => window.teacherId === booking.teacherId && window.dayOfWeek === booking.sessionDate.getUTCDay() && timeWindowsOverlap(window, booking))).reduce((sum, booking) => sum + hoursForWindow(booking), 0);
  return { available, booked, remaining: Math.max(0, available - booked) };
}
