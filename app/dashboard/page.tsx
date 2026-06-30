import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getDashboardMetrics } from "@/lib/dashboard/data";
import { formatCurrency } from "@/lib/dashboard/metrics";
import { AppShell, PageHeader } from "@/components/records/shell";

export default async function DashboardPage() {
  const [session, metrics] = await Promise.all([requireSession(), getDashboardMetrics()]);
  const cards = [
    { label: "Outstanding Balance", value: formatCurrency(metrics.outstandingBalanceCents), help: "Tuition still owed across active enrollments.", accent: "border-l-4 border-l-amber-500" },
    { label: "Monthly Revenue", value: formatCurrency(metrics.monthlyRevenueCents), help: "Payments received this month.", accent: "border-l-4 border-l-emerald-500" },
    { label: "Monthly Expenses", value: formatCurrency(metrics.monthlyExpensesCents), help: "Recorded expenses this month.", accent: "border-l-4 border-l-red-500" },
    { label: "Net Profit", value: formatCurrency(metrics.netProfitCents), help: "Revenue minus expenses for the month.", accent: "border-l-4 border-l-blue-500" },
    { label: "Total Students", value: metrics.totalStudents.toLocaleString(), help: "Student records in the system.", accent: "" },
    { label: "Total Families", value: metrics.totalFamilies.toLocaleString(), help: "Family accounts managed by the school.", accent: "" },
  ];
  return <AppShell session={session}>
    <PageHeader title="Dashboard" description="A quick snapshot of school activity and finances. Use the quick actions to start common receptionist tasks." />
    <section className="mb-6 grid gap-3 md:grid-cols-4">
      <Link className="rounded-xl bg-primary px-4 py-3 text-center font-semibold text-white shadow-sm hover:bg-blue-700" href="/families">Add Family</Link>
      <Link className="rounded-xl bg-primary px-4 py-3 text-center font-semibold text-white shadow-sm hover:bg-blue-700" href="/students">Add Student</Link>
      <Link className="rounded-xl bg-primary px-4 py-3 text-center font-semibold text-white shadow-sm hover:bg-blue-700" href="/payments/new">Create Payment</Link>
      <Link className="rounded-xl bg-primary px-4 py-3 text-center font-semibold text-white shadow-sm hover:bg-blue-700" href="/expenses/new">Add Expense</Link>
    </section>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{cards.map((card) => <article className={`rounded-xl border border-border bg-white p-6 shadow-sm ${card.accent}`} key={card.label}><p className="text-sm font-medium text-muted-foreground">{card.label}</p><p className="mt-3 text-3xl font-bold">{card.value}</p><p className="mt-2 text-sm text-muted-foreground">{card.help}</p></article>)}</section>
  </AppShell>;
}
