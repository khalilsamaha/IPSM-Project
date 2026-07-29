import type { PayrollStatus, ScheduleSessionStatus } from "@prisma/client";

export type AttendanceAction = "complete" | "missed" | "cancel" | "revert";

export function attendanceTarget(action: AttendanceAction): ScheduleSessionStatus {
  return ({ complete: "COMPLETED", missed: "MISSED", cancel: "CANCELLED", revert: "SCHEDULED" } as const)[action];
}

export function attendanceBlockReason(status: ScheduleSessionStatus, payrollStatus: PayrollStatus | null, action: AttendanceAction) {
  if (payrollStatus === "PAID") return "Paid payroll is immutable.";
  if (payrollStatus === "APPROVED") return "Attendance is locked by an approved payroll.";
  if (payrollStatus === "DRAFT") return "Cancel or recalculate the draft payroll first.";
  if (action === "complete" && status !== "SCHEDULED") return "Only scheduled lessons can be completed.";
  if (action === "revert" && status === "SCHEDULED") return "Lesson is already scheduled.";
  if (action !== "revert" && action !== "complete" && status === attendanceTarget(action)) return `Lesson is already ${status.toLowerCase()}.`;
  return null;
}
