import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { formatDate } from "@/lib/records/format";
import { getExpenseReport, getOutstandingReport, getProfitLossReport, getRevenueReport, getSeasonClosingReport, getTeacherSalaryReport, type ReportFilters } from "@/lib/reports/data";

const headers: Record<string, string[]> = {
  revenue: ["date", "family", "payment_method", "receipt_number", "seasons", "total_cents"],
  outstanding: ["family", "student_id", "student", "season", "course", "teacher", "remaining_cents"],
  expenses: ["date", "category", "description", "payment_method", "amount_cents", "status"],
  "profit-loss": ["revenue_cents", "expense_cents", "net_cents"],
  "teacher-salaries": ["teacher", "hourly_rate_cents", "assigned_enrollments", "estimated_hours", "estimated_salary_cents", "limitation"],
  "season-closing": ["section", "name", "count", "amount_due_cents", "paid_cents", "outstanding_cents", "completed", "cancelled", "missed"],
};

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: unknown[][], header: string[]) {
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ report: string }> }) {
  const session = await requireSession();
  if (!hasPermission(session.role, "reports:read")) return new Response("Forbidden", { status: 403 });
  const { report } = await params;
  if (!(report in headers)) return new Response("Unknown report", { status: 404 });
  const filters = Object.fromEntries(request.nextUrl.searchParams.entries()) as ReportFilters;
  let rows: unknown[][] = [];
  if (report === "revenue") {
    const data = await getRevenueReport(filters);
    rows = data.rows.map((row) => [formatDate(row.paymentDate), row.family.name, row.paymentMethod, row.receiptNumber ?? "", Array.from(new Set(row.items.map((item) => item.enrollment.season.name))).join("; "), row.totalAmountCents]);
  } else if (report === "outstanding") {
    const data = await getOutstandingReport(filters);
    rows = data.rows.map((row) => [row.student.family?.name ?? "Independent", row.student.studentCode, `${row.student.firstName} ${row.student.lastName}`, row.season.name, row.course?.name ?? row.courseName, row.teacher?.fullName ?? "", row.remainingCents]);
  } else if (report === "expenses") {
    const data = await getExpenseReport(filters);
    rows = data.rows.map((row) => [formatDate(row.expenseDate), row.category, row.description, row.paymentMethod, row.amountCents, row.archivedAt ? "Archived" : "Active"]);
  } else if (report === "profit-loss") {
    const data = await getProfitLossReport(filters);
    rows = [[data.revenueCents, data.expenseCents, data.netCents]];
  } else if (report === "season-closing") {
    if (!filters.seasonId) return new Response("seasonId is required", { status: 400 });
    const data = await getSeasonClosingReport(filters.seasonId);
    rows = [
      ["totals", "students", data.totals.students, "", "", "", "", "", ""],
      ["totals", "families", data.totals.families, "", "", "", "", "", ""],
      ["totals", "enrollments", data.totals.enrollments, data.totals.paymentsReceivedCents + data.totals.outstandingCents, data.totals.paymentsReceivedCents, data.totals.outstandingCents, data.totals.completedSessions, data.totals.cancelledSessions, data.totals.missedSessions],
      ...data.courses.map((row) => ["course", row.course, row.enrollments, row.amountDueCents, row.paidCents, row.outstandingCents, "", "", ""]),
      ...data.teachers.map((row) => ["teacher", row.teacher, row.enrollments, "", "", "", row.completedSessions, row.cancelledSessions, row.missedSessions]),
      ...data.unpaidStudents.map((row) => ["unpaid_student", `${row.studentCode} ${row.student}`, 1, "", "", row.outstandingCents, "", "", ""]),
    ];
  } else {
    const data = await getTeacherSalaryReport(filters);
    rows = data.rows.map((row) => [row.fullName, row.hourlyRateCents, row.enrollments.length, row.estimatedHours ?? "Not tracked", row.estimatedSalaryCents, "Teaching hours are not implemented in the current schema."]);
  }
  return new Response(toCsv(rows, headers[report]), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${report}-report.csv"` } });
}
