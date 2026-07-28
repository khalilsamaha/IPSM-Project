import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { formatDate } from "@/lib/records/format";
import { formatPaymentMethod } from "@/lib/payment-methods";
import { getCourseEnrollmentReport, getExpenseReport, getOutstandingReport, getProfitLossReport, getRevenueReport, getRoomUtilizationReport, getSeasonClosingReport, getTeacherScheduleAvailabilityReport, type ReportFilters } from "@/lib/reports/data";

const headers: Record<string, string[]> = {
  revenue: ["date", "family", "payment_method", "receipt_number", "seasons", "courses", "total_cents"],
  outstanding: ["family", "student_id", "student", "season", "course", "level", "teacher", "remaining_cents"],
  expenses: ["date", "category", "description", "payment_method", "amount_cents", "status"],
  "profit-loss": ["revenue_cents", "expense_cents", "net_cents"],
  "season-closing": ["section", "name", "count", "amount_due_cents", "paid_cents", "outstanding_cents", "completed", "cancelled", "missed"],
  "course-enrollment": ["season", "course", "level", "enrollments", "students", "families", "final_fee_cents", "paid_cents", "outstanding_cents"],
  "teacher-schedule": ["teacher", "availability_blocks", "scheduled_sessions", "completed_sessions", "rooms"],
  "room-utilization": ["room", "capacity", "scheduled_sessions", "completed_sessions", "cancelled_sessions", "teachers"],
};

function csvEscape(value: unknown) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function toCsv(rows: unknown[][], header: string[]) { return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n"); }

export async function GET(request: NextRequest, { params }: { params: Promise<{ report: string }> }) {
  const session = await requireSession();
  if (!hasPermission(session.role, "reports:read")) return new Response("Forbidden", { status: 403 });
  const { report } = await params;
  if (!(report in headers)) return new Response("Unknown report", { status: 404 });
  const filters = Object.fromEntries(request.nextUrl.searchParams.entries()) as ReportFilters;
  let rows: unknown[][] = [];
  if (report === "revenue") {
    const data = await getRevenueReport(filters);
    rows = data.rows.map((row) => [formatDate(row.paymentDate), `${row.family.familyCode} — ${row.family.name}`, formatPaymentMethod(row.paymentMethod), row.receiptNumber ?? "", Array.from(new Set(row.items.map((item) => item.enrollment?.season?.name ?? "No season"))).join("; "), Array.from(new Set(row.items.map((item) => item.enrollment?.course?.name ?? item.enrollment?.courseName ?? "No activity"))).join("; "), row.reportAmountCents]);
  } else if (report === "outstanding") {
    const data = await getOutstandingReport(filters);
    rows = data.rows.map((row) => [row.student?.family ? `${row.student.family.familyCode} — ${row.student.family.name}` : "Independent", row.student?.studentCode ?? "—", `${row.student?.firstName ?? "Unknown"} ${row.student?.lastName ?? "student"}`, row.season?.name ?? "Unknown season", row.course?.name ?? row.courseName ?? "No activity", row.level?.name ?? "—", row.teacher?.fullName ?? "Unassigned", row.remainingCents]);
  } else if (report === "expenses") {
    const data = await getExpenseReport(filters);
    rows = data.rows.map((row) => [formatDate(row.expenseDate), row.category, row.description, formatPaymentMethod(row.paymentMethod), row.amountCents, row.archivedAt ? "Archived" : "Active"]);
  } else if (report === "profit-loss") {
    const data = await getProfitLossReport(filters); rows = [[data.revenueCents, data.expenseCents, data.netCents]];
  } else if (report === "season-closing") {
    if (!filters.seasonId) return new Response("seasonId is required", { status: 400 });
    const data = await getSeasonClosingReport(filters.seasonId);
    if (!data?.season?.id || !data.totals) return new Response("The selected season could not be found. It may have been deleted.", { status: 404 });
    rows = [["totals", "students", data.totals.students, "", "", "", "", "", ""], ["totals", "families", data.totals.families, "", "", "", "", "", ""], ["totals", "previous_unpaid", "", "", "", data.totals.previousOutstandingCents, "", "", ""], ["totals", "enrollments", data.totals.enrollments, data.totals.paymentsReceivedCents + data.totals.outstandingCents, data.totals.paymentsReceivedCents, data.totals.outstandingCents, data.totals.completedSessions, data.totals.cancelledSessions, data.totals.missedSessions], ...data.courses.map((row) => ["course", row.course, row.enrollments, row.amountDueCents, row.paidCents, row.outstandingCents, "", "", ""]), ...data.teachers.map((row) => ["teacher", row.teacher, row.enrollments, "", "", "", row.completedSessions, row.cancelledSessions, row.missedSessions]), ...data.unpaidStudents.map((row) => ["unpaid_student", `${row.studentCode} ${row.student}`, 1, "", "", row.outstandingCents, "", "", ""]), ...data.previousUnpaidStudents.map((row) => ["previous_unpaid_student", `${row.studentCode} ${row.student} (${row.season})`, 1, "", "", row.outstandingCents, "", "", ""] )];
  } else if (report === "course-enrollment") {
    const data = await getCourseEnrollmentReport(filters); rows = data.rows.map((row) => [row.season, row.course, row.level, row.enrollments, row.students, row.families, row.finalFeeCents, row.paidCents, row.outstandingCents]);
  } else if (report === "teacher-schedule") {
    const data = await getTeacherScheduleAvailabilityReport(filters); rows = data.rows.map((row) => [row.teacher, row.availabilityBlocks, row.scheduledSessions, row.completedSessions, row.rooms]);
  } else {
    const data = await getRoomUtilizationReport(filters); rows = data.rows.map((row) => [row.room, row.capacity ?? "", row.scheduledSessions, row.completedSessions, row.cancelledSessions, row.teachers]);
  }
  return new Response(toCsv(rows, headers[report]), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${report}-report.csv"` } });
}
