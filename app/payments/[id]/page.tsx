import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/dashboard/data";
import { formatCurrency, formatDate } from "@/lib/records/format";

export default async function PaymentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string }> }) {
  const session = await requireSession();
  const [{ id }, { success }] = await Promise.all([params, searchParams]);
  const payment = await prisma.payment.findUnique({ where: { id }, include: { family: true, items: { include: { enrollment: { include: { student: true, season: true } } } } } });
  if (!payment) notFound();
  return (
    <AppShell session={session}>
      <div className="mb-6 flex items-center justify-between"><h2 className="text-2xl font-bold">Payment Detail</h2><Link className="rounded-md border border-border bg-white px-4 py-2 text-sm shadow-sm" href="/payments">Back to payments</Link></div>
      {success === "created" ? <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">Payment created successfully.</div> : null}
      <section className="mb-6 rounded-xl border bg-white p-4"><p><strong>Family:</strong> {payment.family.name}</p><p><strong>Date:</strong> {formatDate(payment.paymentDate)}</p><p><strong>Method:</strong> {payment.paymentMethod}</p><p><strong>Total:</strong> {formatCurrency(payment.totalAmountCents)}</p>{payment.notes ? <p><strong>Notes:</strong> {payment.notes}</p> : null}</section>
      <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr><th className="p-3">Student</th><th>Season</th><th>Course</th><th>Amount</th></tr></thead><tbody>{payment.items.map((item) => <tr className="border-t" key={item.id}><td className="p-3 font-medium">{item.enrollment.student.firstName} {item.enrollment.student.lastName}</td><td>{item.enrollment.season.name}</td><td>{item.enrollment.courseName}</td><td>{formatCurrency(item.amountCents)}</td></tr>)}</tbody></table></div>
    </AppShell>
  );
}
