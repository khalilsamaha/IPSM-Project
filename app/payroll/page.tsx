import Link from "next/link";
import { AppShell, DataTable, MetricCard, PageHeader, StatusBadge } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/records/format";

export default async function PayrollPage() {
  const session = await requireSession();
  const rows = await prisma.teacherPayroll.findMany({ include: { teacher: true }, orderBy: { createdAt: "desc" }, take: 50 });
  const total = rows.reduce((sum, row) => sum + row.grossAmountCents, 0);
  return <AppShell session={session}><PageHeader title="Teacher Payroll" description="Generate payroll from payable lessons only. Reception users cannot access this area." action={<Link className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white" href="/payroll/new">New payroll</Link>} />
    <div className="mb-5 grid gap-4 md:grid-cols-3"><MetricCard label="Payroll records" value={String(rows.length)} /><MetricCard label="Total payroll" value={formatCurrency(total)} /><MetricCard label="Locked records" value={String(rows.filter((r) => r.status === "APPROVED" || r.status === "PAID").length)} /></div>
    <DataTable><thead><tr><th>Teacher</th><th>Period</th><th>Hours</th><th>Adjustments</th><th>Gross</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td className="font-bold">{row.teacher.fullName}</td><td>{formatDate(row.periodStart)} – {formatDate(row.periodEnd)}</td><td>{((row.completedMinutes + row.missedPayableMinutes) / 60).toFixed(2)}</td><td>{formatCurrency(row.adjustmentCents)}</td><td>{formatCurrency(row.grossAmountCents)}</td><td><StatusBadge status={row.status} /></td><td><Link className="text-primary" href={`/payroll/${row.id}`}>View</Link></td></tr>)}</tbody></DataTable>
  </AppShell>;
}
