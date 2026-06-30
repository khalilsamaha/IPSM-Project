import { AppShell, Pager, StatusBadge, EmptyState, DataTable } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { formatCurrency, formatDate } from "@/lib/records/format";
import { getPagination } from "@/lib/records/pagination";
import { getExpenseReport, getOutstandingReport, getProfitLossReport, getReportLookups, getRevenueReport, getTeacherSalaryReport, type ReportFilters } from "@/lib/reports/data";

type ReportSearchParams = ReportFilters & { report?: string; page?: string };
const reports = ["revenue", "outstanding", "expenses", "profit-loss", "teacher-salaries"] as const;
type ReportKind = (typeof reports)[number];

function reportTitle(report: ReportKind) {
  return { revenue: "Revenue", outstanding: "Outstanding balances", expenses: "Expenses", "profit-loss": "Profit / Loss", "teacher-salaries": "Teacher salaries" }[report];
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
  const [lookups, revenue, outstanding, expenses, profitLoss, teacherSalaries] = await Promise.all([
    getReportLookups(), getRevenueReport(params), getOutstandingReport(params), getExpenseReport(params), getProfitLossReport(params), getTeacherSalaryReport(params),
  ]);
  const activeRows = report === "revenue" ? revenue.rows : report === "outstanding" ? outstanding.rows : report === "expenses" ? expenses.rows : report === "teacher-salaries" ? teacherSalaries.rows : [];
  const pagedRows = activeRows.slice(skip, skip + take);
  const totalRows = activeRows.length;
  const hrefFor = (targetPage: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value && key !== "page") next.set(key, value);
    if (targetPage > 1) next.set("page", String(targetPage));
    return `/reports?${next.toString()}`;
  };

  return <AppShell session={session}>
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div><h2 className="text-2xl font-bold">Reports & Dashboard</h2><p className="text-sm text-muted-foreground">Financial reports are available to Admin and Reception roles. Voided payments are excluded from revenue; archived expenses are excluded by default.</p></div>
      <a className="rounded bg-primary px-4 py-2 text-center text-white" href={exportHref(report, params)}>Export CSV</a>
    </div>

    <section className="mb-4 grid gap-4 md:grid-cols-4">
      <div className="rounded-xl border bg-white p-4"><p className="text-sm text-muted-foreground">Revenue</p><p className="text-xl font-bold">{formatCurrency(revenue.totalCents)}</p></div>
      <div className="rounded-xl border bg-white p-4"><p className="text-sm text-muted-foreground">Outstanding</p><p className="text-xl font-bold">{formatCurrency(outstanding.totalCents)}</p></div>
      <div className="rounded-xl border bg-white p-4"><p className="text-sm text-muted-foreground">Expenses</p><p className="text-xl font-bold">{formatCurrency(expenses.totalCents)}</p></div>
      <div className="rounded-xl border bg-white p-4"><p className="text-sm text-muted-foreground">Net profit/loss</p><p className="text-xl font-bold">{formatCurrency(profitLoss.netCents)}</p></div>
    </section>

    <form className="mb-4 grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-6">
      <select className="rounded border p-2" name="report" defaultValue={report}>{reports.map((item) => <option key={item} value={item}>{reportTitle(item)}</option>)}</select>
      <input className="rounded border p-2" type="date" name="dateFrom" defaultValue={params.dateFrom} />
      <input className="rounded border p-2" type="date" name="dateTo" defaultValue={params.dateTo} />
      <select className="rounded border p-2" name="seasonId" defaultValue={params.seasonId ?? ""}><option value="">All seasons</option>{lookups.seasons.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
      <select className="rounded border p-2" name="familyId" defaultValue={params.familyId ?? ""}><option value="">All families</option>{lookups.families.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
      <select className="rounded border p-2" name="studentId" defaultValue={params.studentId ?? ""}><option value="">All students</option>{lookups.students.map((row) => <option key={row.id} value={row.id}>{row.lastName}, {row.firstName}</option>)}</select>
      <select className="rounded border p-2" name="teacherId" defaultValue={params.teacherId ?? ""}><option value="">All teachers</option>{lookups.teachers.map((row) => <option key={row.id} value={row.id}>{row.fullName}</option>)}</select>
      <select className="rounded border p-2" name="paymentMethod" defaultValue={params.paymentMethod ?? ""}><option value="">All payment methods</option>{lookups.paymentMethods.map((row) => <option key={row.paymentMethod} value={row.paymentMethod}>{row.paymentMethod}</option>)}</select>
      <select className="rounded border p-2" name="category" defaultValue={params.category ?? ""}><option value="">All expense categories</option>{lookups.expenseCategories.map((row) => <option key={row.category} value={row.category}>{row.category}</option>)}</select>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="includeArchived" value="1" defaultChecked={params.includeArchived === "1"} /> Include archived expenses</label>
      <button className="rounded bg-primary px-4 py-2 text-white md:col-span-2">Apply filters</button>
    </form>

    <h3 className="mb-3 text-xl font-semibold">{reportTitle(report)}</h3>
    {report === "profit-loss" ? <div className="rounded-xl border bg-white p-6"><p>Revenue: <strong>{formatCurrency(profitLoss.revenueCents)}</strong></p><p>Expenses: <strong>{formatCurrency(profitLoss.expenseCents)}</strong></p><p>Net: <strong>{formatCurrency(profitLoss.netCents)}</strong></p></div> : null}
    {report === "teacher-salaries" ? <p className="mb-3 rounded border bg-amber-50 p-3 text-sm">Teaching hours are not implemented in the current schema. This report includes a placeholder estimatedHours field and calculates estimated salary as $0 until attendance or lesson-hour records are added.</p> : null}
    {report !== "profit-loss" ? <DataTable><thead className="bg-muted"><tr>{report === "revenue" ? <><th className="p-3">Date</th><th>Family</th><th>Method</th><th>Receipt</th><th>Seasons</th><th>Total</th></> : report === "outstanding" ? <><th className="p-3">Family</th><th>Student</th><th>Season</th><th>Course</th><th>Teacher</th><th>Remaining</th></> : report === "expenses" ? <><th className="p-3">Date</th><th>Category</th><th>Description</th><th>Method</th><th>Amount</th><th>Status</th></> : <><th className="p-3">Teacher</th><th>Rate</th><th>Assigned enrollments</th><th>Estimated hours</th><th>Estimated salary</th></>}</tr></thead><tbody>{pagedRows.map((row: any) => <tr className="border-t" key={row.id}>{report === "revenue" ? <><td className="p-3">{formatDate(row.paymentDate)}</td><td>{row.family.name}</td><td>{row.paymentMethod}</td><td>{row.receiptNumber ?? "—"}</td><td>{Array.from(new Set(row.items.map((item: any) => item.enrollment.season.name))).join(", ")}</td><td>{formatCurrency(row.totalAmountCents)}</td></> : report === "outstanding" ? <><td className="p-3">{row.student.family.name}</td><td>{row.student.firstName} {row.student.lastName}</td><td>{row.season.name}</td><td>{row.courseName}</td><td>{row.teacher?.fullName ?? "—"}</td><td>{formatCurrency(row.remainingCents)}</td></> : report === "expenses" ? <><td className="p-3">{formatDate(row.expenseDate)}</td><td>{row.category}</td><td>{row.description}</td><td>{row.paymentMethod}</td><td>{formatCurrency(row.amountCents)}</td><td><StatusBadge status={row.archivedAt ? "Archived" : "Active"} /></td></> : <><td className="p-3">{row.fullName}</td><td>{formatCurrency(row.hourlyRateCents)}/hr</td><td>{row.enrollments.length}</td><td>{row.estimatedHours ?? "Not tracked"}</td><td>{formatCurrency(row.estimatedSalaryCents)}</td></>}</tr>)}</tbody></DataTable> : null}
    {report !== "profit-loss" ? <Pager page={page} total={totalRows} hrefFor={hrefFor} /> : null}
  </AppShell>;
}
