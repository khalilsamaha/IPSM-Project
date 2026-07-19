import { AppShell, Pager, StatusBadge, DataTable } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { formatCurrency, formatDate } from "@/lib/records/format";
import { formatPaymentMethod } from "@/lib/payment-methods";
import { getPagination } from "@/lib/records/pagination";
import { getReportDashboardSummary, getReportLookups, loadReport, missingSeasonMessage, type ReportFilters, type SeasonClosingSummary } from "@/lib/reports/data";
import { logServerError } from "@/lib/server-log";
import { filtersForReport, reportDescriptions } from "@/lib/reports/filter-config";

type ReportSearchParams = ReportFilters & { report?: string; page?: string };
const reports = ["revenue", "expenses", "profit-loss", "outstanding", "season-closing", "course-enrollment", "teacher-schedule", "room-utilization", "payroll"] as const;
type ReportKind = (typeof reports)[number];

function reportTitle(report: ReportKind) {
  return { revenue: "Revenue", expenses: "Expenses", "profit-loss": "Profit / Loss", outstanding: "Outstanding balances", "season-closing": "Season closing", "course-enrollment": "Course enrollment", "teacher-schedule": "Teacher schedule / availability", "room-utilization": "Room utilization", payroll: "Teacher payroll" }[report];
}

function isSeasonClosingSummary(summary: unknown): summary is SeasonClosingSummary {
  return Boolean(summary && typeof summary === "object" && (summary as SeasonClosingSummary).season?.id && (summary as SeasonClosingSummary).totals);
}

function isProfitLossSummary(summary: unknown): summary is { revenueCents: number; expenseCents: number; netCents: number } {
  return Boolean(summary && typeof summary === "object" && "revenueCents" in summary && "expenseCents" in summary && "netCents" in summary);
}

function exportHref(report: ReportKind, params: ReportSearchParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value && key !== "page") query.set(key, value);
  return `/api/reports/${report}?${query.toString()}`;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const params = await searchParams;
  const session = await requireSession();
  if (!hasPermission(session.role, "reports:read")) throw new Error("Not authorized to view reports");
  const report = reports.includes(params.report as ReportKind) ? params.report as ReportKind : "revenue";
  const { page, skip, take } = getPagination(params);
  const lookups = await getReportLookups();
  const dashboard = await getReportDashboardSummary(params);
  let reportData: Awaited<ReturnType<typeof loadReport>>;
  let reportError = false;
  try {
    // loadReport(report, params, { skip, take }) keeps only the selected report loader active.
    reportData = await loadReport(report, params, { skip, take }, dashboard);
  } catch (error) {
    logServerError("reports.load", error, { report, filters: params });
    reportError = true;
    reportData = { rows: [], totalRows: 0, summary: null, errorMessage: report === "season-closing" ? "We could not generate the season closing report. Please try again." : undefined };
  }
  const pagedRows = reportData.rows;
  const totalRows = reportData.totalRows;
  const profitLoss = report === "profit-loss" && isProfitLossSummary(reportData.summary) ? reportData.summary : dashboard;
  const seasonClosing = report === "season-closing" && isSeasonClosingSummary(reportData.summary) ? reportData.summary : null;
  const seasonClosingError = report === "season-closing" && params.seasonId && !seasonClosing ? (reportData.errorMessage ?? missingSeasonMessage) : null;
  const seasonRetryHref = (() => { const next = new URLSearchParams({ report: "season-closing" }); if (params.seasonId) next.set("seasonId", params.seasonId); return `/reports?${next.toString()}`; })();
  const activeFilters = new Set(filtersForReport(report));
  const showFilter = (name: string) => activeFilters.has(name);
  const resetHref = `/reports?report=${report}`;
  const hrefFor = (targetPage: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value && key !== "page") next.set(key, value);
    if (targetPage > 1) next.set("page", String(targetPage));
    return `/reports?${next.toString()}`;
  };

  return <AppShell session={session}>
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div><h2 className="text-2xl font-bold">Reports & Dashboard</h2><p className="text-sm text-muted-foreground">{reportDescriptions[report]}</p></div>
      <a className="rounded bg-primary px-4 py-2 text-center text-white" href={exportHref(report, params)}>Export CSV</a>
    </div>

    <section className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <div className="rounded-xl border bg-white p-4"><p className="text-sm text-muted-foreground">Revenue</p><p className="text-xl font-bold">{formatCurrency(dashboard.revenueCents)}</p></div>
      <div className="rounded-xl border bg-white p-4"><p className="text-sm text-muted-foreground">Outstanding</p><p className="text-xl font-bold">{formatCurrency(dashboard.outstandingCents)}</p></div>
      <div className="rounded-xl border bg-white p-4"><p className="text-sm text-muted-foreground">Expenses</p><p className="text-xl font-bold">{formatCurrency(dashboard.expenseCents)}</p></div>
      <div className="rounded-xl border bg-white p-4"><p className="text-sm text-muted-foreground">Net profit/loss</p><p className="text-xl font-bold">{formatCurrency(dashboard.netCents)}</p></div>
      <div className="rounded-xl border bg-white p-4"><p className="text-sm text-muted-foreground">Payroll</p><p className="text-xl font-bold">{formatCurrency(dashboard.payrollCents)}</p></div>
    </section>

    <form className="mb-4 grid gap-2 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <select className="rounded border p-2" name="report" defaultValue={report}>{reports.map((item) => <option key={item} value={item}>{reportTitle(item)}</option>)}</select>
      {showFilter("dateFrom") ? <input className="rounded border p-2" type="date" name="dateFrom" defaultValue={params.dateFrom} /> : null}
      {showFilter("dateTo") ? <input className="rounded border p-2" type="date" name="dateTo" defaultValue={params.dateTo} /> : null}
      {showFilter("seasonId") ? <select className="rounded border p-2" name="seasonId" defaultValue={params.seasonId ?? ""}><option value="">All seasons</option>{lookups.seasons.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select> : null}
      {showFilter("familyId") ? <select className="rounded border p-2" name="familyId" defaultValue={params.familyId ?? ""}><option value="">All families</option>{lookups.families.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select> : null}
      {showFilter("studentId") ? <select className="rounded border p-2" name="studentId" defaultValue={params.studentId ?? ""}><option value="">All students</option>{lookups.students.map((row) => <option key={row.id} value={row.id}>{row.studentCode} — {row.lastName}, {row.firstName}</option>)}</select> : null}
      {showFilter("teacherId") ? <select className="rounded border p-2" name="teacherId" defaultValue={params.teacherId ?? ""}><option value="">All teachers</option>{lookups.teachers.map((row) => <option key={row.id} value={row.id}>{row.fullName}</option>)}</select> : null}
      {showFilter("courseId") ? <select className="rounded border p-2" name="courseId" defaultValue={params.courseId ?? ""}><option value="">All courses</option>{lookups.courses.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select> : null}
      {showFilter("levelId") ? <select className="rounded border p-2" name="levelId" defaultValue={params.levelId ?? ""}><option value="">All levels</option>{lookups.levels.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select> : null}
      {showFilter("roomId") ? <select className="rounded border p-2" name="roomId" defaultValue={params.roomId ?? ""}><option value="">All rooms</option>{lookups.rooms.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select> : null}
      {showFilter("studentCode") ? <input className="rounded border p-2" name="studentCode" placeholder="Student ID" defaultValue={params.studentCode ?? ""} /> : null}
      {showFilter("paymentStatus") ? <select className="rounded border p-2" name="paymentStatus" defaultValue={params.paymentStatus ?? ""}><option value="">All payment statuses</option><option value="paid">Paid</option><option value="partial">Partially paid</option><option value="unpaid">Unpaid</option><option value="outstanding">Any outstanding</option></select> : null}
      {showFilter("paymentMethod") ? <select className="rounded border p-2" name="paymentMethod" defaultValue={params.paymentMethod ?? ""}><option value="">All payment methods</option>{lookups.paymentMethods.map((row) => <option key={row.paymentMethod} value={row.paymentMethod}>{formatPaymentMethod(row.paymentMethod)}</option>)}</select> : null}
      {showFilter("category") ? <select className="rounded border p-2" name="category" defaultValue={params.category ?? ""}><option value="">All expense categories</option>{lookups.expenseCategories.map((row) => <option key={row.category} value={row.category}>{row.category}</option>)}</select> : null}
      {showFilter("includeArchived") ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="includeArchived" value="1" defaultChecked={params.includeArchived === "1"} /> Include archived expenses</label> : null}
      <button className="rounded bg-primary px-4 py-2 text-white">Apply filters</button><a className="rounded border px-4 py-2 text-center" href={resetHref}>Reset Filters</a>
    </form>

    <h3 className="mb-1 text-xl font-semibold">{reportTitle(report)} Report</h3><p className="mb-3 text-sm text-muted-foreground">{reportDescriptions[report]}</p>
    {reportError && report !== "season-closing" ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-bold">We could not load this report right now.</p><p>Please retry or narrow your filters. Technical details were logged for review.</p><a className="mt-2 inline-flex rounded bg-amber-700 px-3 py-2 text-white" href="/reports">Retry</a></div> : null}
    {report === "profit-loss" ? <div className="rounded-xl border bg-white p-6"><p>Revenue: <strong>{formatCurrency(profitLoss.revenueCents)}</strong></p><p>Expenses: <strong>{formatCurrency(profitLoss.expenseCents)}</strong></p><p>Net: <strong>{formatCurrency(profitLoss.netCents)}</strong></p></div> : null}
    {report === "season-closing" && seasonClosing?.season?.id && seasonClosing?.totals ? <div className="rounded-xl border bg-white p-6"><p>Season: <strong>{seasonClosing.season?.name ?? "Unknown season"}</strong></p><p>Students: <strong>{seasonClosing.totals.students}</strong></p><p>Families: <strong>{seasonClosing.totals.families}</strong></p><p>Enrollments: <strong>{seasonClosing.totals.enrollments}</strong></p><p>Payments: <strong>{formatCurrency(seasonClosing.totals.paymentsReceivedCents)}</strong></p><p>Outstanding: <strong>{formatCurrency(seasonClosing.totals.outstandingCents)}</strong></p><p>Previous season unpaid: <strong>{formatCurrency(seasonClosing.totals.previousOutstandingCents)}</strong></p><p>Expenses: <strong>{formatCurrency(seasonClosing.totals.expenseCents)}</strong></p><p>Profit/loss: <strong>{formatCurrency(seasonClosing.totals.profitLossCents)}</strong></p><p className="mt-3"><a className="text-primary" href={`/seasons/${seasonClosing.season.id}/closing-report`}>Open full closing report</a></p></div> : null}
    {report === "season-closing" && !params.seasonId ? <p className="rounded border bg-amber-50 p-3 text-sm">Select a season to generate the closing report.</p> : null}
    {seasonClosingError ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-bold">{seasonClosingError}</p><a className="mt-2 inline-flex rounded bg-amber-700 px-3 py-2 text-white" href={seasonRetryHref}>Retry</a></div> : null}
    {report !== "profit-loss" && report !== "season-closing" ? <DataTable><thead className="bg-muted"><tr>{report === "revenue" ? <><th className="p-3">Date</th><th>Family</th><th>Method</th><th>Receipt</th><th>Seasons</th><th>Courses</th><th>Total</th></> : report === "outstanding" ? <><th className="p-3">Family</th><th>Student ID</th><th>Student</th><th>Season</th><th>Course</th><th>Level</th><th>Teacher</th><th>Remaining</th></> : report === "expenses" ? <><th className="p-3">Date</th><th>Category</th><th>Description</th><th>Method</th><th>Amount</th><th>Status</th></> : report === "course-enrollment" ? <><th className="p-3">Season</th><th>Course</th><th>Level</th><th>Enrollments</th><th>Students</th><th>Families</th><th>Paid</th><th>Outstanding</th></> : report === "teacher-schedule" ? <><th className="p-3">Teacher</th><th>Availability blocks</th><th>Scheduled sessions</th><th>Completed</th><th>Rooms</th></> : report === "payroll" ? <><th className="p-3">Teacher</th><th>Period</th><th>Lesson hours</th><th>Adjustments</th><th>Total payroll</th><th>Status</th></> : <><th className="p-3">Room</th><th>Capacity</th><th>Scheduled sessions</th><th>Completed</th><th>Cancelled</th><th>Teachers</th></>}</tr></thead><tbody>{pagedRows.map((row: any) => <tr className="border-t" key={row.id}>{report === "revenue" ? <><td className="p-3">{formatDate(row.paymentDate)}</td><td>{row.family ? `${row.family.familyCode} — ${row.family.name}` : "Independent Student"}</td><td>{formatPaymentMethod(row.paymentMethod)}</td><td>{row.receiptNumber ?? "—"}</td><td>{Array.from(new Set(row.items.map((item: any) => item.enrollment?.season?.name ?? "No season"))).join(", ")}</td><td>{Array.from(new Set(row.items.map((item: any) => item.enrollment?.course?.name ?? item.enrollment?.courseName ?? "No activity"))).join(", ")}</td><td>{formatCurrency(row.reportAmountCents)}</td></> : report === "outstanding" ? <><td className="p-3">{row.student?.family ? `${row.student.family.familyCode} — ${row.student.family.name}` : "Independent"}</td><td>{row.student?.studentCode ?? "—"}</td><td>{row.student?.firstName ?? "Unknown"} {row.student?.lastName ?? "student"}</td><td>{row.season?.name ?? "No season"}</td><td>{row.course?.name ?? row.courseName ?? "No activity"}</td><td>{row.level?.name ?? "—"}</td><td>{row.teacher?.fullName ?? "Unassigned"}</td><td>{formatCurrency(row.remainingCents)}</td></> : report === "expenses" ? <><td className="p-3">{formatDate(row.expenseDate)}</td><td>{row.category}</td><td>{row.description}</td><td>{formatPaymentMethod(row.paymentMethod)}</td><td>{formatCurrency(row.amountCents)}</td><td><StatusBadge status={row.archivedAt ? "Archived" : "Active"} /></td></> : report === "course-enrollment" ? <><td className="p-3">{row.season}</td><td>{row.course}</td><td>{row.level}</td><td>{row.enrollments}</td><td>{row.students}</td><td>{row.families}</td><td>{formatCurrency(row.paidCents)}</td><td>{formatCurrency(row.outstandingCents)}</td></> : report === "teacher-schedule" ? <><td className="p-3">{row.teacher}</td><td>{row.availabilityBlocks}</td><td>{row.scheduledSessions}</td><td>{row.completedSessions}</td><td>{row.rooms}</td></> : report === "payroll" ? <><td className="p-3">{row.teacher}</td><td>{formatDate(row.periodStart)}–{formatDate(row.periodEnd)}</td><td>{row.lessonHours.toFixed(2)}</td><td>{formatCurrency(row.adjustmentCents)}</td><td>{formatCurrency(row.grossAmountCents)}</td><td><StatusBadge status={row.status} /></td></> : <><td className="p-3">{row.room}</td><td>{row.capacity ?? "—"}</td><td>{row.scheduledSessions}</td><td>{row.completedSessions}</td><td>{row.cancelledSessions}</td><td>{row.teachers}</td></>}</tr>)}</tbody></DataTable> : null}
    {report !== "profit-loss" && report !== "season-closing" ? <Pager page={page} total={totalRows} hrefFor={hrefFor} /> : null}
  </AppShell>;
}
