import Link from "next/link";
import { createPayment } from "@/actions/payments";
import { AppShell } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { calculateFamilyFinancialSummary } from "@/lib/family-financial-summary";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/records/format";

export default async function Page({ searchParams }: { searchParams: Promise<{ familyId?: string; error?: string; paymentMethod?: string; notes?: string }> }) {
  const session = await requireSession();
  const { familyId = "", error, paymentMethod = "cash", notes = "" } = await searchParams;
  const families = await prisma.family.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } });
  const enrollments = familyId ? await prisma.enrollment.findMany({ where: { student: { familyId } }, include: { student: true, season: true, level: true }, orderBy: { createdAt: "desc" } }) : [];
  const summary = calculateFamilyFinancialSummary(enrollments, { familyId, logErrors: Boolean(familyId) });

  return <AppShell session={session}>
    <h2 className="text-2xl font-bold">Create family payment</h2>
    <p className="mb-4 text-sm text-muted-foreground">Payments are always recorded for a family. Settled enrollments remain visible for reconciliation.</p>
    {error ? <p className="card text-red-700">{error}</p> : null}
    <form method="get" className="card"><select name="familyId" defaultValue={familyId} className="input"><option value="">Select family</option>{families.map((family) => <option value={family.id} key={family.id}>{family.familyCode} — {family.name}</option>)}</select><button className="btn-secondary mt-2">Load balances</button></form>
    {familyId ? <form action={createPayment} className="card mt-4">
      <input type="hidden" name="familyId" value={familyId}/>
      <section className="mb-4 grid gap-3 sm:grid-cols-3">{[["Total registered amount", summary.totalAmountCents], ["Total paid", summary.paidCents], ["Total remaining", summary.remainingCents]].map(([label, value]) => <div className="rounded border p-3" key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="font-bold">{formatCurrency(value as number)}</p></div>)}</section>
      <p className="mb-3 text-sm">Amount being recorded is the sum of “Pay now” entries. The server validates the complete family balance; remaining after payment is total remaining less that sum.</p>
      <select name="paymentMethod" defaultValue={paymentMethod} className="input"><option value="cash">Cash</option><option value="whish">Whish</option></select>
      <input name="notes" defaultValue={notes} className="input mt-2" placeholder="Optional notes"/>
      <div className="overflow-x-auto"><table className="mt-4 w-full text-sm"><thead><tr><th>Student ID</th><th>Student</th><th>Season</th><th>Activity</th><th>Level</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Pay now</th></tr></thead><tbody>{enrollments.map((enrollment) => <tr key={enrollment.id} className="border-t"><td>{enrollment.student.studentCode}</td><td>{enrollment.student.firstName} {enrollment.student.lastName}</td><td>{enrollment.season.name}</td><td>{enrollment.courseName}</td><td>{enrollment.level?.name ?? "—"}</td><td>{formatCurrency(enrollment.finalFeeCents)}</td><td>{formatCurrency(enrollment.paidCents)}</td><td>{formatCurrency(enrollment.remainingCents)}</td><td><input disabled={!enrollment.remainingCents} max={(enrollment.remainingCents / 100).toFixed(2)} min="0" step=".01" type="number" name={`allocation:${enrollment.id}`} className="input w-28"/></td></tr>)}</tbody></table></div>
      <button className="btn-primary mt-4">Create payment</button>
    </form> : null}
    <Link href="/payments">Payment list</Link>
  </AppShell>;
}
