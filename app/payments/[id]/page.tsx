import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { voidPayment } from "@/actions/records";
import { AppShell, StatusBadge } from "@/components/records/shell";
import { hasPermission } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/records/format";
import { formatDateShort, formatDateTimeShort } from "@/lib/date-time";
import { calculateFamilyFinancialSummary } from "@/lib/family-financial-summary";

const methodLabels: Record<string, string> = { cash: "Cash", card: "Card", check: "Check", ach: "Bank Transfer" };
function receiptMailto(payment: { receiptNumber: string | null; paymentDate: Date; totalAmountCents: number; family: { name: string; email: string | null } }) {
  const payerName = payment.family.name;
  const subject = `Receipt ${payment.receiptNumber ?? "Pending"} - IPSM Music School`;
  const body = [`Hello ${payerName || "there"},`, "", `Receipt number: ${payment.receiptNumber ?? "Missing receipt number"}`, `Payment date: ${formatDateShort(payment.paymentDate)}`, `Amount: ${formatCurrency(payment.totalAmountCents)}`, "", "Thank you,", "IPSM Music School"].join("\n");
  return `mailto:${encodeURIComponent(payment.family.email ?? "") }?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default async function PaymentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string }>;
}) {
  const session = await requireSession();
  const [{ id }, { success }] = await Promise.all([params, searchParams]);
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      family: { include: { students: { include: { enrollments: true } } } },
      receipt: true,
      createdBy: true,
      items: { include: { enrollment: { include: { season: true, student: true } } } },
    },
  });

  if (!payment || !payment.family) notFound();
  const family = payment.family;

  const familyEnrollments = family.students.flatMap((student) => student.enrollments);
  const familySummary = calculateFamilyFinancialSummary(familyEnrollments, { familyId: payment.familyId });

  return (
    <AppShell session={session}>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Payment {payment.receiptNumber ?? "Missing receipt number"}</h2>
          {success === "created" ? <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><p className="font-bold">Payment recorded successfully. Receipt {payment.receiptNumber ?? "Pending"} is ready.</p><p>Amount: {formatCurrency(payment.totalAmountCents)}</p><div className="mt-2 flex flex-wrap gap-2"><a className="rounded bg-emerald-700 px-3 py-2 text-white" href={`/api/receipts/${payment.id}?layout=a5`}>Download Receipt</a><Link className="rounded border border-emerald-300 px-3 py-2" href="/payments/new">Record Another Payment</Link></div></div> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded border px-4 py-2" href="/payments">Back to payments</Link>
          <a className="rounded bg-primary px-4 py-2 text-white" href={`/api/receipts/${payment.id}?layout=a5`}>Download A5</a><a className="rounded border px-4 py-2" href={`/api/receipts/${payment.id}?layout=a4-two-copies`}>Print two copies</a><a className="rounded border px-4 py-2" href={`/api/receipts/${payment.id}?layout=a5&reprint=1`}>Reprint receipt</a>{family.email ? <a className="rounded border px-4 py-2" href={receiptMailto({ ...payment, family })}>Send receipt by email</a> : <span className="rounded border px-4 py-2 text-sm text-muted-foreground">No payer email on file</span>}
        </div>
      </div>

      <section className="mb-6 rounded-xl border bg-white p-4">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-sm text-muted-foreground">Receipt number</dt><dd className="font-medium">{payment.receiptNumber ?? "Missing receipt number"}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Payer type</dt><dd className="font-medium">{"Family"}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Payer</dt><dd className="font-medium">{family.name}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Payment date</dt><dd>{formatDateTimeShort(payment.paymentDate)}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Payment method</dt><dd>{methodLabels[payment.paymentMethod] ?? payment.paymentMethod}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Payment amount</dt><dd>{formatCurrency(payment.totalAmountCents)}</dd></div><div><dt className="text-sm text-muted-foreground">Family total amount</dt><dd>{formatCurrency(familySummary.totalAmountCents)}</dd></div><div><dt className="text-sm text-muted-foreground">Family total paid</dt><dd>{formatCurrency(familySummary.paidCents)}</dd></div><div><dt className="text-sm text-muted-foreground">Family remaining</dt><dd>{formatCurrency(familySummary.remainingCents)}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Status</dt><dd><StatusBadge status={payment.voidedAt ? `Voided ${formatDateTimeShort(payment.voidedAt)}` : "Posted"} /></dd></div>
          <div><dt className="text-sm text-muted-foreground">Created by</dt><dd>{payment.createdBy?.name ?? "—"}</dd></div>

        </dl>
        {payment.notes ? <p className="mt-4 text-sm">{payment.notes}</p> : null}
      </section>

      <section className="rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted"><tr><th className="p-3">Student</th><th>Enrollment</th><th>Season</th><th>Amount</th><th>Remaining after payment</th></tr></thead>
          <tbody>
            {payment.items.map((item) => (
              <tr className="border-t" key={item.id}>
                <td className="p-3">{item.enrollment.student.studentCode} — {item.enrollment.student.firstName} {item.enrollment.student.lastName}</td>
                <td>{item.enrollment.courseName}</td>
                <td>{item.enrollment.season?.name ?? "No season"}</td>
                <td>{formatCurrency(item.amountCents)}</td><td>{formatCurrency(item.enrollment.remainingCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {hasPermission(session.role, "finance:delete") && !payment.voidedAt ? (
        <form action={voidPayment} className="mt-4">
          <input type="hidden" name="id" value={payment.id} />
          <ConfirmSubmitButton className="rounded border border-red-600 px-4 py-2 text-red-700" message="Void this payment? This reverses its allocations and cannot be undone from this screen.">Void payment</ConfirmSubmitButton>
        </form>
      ) : null}
    </AppShell>
  );
}
