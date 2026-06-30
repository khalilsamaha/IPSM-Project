import Link from "next/link";
import { AppShell } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/dashboard/data";
import { formatCurrency, formatDate } from "@/lib/records/format";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ success?: string }> }) {
  const session = await requireSession();
  const { success } = await searchParams;
  const payments = await prisma.payment.findMany({ include: { family: true, items: true }, orderBy: { createdAt: "desc" }, take: 25 });
  return (
    <AppShell session={session}>
      <div className="mb-6 flex items-center justify-between"><h2 className="text-2xl font-bold">Payments</h2><Link className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white" href="/payments/new">Create payment</Link></div>
      {success === "created" ? <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">Payment created successfully.</div> : null}
      <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr><th className="p-3">Family</th><th>Date</th><th>Method</th><th>Amount</th><th>Items</th><th>Actions</th></tr></thead><tbody>{payments.map((payment) => <tr className="border-t" key={payment.id}><td className="p-3 font-medium">{payment.family.name}</td><td>{formatDate(payment.paymentDate)}</td><td>{payment.paymentMethod}</td><td>{formatCurrency(payment.totalAmountCents)}</td><td>{payment.items.length}</td><td><Link className="text-primary" href={`/payments/${payment.id}`}>View</Link></td></tr>)}</tbody></table></div>
    </AppShell>
  );
import { AppShell, Pager } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/dashboard/data";
import { formatCurrency, formatDate } from "@/lib/records/format";
import { buildPageHref, getPagination } from "@/lib/records/pagination";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; familyId?: string; seasonId?: string; paymentMethod?: string; dateFrom?: string; dateTo?: string }> }) {
  const params = await searchParams;
  const session = await requireSession();
  const { q, page, skip, take } = getPagination(params);
  const where = {
    AND: [
      q ? { OR: [{ receiptNumber: { contains: q, mode: "insensitive" as const } }, { family: { name: { contains: q, mode: "insensitive" as const } } }] } : {},
      params.familyId ? { familyId: params.familyId } : {},
      params.paymentMethod ? { paymentMethod: params.paymentMethod } : {},
      params.dateFrom ? { paymentDate: { gte: new Date(params.dateFrom) } } : {},
      params.dateTo ? { paymentDate: { lte: new Date(params.dateTo) } } : {},
      params.seasonId ? { items: { some: { enrollment: { seasonId: params.seasonId } } } } : {},
    ],
  };
  const [rows, total, families, seasons] = await Promise.all([
    prisma.payment.findMany({ where, include: { family: true, items: { include: { enrollment: { include: { season: true } } } } }, orderBy: { paymentDate: "desc" }, skip, take }),
    prisma.payment.count({ where }),
    prisma.family.findMany({ orderBy: { name: "asc" } }),
    prisma.season.findMany({ orderBy: { startDate: "desc" } }),
  ]);
  const hrefFor = (targetPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    for (const key of ["familyId", "seasonId", "paymentMethod", "dateFrom", "dateTo"] as const) if (params[key]) next.set(key, params[key]!);
    next.set("page", String(targetPage));
    return `/payments?${next.toString()}`;
  };
  return <AppShell session={session}><div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-bold">Payments</h2><div className="flex gap-2"><Link className="rounded border px-4 py-2" href="/payments/allocation">Allocation view</Link><Link className="rounded bg-primary px-4 py-2 text-white" href="/payments/new">Create payment</Link></div></div><form className="mb-4 grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-6"><input className="rounded border p-2" name="q" placeholder="Receipt or family" defaultValue={q}/><select name="familyId" className="rounded border p-2" defaultValue={params.familyId ?? ""}><option value="">All families</option>{families.map((f)=><option key={f.id} value={f.id}>{f.name}</option>)}</select><select name="seasonId" className="rounded border p-2" defaultValue={params.seasonId ?? ""}><option value="">All seasons</option>{seasons.map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select name="paymentMethod" className="rounded border p-2" defaultValue={params.paymentMethod ?? ""}><option value="">All methods</option><option value="cash">Cash</option><option value="card">Card</option><option value="check">Check</option><option value="ach">ACH</option></select><input className="rounded border p-2" type="date" name="dateFrom" defaultValue={params.dateFrom}/><input className="rounded border p-2" type="date" name="dateTo" defaultValue={params.dateTo}/><button className="rounded bg-primary px-4 py-2 text-white md:col-span-6">Apply filters</button></form><div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr><th className="p-3">Receipt</th><th>Family</th><th>Date</th><th>Method</th><th>Season(s)</th><th>Items</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((r)=><tr className="border-t" key={r.id}><td className="p-3 font-medium">{r.receiptNumber}</td><td>{r.family.name}</td><td>{formatDate(r.paymentDate)}</td><td>{r.paymentMethod}</td><td>{Array.from(new Set(r.items.map((i)=>i.enrollment.season.name))).join(", ")}</td><td>{r.items.length}</td><td>{formatCurrency(r.totalAmountCents)}</td><td>{r.voidedAt ? "VOID" : "Posted"}</td><td className="space-x-3"><Link className="text-primary" href={`/payments/${r.id}`}>View</Link><a className="text-primary" href={`/api/receipts/${r.id}`}>Receipt PDF</a></td></tr>)}</tbody></table></div><Pager page={page} total={total} hrefFor={hrefFor}/></AppShell>;
}
