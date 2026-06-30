import { requireSession } from "@/lib/auth/session";
import { getDashboardMetrics } from "@/lib/dashboard/data";
import { formatCurrency } from "@/lib/dashboard/metrics";
import { AppShell } from "@/components/records/shell";

export default async function DashboardPage() {
  const [session, metrics] = await Promise.all([requireSession(), getDashboardMetrics()]);
  const cards = [
    { label: "Total Students", value: metrics.totalStudents.toLocaleString() },
    { label: "Total Families", value: metrics.totalFamilies.toLocaleString() },
    { label: "Outstanding Balance", value: formatCurrency(metrics.outstandingBalanceCents) },
    { label: "Monthly Revenue", value: formatCurrency(metrics.monthlyRevenueCents) },
    { label: "Monthly Expenses", value: formatCurrency(metrics.monthlyExpensesCents) },
    { label: "Net Profit", value: formatCurrency(metrics.netProfitCents) },
  ];

  return (
    <AppShell session={session}>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article className="rounded-xl border border-border bg-white p-6 shadow-sm" key={card.label}>
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-3 text-2xl font-bold">{card.value}</p>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
