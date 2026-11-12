import { PaymentAllocationFields } from "@/components/payments-allocation-fields";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { createPayment } from "@/actions/payments";
import { AppShell } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { calculateFamilyFinancialSummary } from "@/lib/family-financial-summary";
import { isPayableFamilyEnrollment, payableFamilyOutstandingCents } from "@/lib/payments/payment-allocation";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/records/format";

export default async function Page({ searchParams }: { searchParams: Promise<{ familyId?: string; error?: string; paymentMethod?: string; notes?: string }> }) {
  const session = await requireSession();
  const { familyId = "", error, paymentMethod = "cash", notes = "" } = await searchParams;
  const families = await prisma.family.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } });
  const enrollments = familyId ? await prisma.enrollment.findMany({ where: { student: { familyId } }, include: { student: true, season: true, level: true }, orderBy: { createdAt: "desc" } }) : [];
  const payableEnrollments = enrollments.filter(isPayableFamilyEnrollment);
  const summary = calculateFamilyFinancialSummary(payableEnrollments, { familyId, logErrors: Boolean(familyId) });
  const payableOutstandingCents = payableFamilyOutstandingCents(payableEnrollments);

  return <AppShell session={session}>
    <h2 className="text-2xl font-bold">Create family payment</h2>
    <p className="mb-4 text-sm text-muted-foreground">Payments are recorded only against active, non-archived enrollment balances. Historical and settled enrollments remain available in reports but are excluded from the payable total.</p>
    {error ? <p className="card text-red-700">{error}</p> : null}
    <form method="get" className="card"><select name="familyId" defaultValue={familyId} className="input"><option value="">Select family</option>{families.map((family) => <option value={family.id} key={family.id}>{family.familyCode} — {family.name}</option>)}</select><button className="btn-secondary mt-2">Load balances</button></form>
    {familyId ? <form action={createPayment} className="card mt-4">
      <input type="hidden" name="familyId" value={familyId}/>
      <input type="hidden" name="requestId" value={randomUUID()}/>
      <section className="mb-4 grid gap-3 sm:grid-cols-3">{[["Active registered amount", summary.totalAmountCents], ["Paid on active enrollments", summary.paidCents], ["Payable outstanding", payableOutstandingCents]].map(([label, value]) => <div className="rounded border p-3" key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="font-bold">{formatCurrency(value as number)}</p></div>)}</section>
      {payableOutstandingCents > 0 ? <>
        <PaymentAllocationFields familyId={familyId} paymentMethod={paymentMethod} notes={notes} enrollments={payableEnrollments.map(row => ({
          id: row.id, familyId, remainingCents: row.remainingCents, startDate: row.enrollmentStartDate.toISOString(), createdAt: row.createdAt.toISOString(),
          studentName: `${row.student.firstName} ${row.student.lastName}`, courseName: row.courseName,
          levelName: row.level?.name ?? "All levels", seasonName: row.season.name,
        }))} />
      </> : <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">This family has no payable balance on an active enrollment.</p>}
    </form> : null}
    <Link href="/payments">Payment list</Link>
  </AppShell>;
}
