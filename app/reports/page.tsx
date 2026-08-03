import Link from "next/link";
import { AppShell, Pager, StatusBadge, DataTable } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { formatCurrency, formatDate } from "@/lib/records/format";
import { formatPaymentMethod } from "@/lib/payment-methods";
import { getPagination } from "@/lib/records/pagination";
import {
  getReportDashboardSummary,
  getReportLookups,
  loadReport,
  missingSeasonMessage,
  type ReportFilters,
  type SeasonClosingSummary,
} from "@/lib/reports/data";
import {
  getShiftClosureLookups,
  getShiftClosureReport,
  type ShiftClosureFilters,
  type ShiftClosureReportRow,
} from "@/lib/reports/shift-closures";
import { logServerError } from "@/lib/server-log";
import {
  filtersForReport,
  reportDescriptions,
  reportTypes,
  type ReportType,
} from "@/lib/reports/filter-config";

type ReportSearchParams = ReportFilters & ShiftClosureFilters & {
  report?: string;
  page?: string;
  receiptNumber?: string;
  payrollStatus?: string;
};

type ReportKind = ReportType;

function reportTitle(report: ReportKind) {
  return {
    revenue: "Revenue",
    expenses: "Expenses",
    "profit-loss": "Profit / Loss",
    outstanding: "Outstanding balances",
    "season-closing": "Season closing",
    "course-enrollment": "Course enrollment",
    "teacher-schedule": "Teacher schedule / availability",
    "room-utilization": "Room utilization",
    payroll: "Teacher payroll",
    "shift-closures": "Shift closures",
  }[report];
}

function isSeasonClosingSummary(summary: unknown): summary is SeasonClosingSummary {
  return Boolean(
    summary &&
    typeof summary === "object" &&
    (summary as SeasonClosingSummary).season?.id &&
    (summary as SeasonClosingSummary).totals,
  );
}

function isProfitLossSummary(
  summary: unknown,
): summary is { revenueCents: number; expenseCents: number; netCents: number } {
  return Boolean(
    summary &&
    typeof summary === "object" &&
    "revenueCents" in summary &&
    "expenseCents" in summary &&
    "netCents" in summary,
  );
}

function exportHref(report: ReportKind, params: ReportSearchParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") query.set(key, value);
  }
  return `/api/reports/${report}?${query.toString()}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>;
}) {
  const params = await searchParams;
  const session = await requireSession();
  if (!hasPermission(session.role, "reports:read")) {
    throw new Error("Not authorized to view reports");
  }

  const report = reportTypes.includes(params.report as ReportKind)
    ? params.report as ReportKind
    : "revenue";
  const { page, skip, take } = getPagination(params);
  const [lookups, shiftUsers, dashboard] = await Promise.all([
    getReportLookups(),
    getShiftClosureLookups(),
    getReportDashboardSummary(params),
  ]);

  let pagedRows: any[] = [];
  let totalRows = 0;
  let reportSummary: unknown = null;
  let reportError = false;
  let reportErrorMessage: string | undefined;

  try {
    if (report === "shift-closures") {
      const result = await getShiftClosureReport(params, { skip, take });
      pagedRows = result.rows;
      totalRows = result.totalRows;
      reportSummary = result.summary;
    } else {
      const result = await loadReport(report, params, { skip, take }, dashboard);
      pagedRows = result.rows;
      totalRows = result.totalRows;
      reportSummary = result.summary;
      reportErrorMessage = result.errorMessage;
    }
  } catch (error) {
    logServerError("reports.load", error, { report, filters: params });
    reportError = true;
  }

  const profitLoss = report === "profit-loss" && isProfitLossSummary(reportSummary)
    ? reportSummary
    : dashboard;
  const seasonClosing = report === "season-closing" && isSeasonClosingSummary(reportSummary)
    ? reportSummary
    : null;
  const seasonClosingError = report === "season-closing" && params.seasonId && !seasonClosing
    ? reportErrorMessage ?? missingSeasonMessage
    : null;
  const activeFilters = new Set(filtersForReport(report));
  const showFilter = (name: string) => activeFilters.has(name);
  const resetHref = `/reports?report=${report}`;
  const hrefFor = (targetPage: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") next.set(key, value);
    }
    if (targetPage > 1) next.set("page", String(targetPage));
    return `/reports?${next.toString()}`;
  };

  return (
    <AppShell session={session}>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reports & Dashboard</h2>
          <p className="text-sm text-muted-foreground">{reportDescriptions[report]}</p>
        </div>
        <a className="rounded bg-primary px-4 py-2 text-center text-white" href={exportHref(report, params)}>
          Export CSV
        </a>
      </div>

      <section className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <SummaryCard label="Revenue" value={dashboard.revenueCents} />
        <SummaryCard label="Outstanding" value={dashboard.outstandingCents} />
        <SummaryCard label="Expenses" value={dashboard.expenseCents} />
        <SummaryCard label="Net profit/loss" value={dashboard.netCents} />
        <SummaryCard label="Payroll" value={dashboard.payrollCents} />
      </section>

      <form className="mb-4 grid gap-2 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <label className="text-sm font-bold">
          Report type
          <select className="mt-1 w-full rounded border p-2" name="report" defaultValue={report}>
            {reportTypes.map((item) => <option key={item} value={item}>{reportTitle(item)}</option>)}
          </select>
        </label>
        {showFilter("dateFrom") ? <Filter label="From date"><input className="w-full rounded border p-2" type="date" name="dateFrom" defaultValue={params.dateFrom} /></Filter> : null}
        {showFilter("dateTo") ? <Filter label="To date"><input className="w-full rounded border p-2" type="date" name="dateTo" defaultValue={params.dateTo} /></Filter> : null}
        {showFilter("seasonId") ? <Filter label="Season"><select className="w-full rounded border p-2" name="seasonId" defaultValue={params.seasonId ?? ""}><option value="">All seasons</option>{lookups.seasons.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Filter> : null}
        {showFilter("familyId") ? <Filter label="Family"><select className="w-full rounded border p-2" name="familyId" defaultValue={params.familyId ?? ""}><option value="">All families</option>{lookups.families.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Filter> : null}
        {showFilter("studentId") ? <Filter label="Student"><select className="w-full rounded border p-2" name="studentId" defaultValue={params.studentId ?? ""}><option value="">All students</option>{lookups.students.map((row) => <option key={row.id} value={row.id}>{row.studentCode} — {row.lastName}, {row.firstName}</option>)}</select></Filter> : null}
        {showFilter("teacherId") ? <Filter label="Teacher"><select className="w-full rounded border p-2" name="teacherId" defaultValue={params.teacherId ?? ""}><option value="">All teachers</option>{lookups.teachers.map((row) => <option key={row.id} value={row.id}>{row.fullName}</option>)}</select></Filter> : null}
        {showFilter("courseId") ? <Filter label="Course"><select className="w-full rounded border p-2" name="courseId" defaultValue={params.courseId ?? ""}><option value="">All courses</option>{lookups.courses.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Filter> : null}
        {showFilter("levelId") ? <Filter label="Level"><select className="w-full rounded border p-2" name="levelId" defaultValue={params.levelId ?? ""}><option value="">All levels</option>{lookups.levels.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Filter> : null}
        {showFilter("roomId") ? <Filter label="Room"><select className="w-full rounded border p-2" name="roomId" defaultValue={params.roomId ?? ""}><option value="">All rooms</option>{lookups.rooms.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Filter> : null}
        {showFilter("studentCode") ? <Filter label="Student ID"><input className="w-full rounded border p-2" name="studentCode" defaultValue={params.studentCode ?? ""} /></Filter> : null}
        {showFilter("paymentStatus") ? <Filter label="Balance status"><select className="w-full rounded border p-2" name="paymentStatus" defaultValue={params.paymentStatus ?? ""}><option value="">All statuses</option><option value="paid">Paid</option><option value="partial">Partially paid</option><option value="unpaid">Unpaid</option><option value="outstanding">Any outstanding</option></select></Filter> : null}
        {showFilter("paymentMethod") ? <Filter label="Payment method"><select className="w-full rounded border p-2" name="paymentMethod" defaultValue={params.paymentMethod ?? ""}><option value="">All methods</option>{lookups.paymentMethods.map((row) => <option key={row.paymentMethod} value={row.paymentMethod}>{formatPaymentMethod(row.paymentMethod)}</option>)}</select></Filter> : null}
        {showFilter("category") ? <Filter label="Expense category"><select className="w-full rounded border p-2" name="category" defaultValue={params.category ?? ""}><option value="">All categories</option>{lookups.expenseCategories.map((row) => <option key={row.category} value={row.category}>{row.category}</option>)}</select></Filter> : null}
        {showFilter("payrollStatus") ? <Filter label="Payroll status"><select className="w-full rounded border p-2" name="payrollStatus" defaultValue={params.payrollStatus ?? ""}><option value="">All payroll statuses</option><option value="DRAFT">Draft</option><option value="APPROVED">Approved</option><option value="PAID">Paid</option><option value="CANCELLED">Cancelled</option></select></Filter> : null}
        {showFilter("userId") ? <Filter label="Receptionist / shift owner"><select className="w-full rounded border p-2" name="userId" defaultValue={params.userId ?? ""}><option value="">All users</option>{shiftUsers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Filter> : null}
        {showFilter("shiftStatus") ? <Filter label="Shift status"><select className="w-full rounded border p-2" name="shiftStatus" defaultValue={params.shiftStatus ?? ""}><option value="">All shift statuses</option><option value="OPEN">Open</option><option value="REOPENED">Reopened</option><option value="AUTO_CLOSED">Auto-closed</option><option value="CLOSED">Closed</option></select></Filter> : null}
        {showFilter("includeArchived") ? <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="includeArchived" value="1" defaultChecked={params.includeArchived === "1"} /> Include archived expenses</label> : null}
        <button className="self-end rounded bg-primary px-4 py-2 text-white">Apply filters</button>
        <a className="self-end rounded border px-4 py-2 text-center" href={resetHref}>Reset filters</a>
      </form>

      <h3 className="mb-1 text-xl font-semibold">{reportTitle(report)} Report</h3>
      <p className="mb-3 text-sm text-muted-foreground">{reportDescriptions[report]}</p>

      {reportError ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold">We could not load this report right now.</p>
          <p>Please retry or narrow the filters. Technical details were logged.</p>
        </div>
      ) : null}

      {report === "profit-loss" ? (
        <div className="rounded-xl border bg-white p-6">
          <p>Revenue: <strong>{formatCurrency(profitLoss.revenueCents)}</strong></p>
          <p>Expenses: <strong>{formatCurrency(profitLoss.expenseCents)}</strong></p>
          <p>Net: <strong>{formatCurrency(profitLoss.netCents)}</strong></p>
        </div>
      ) : null}

      {report === "season-closing" && seasonClosing ? (
        <div className="rounded-xl border bg-white p-6">
          <p>Season: <strong>{seasonClosing.season.name}</strong></p>
          <p>Students: <strong>{seasonClosing.totals.students}</strong></p>
          <p>Families: <strong>{seasonClosing.totals.families}</strong></p>
          <p>Enrollments: <strong>{seasonClosing.totals.enrollments}</strong></p>
          <p>Payments: <strong>{formatCurrency(seasonClosing.totals.paymentsReceivedCents)}</strong></p>
          <p>Outstanding: <strong>{formatCurrency(seasonClosing.totals.outstandingCents)}</strong></p>
          <p>Expenses: <strong>{formatCurrency(seasonClosing.totals.expenseCents)}</strong></p>
          <p>Profit/loss: <strong>{formatCurrency(seasonClosing.totals.profitLossCents)}</strong></p>
          <Link className="mt-3 inline-block text-primary" href={`/seasons/${seasonClosing.season.id}/closing-report`}>Open full closing report</Link>
        </div>
      ) : null}
      {report === "season-closing" && !params.seasonId ? <p className="rounded border bg-amber-50 p-3 text-sm">Select a season to generate the closing report.</p> : null}
      {seasonClosingError ? <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">{seasonClosingError}</p> : null}

      {report !== "profit-loss" && report !== "season-closing" ? (
        <ReportTable report={report} rows={pagedRows} />
      ) : null}
      <Pager page={page} total={totalRows} hrefFor={hrefFor} />
    </AppShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-white p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-xl font-bold">{formatCurrency(value)}</p></div>;
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm font-bold">{label}<span className="mt-1 block">{children}</span></label>;
}

function ReportTable({ report, rows }: { report: ReportKind; rows: any[] }) {
  if (report === "shift-closures") {
    return (
      <DataTable>
        <thead className="bg-muted"><tr><th className="p-3">Business date</th><th>User</th><th>Status</th><th>Opening</th><th>Cash received</th><th>Whish received</th><th>Payroll</th><th>Other expenses</th><th>Expected cash</th><th>Declared</th><th>Difference</th><th>Actions</th></tr></thead>
        <tbody>{(rows as ShiftClosureReportRow[]).map((row) => <tr className="border-t" key={row.id}><td className="p-3">{formatDate(row.businessDate)}</td><td>{row.userName}</td><td><StatusBadge status={row.status} /></td><td>{formatCurrency(row.openingCashCents)}</td><td>{formatCurrency(row.cashPaymentsCents)}</td><td>{formatCurrency(row.whishPaymentsCents)}</td><td>{formatCurrency(row.payrollCents)}<br/><span className="text-xs text-muted-foreground">{row.payrollCount} payment(s)</span></td><td>{formatCurrency(row.operatingExpenseCents)}</td><td>{formatCurrency(row.expectedCashCents)}</td><td>{row.declaredCashCents == null ? "—" : formatCurrency(row.declaredCashCents)}</td><td className={row.differenceCents ? "font-bold text-amber-700" : ""}>{row.differenceCents == null ? "—" : formatCurrency(row.differenceCents)}</td><td><Link className="text-primary" href={`/shifts/${row.id}`}>Open shift</Link></td></tr>)}</tbody>
      </DataTable>
    );
  }

  const headers = report === "revenue"
    ? ["Date", "Family", "Method", "Receipt", "Seasons", "Courses", "Total"]
    : report === "outstanding"
      ? ["Family", "Student ID", "Student", "Season", "Course", "Level", "Teacher", "Remaining"]
      : report === "expenses"
        ? ["Date", "Category", "Description", "Method", "Amount", "Status"]
        : report === "course-enrollment"
          ? ["Season", "Course", "Level", "Enrollments", "Students", "Families", "Paid", "Outstanding"]
          : report === "teacher-schedule"
            ? ["Teacher", "Availability blocks", "Scheduled sessions", "Completed", "Rooms"]
            : report === "payroll"
              ? ["Teacher", "Period", "Lesson hours", "Adjustments", "Total payroll", "Status"]
              : ["Room", "Capacity", "Scheduled sessions", "Completed", "Cancelled", "Teachers"];

  return (
    <DataTable>
      <thead className="bg-muted"><tr>{headers.map((header, index) => <th className={index === 0 ? "p-3" : ""} key={header}>{header}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <StandardReportRow report={report} row={row} key={row.id} />)}</tbody>
    </DataTable>
  );
}

function StandardReportRow({ report, row }: { report: ReportKind; row: any }) {
  if (report === "revenue") return <tr className="border-t"><td className="p-3">{formatDate(row.paymentDate)}</td><td>{row.family ? `${row.family.familyCode} — ${row.family.name}` : "—"}</td><td>{formatPaymentMethod(row.paymentMethod)}</td><td>{row.receiptNumber ?? "—"}</td><td>{Array.from(new Set(row.items.map((item: any) => item.enrollment?.season?.name ?? "No season"))).join(", ")}</td><td>{Array.from(new Set(row.items.map((item: any) => item.enrollment?.course?.name ?? item.enrollment?.courseName ?? "No activity"))).join(", ")}</td><td>{formatCurrency(row.reportAmountCents)}</td></tr>;
  if (report === "outstanding") return <tr className="border-t"><td className="p-3">{row.student?.family ? `${row.student.family.familyCode} — ${row.student.family.name}` : "—"}</td><td>{row.student?.studentCode ?? "—"}</td><td>{row.student ? `${row.student.firstName} ${row.student.lastName}` : "—"}</td><td>{row.season?.name ?? "—"}</td><td>{row.course?.name ?? row.courseName}</td><td>{row.level?.name ?? "—"}</td><td>{row.teacher?.fullName ?? "—"}</td><td>{formatCurrency(row.remainingCents)}</td></tr>;
  if (report === "expenses") return <tr className="border-t"><td className="p-3">{formatDate(row.expenseDate)}</td><td>{row.category}</td><td>{row.description}</td><td>{formatPaymentMethod(row.paymentMethod)}</td><td>{formatCurrency(row.amountCents)}</td><td><StatusBadge status={row.archivedAt ? "Archived" : "Active"} /></td></tr>;
  if (report === "course-enrollment") return <tr className="border-t"><td className="p-3">{row.season}</td><td>{row.course}</td><td>{row.level}</td><td>{row.enrollments}</td><td>{row.students}</td><td>{row.families}</td><td>{formatCurrency(row.paidCents)}</td><td>{formatCurrency(row.outstandingCents)}</td></tr>;
  if (report === "teacher-schedule") return <tr className="border-t"><td className="p-3">{row.teacher}</td><td>{row.availabilityBlocks}</td><td>{row.scheduledSessions}</td><td>{row.completedSessions}</td><td>{row.rooms}</td></tr>;
  if (report === "payroll") return <tr className="border-t"><td className="p-3">{row.teacher}</td><td>{formatDate(row.periodStart)}–{formatDate(row.periodEnd)}</td><td>{row.lessonHours.toFixed(2)}</td><td>{formatCurrency(row.adjustmentCents)}</td><td>{formatCurrency(row.grossAmountCents)}</td><td><StatusBadge status={row.status} /></td></tr>;
  return <tr className="border-t"><td className="p-3">{row.room}</td><td>{row.capacity ?? "—"}</td><td>{row.scheduledSessions}</td><td>{row.completedSessions}</td><td>{row.cancelledSessions}</td><td>{row.teachers}</td></tr>;
}
