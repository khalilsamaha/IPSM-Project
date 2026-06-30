import { notFound } from "next/navigation";
import { voidPayment } from "@/actions/records";
import { AppShell } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { prisma } from "@/lib/dashboard/data";
import { formatCurrency, formatDate } from "@/lib/records/format";

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const payment = await prisma.payment.findUnique({ where: { id }, include: { family: true, receipt: true, createdBy: true, items: { include: { enrollment: { include: { student: true, season: true } } } } } });
  if (!payment) notFound();
  return <AppShell session={session}><div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-bold">Payment {payment.receiptNumber}</h2><a className="rounded bg-primary px-4 py-2 text-white" href={`/api/receipts/${payment.id}`}>Download receipt PDF</a></div><section className="mb-6 rounded-xl border bg-white p-4"><dl className="grid gap-3 md:grid-cols-3"><div><dt className="text-sm text-muted-foreground">Family</dt><dd className="font-medium">{payment.family.name}</dd></div><div><dt className="text-sm text-muted-foreground">Date</dt><dd>{formatDate(payment.paymentDate)}</dd></div><div><dt className="text-sm text-muted-foreground">Method</dt><dd>{payment.paymentMethod}</dd></div><div><dt className="text-sm text-muted-foreground">Total</dt><dd>{formatCurrency(payment.totalAmountCents)}</dd></div><div><dt className="text-sm text-muted-foreground">Status</dt><dd>{payment.voidedAt ? `VOID ${formatDate(payment.voidedAt)}` : "Posted"}</dd></div><div><dt className="text-sm text-muted-foreground">Created by</dt><dd>{payment.createdBy?.name ?? "—"}</dd></div></dl>{payment.notes ? <p className="mt-4 text-sm">{payment.notes}</p> : null}</section><section className="rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr><th className="p-3">Student</th><th>Enrollment</th><th>Season</th><th>Amount</th></tr></thead><tbody>{payment.items.map((item)=><tr className="border-t" key={item.id}><td className="p-3">{item.enrollment.student.firstName} {item.enrollment.student.lastName}</td><td>{item.enrollment.courseName}</td><td>{item.enrollment.season.name}</td><td>{formatCurrency(item.amountCents)}</td></tr>)}</tbody></table></section>{hasPermission(session.role, "finance:delete") && !payment.voidedAt ? <form action={voidPayment} className="mt-4"><input type="hidden" name="id" value={payment.id}/><button className="rounded border border-red-600 px-4 py-2 text-red-700">Void payment</button></form> : null}</AppShell>;
}
