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
}
