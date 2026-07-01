import { CalendarDays, CreditCard, WalletCards } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getDashboardMetrics, prisma } from "@/lib/dashboard/data";
import { formatCurrency } from "@/lib/dashboard/metrics";
import { AppShell, DataTable, EmptyState, MetricCard, PageHeader, QuickActionCard, StatusBadge } from "@/components/records/shell";
import { formatDate } from "@/lib/records/format";

export default async function DashboardPage() {
  const [session, metrics, upcoming, recentPayments, balances] = await Promise.all([
    requireSession(),
    getDashboardMetrics(),
    prisma.scheduleSession.findMany({ where: { archivedAt: null, status: "SCHEDULED", sessionDate: { gte: new Date() } }, include: { student: { include: { family: true } }, teacher: true, enrollment: true }, orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }], take: 5 }),
    prisma.payment.findMany({ where: { voidedAt: null }, include: { family: true }, orderBy: { paymentDate: "desc" }, take: 5 }),
    prisma.enrollment.findMany({ where: { status: { in: ["ACTIVE", "PAUSED"] }, remainingCents: { gt: 0 } }, include: { student: { include: { family: true } }, season: true }, orderBy: { remainingCents: "desc" }, take: 5 }),
  ]);
  return <AppShell session={session}>
    <PageHeader title="Dashboard" description="Today’s snapshot for revenue, lessons, payments, and families who still have a remaining balance." />
    <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <MetricCard label="Total Revenue" value={formatCurrency(metrics.monthlyRevenueCents)} help="Payments received this month" tone="emerald" />
      <MetricCard label="Total Expenses" value={formatCurrency(metrics.monthlyExpensesCents)} help="Expenses recorded this month" tone="red" />
      <MetricCard label="Net Profit" value={formatCurrency(metrics.netProfitCents)} help="Revenue minus expenses" tone="blue" />
      <MetricCard label="Outstanding Balance" value={formatCurrency(metrics.outstandingBalanceCents)} help="Remaining to pay" tone="amber" />
      <MetricCard label="Active Students" value={metrics.totalStudents.toLocaleString()} help="Current active students" tone="violet" />
    </section>
    <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <QuickActionCard href="/families" title="Add Family" description="Create a family record." />
      <QuickActionCard href="/students" title="Add Student" description="Add a student to a family." />
      <QuickActionCard href="/payments/new" title="Create Payment" description="Record and allocate a payment." />
      <QuickActionCard href="/expenses/new" title="Add Expense" description="Track money spent." />
      <QuickActionCard href="/schedule" title="Add Session" description="Book a lesson." />
    </section>
    <section className="grid gap-6 xl:grid-cols-3">
      <div className="xl:col-span-2"><Panel icon={<CalendarDays className="size-5" />} title="Upcoming sessions">{upcoming.length ? <DataTable><thead><tr><th>Date</th><th>Time</th><th>Student</th><th>Family</th><th>Teacher</th><th>Status</th></tr></thead><tbody>{upcoming.map((row) => <tr key={row.id}><td>{formatDate(row.sessionDate)}</td><td>{row.startTime}–{row.endTime}</td><td className="font-semibold">{row.student.firstName} {row.student.lastName}</td><td>{row.student.family.name}</td><td>{row.teacher.fullName}</td><td><StatusBadge status={row.status} /></td></tr>)}</tbody></DataTable> : <EmptyState title="No upcoming sessions" description="Use Add Session to book the next lesson." />}</Panel></div>
      <Panel icon={<CreditCard className="size-5" />} title="Recent payments">{recentPayments.length ? <div className="space-y-3">{recentPayments.map((payment) => <div className="rounded-2xl border border-border p-3" key={payment.id}><p className="font-bold">{payment.family.name}</p><p className="text-sm text-muted-foreground">{formatDate(payment.paymentDate)} · {payment.paymentMethod}</p><p className="mt-1 text-lg font-extrabold text-emerald-700">{formatCurrency(payment.totalAmountCents)}</p></div>)}</div> : <EmptyState title="No payments yet" />}</Panel>
      <div className="xl:col-span-3"><Panel icon={<WalletCards className="size-5" />} title="Outstanding balances">{balances.length ? <DataTable><thead><tr><th>Family</th><th>Student</th><th>Season</th><th>Course</th><th>Remaining to Pay</th></tr></thead><tbody>{balances.map((row) => <tr key={row.id}><td className="font-semibold">{row.student.family.name}</td><td>{row.student.firstName} {row.student.lastName}</td><td>{row.season.name}</td><td>{row.courseName}</td><td className="font-bold text-amber-700">{formatCurrency(row.remainingCents)}</td></tr>)}</tbody></DataTable> : <EmptyState title="No outstanding balances" description="All active enrollments are fully paid." />}</Panel></div>
    </section>
  </AppShell>;
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="card"><div className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-blue-50 text-blue-600">{icon}</span><h3 className="text-lg font-extrabold">{title}</h3></div>{children}</section>;
}
