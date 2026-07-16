import Link from "next/link";
import { AppShell, DataTable, EmptyState, PageHeader, StatusBadge } from "@/components/records/shell";
import { openShift } from "@/actions/shifts";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatDateInput } from "@/lib/records/format";
import { hasPermission } from "@/lib/auth/roles";

export default async function ShiftsPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const session = await requireSession();
  const params = await searchParams;
  if (!hasPermission(session.role, "records:write")) return <AppShell session={session}><EmptyState title="Not authorized" /></AppShell>;
  const user = await prisma.userProfile.findUnique({ where: { authId: session.userId }, select: { id: true } });
  const [current, rows] = await Promise.all([
    user ? prisma.cashierShift.findFirst({ where: { userId: user.id, status: { in: ["OPEN", "REOPENED"] } }, orderBy: { openedAt: "desc" } }) : null,
    prisma.cashierShift.findMany({ include: { user: true, closedBy: true }, orderBy: [{ businessDate: "desc" }, { openedAt: "desc" }], take: 50 }),
  ]);
  return <AppShell session={session}><PageHeader title="Shift" description="Open, review, and close controlled receptionist shifts before recording payments or expenses." />
    {params?.error ? <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-red-700">{params.error}</div> : null}
    {!current ? <form action={openShift} className="mb-6 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3">
      <label className="text-sm font-semibold">Business date<input className="mt-1 w-full rounded border p-2" type="date" name="businessDate" defaultValue={formatDateInput(new Date())} required /></label>
      <label className="text-sm font-semibold">Opening cash<input className="mt-1 w-full rounded border p-2" type="number" min="0" step="0.01" name="openingCash" required /></label>
      <label className="text-sm font-semibold">Notes<input className="mt-1 w-full rounded border p-2" name="notes" placeholder="Optional" /></label>
      <button className="rounded bg-primary px-4 py-2 text-white md:col-span-3">Open Shift</button>
    </form> : <div className="mb-6 rounded-xl border bg-white p-4"><p className="font-bold">Current shift opened for {formatDate(current.businessDate)} with {formatCurrency(current.openingCashCents)} opening cash.</p><Link className="mt-3 inline-block rounded bg-primary px-4 py-2 text-white" href={`/shifts/${current.id}`}>Open dashboard</Link></div>}
    <DataTable><thead><tr><th>Date</th><th>Receptionist</th><th>Opening</th><th>Expected</th><th>Declared</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map((s) => <tr key={s.id}><td>{formatDate(s.businessDate)}</td><td>{s.user.name}</td><td>{formatCurrency(s.openingCashCents)}</td><td>{formatCurrency(s.expectedCashCents)}</td><td>{s.declaredCashCents == null ? "—" : formatCurrency(s.declaredCashCents)}</td><td><StatusBadge status={s.status} /></td><td><Link className="text-primary" href={`/shifts/${s.id}`}>View</Link></td></tr>)}</tbody></DataTable>
  </AppShell>;
}
