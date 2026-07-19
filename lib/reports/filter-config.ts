export const reportTypes = ["revenue", "expenses", "profit-loss", "outstanding", "season-closing", "course-enrollment", "teacher-schedule", "room-utilization", "payroll"] as const;
export type ReportType = (typeof reportTypes)[number];

export const reportDescriptions: Record<ReportType, string> = {
  revenue: "Payments received during the selected period.",
  expenses: "School expenses recorded during the selected period.",
  "profit-loss": "Revenue minus expenses for the selected period.",
  outstanding: "Remaining student and family balances by season.",
  "season-closing": "Season-only closing totals and carry-forward balances.",
  "course-enrollment": "Enrollment counts by instrument, level, teacher and season.",
  "teacher-schedule": "Teacher schedules and availability for the selected period.",
  "room-utilization": "Room usage by schedule, teacher and date range.",
  payroll: "Teacher payroll totals by teacher, period and status.",
};

export const reportFilters: Record<ReportType, readonly string[]> = {
  revenue: ["dateFrom", "dateTo", "seasonId", "familyId", "studentId", "paymentMethod", "receiptNumber"],
  expenses: ["dateFrom", "dateTo", "seasonId", "category", "paymentMethod", "includeArchived"],
  "profit-loss": ["dateFrom", "dateTo", "seasonId", "includeArchived"],
  outstanding: ["seasonId", "familyId", "studentId", "studentCode", "courseId", "levelId", "paymentStatus"],
  "season-closing": ["seasonId"],
  "course-enrollment": ["seasonId", "courseId", "levelId", "teacherId"],
  "teacher-schedule": ["seasonId", "teacherId", "dateFrom", "dateTo", "roomId"],
  "room-utilization": ["seasonId", "roomId", "dateFrom", "dateTo", "teacherId"],
  payroll: ["teacherId", "dateFrom", "dateTo", "payrollStatus"],
};

export function filtersForReport(report: ReportType) { return reportFilters[report]; }
export function sanitizeReportQuery(report: ReportType, params: Record<string, string | undefined>) {
  const allowed = new Set(["report", ...reportFilters[report], "page"]);
  return Object.fromEntries(Object.entries(params).filter(([key, value]) => allowed.has(key) && value));
}
