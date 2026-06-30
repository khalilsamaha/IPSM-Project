import Link from "next/link";
import { createPayment } from "@/actions/payments";
import { createPayment } from "@/actions/records";
import { AppShell } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/dashboard/data";
import { formatCurrency } from "@/lib/records/format";
import { getOutstandingEnrollmentWhere } from "@/lib/payments/queries";

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ familyId?: string; error?: string }>;
}) {
  const session = await requireSession();
  const { familyId = "", error } = await searchParams;
  const [families, enrollments] = await Promise.all([
    prisma.family.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    familyId
      ? prisma.enrollment.findMany({
          where: getOutstandingEnrollmentWhere(familyId),
          include: { student: true, season: true, teacher: true },
          orderBy: [{ student: { lastName: "asc" } }, { courseName: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  return (
    <AppShell session={session}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Create Payment</h2>
          <p className="text-sm text-muted-foreground">Select a family first, then allocate payment only to that family's open enrollments.</p>
        </div>
        <Link className="rounded-md border border-border bg-white px-4 py-2 text-sm shadow-sm" href="/payments">Payment list</Link>
      </div>

      <form className="mb-6 rounded-xl border bg-white p-4" method="get">
        <label className="mb-2 block text-sm font-medium" htmlFor="familyId">Family</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <select className="h-10 rounded-md border border-border bg-white px-3 text-sm" id="familyId" name="familyId" required defaultValue={familyId}>
            <option value="">Select a family</option>
            {families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}
          </select>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white" type="submit">Show outstanding enrollments</button>
        </div>
      </form>

      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div> : null}

      {familyId ? (
        enrollments.length > 0 ? (
          <form action={createPayment} className="rounded-xl border bg-white p-4">
            <input type="hidden" name="familyId" value={familyId} />
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <label className="text-sm font-medium">Payment method
                <select className="mt-1 block h-10 w-full rounded-md border border-border bg-white px-3 text-sm" name="paymentMethod" defaultValue="cash">
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="check">Check</option>
                  <option value="ach">ACH</option>
                </select>
              </label>
              <label className="text-sm font-medium md:col-span-2">Notes
                <input className="mt-1 block h-10 w-full rounded-md border border-border bg-white px-3 text-sm" name="notes" placeholder="Optional notes" />
              </label>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted"><tr><th className="p-3">Student</th><th>Season</th><th>Course</th><th>Teacher</th><th>Remaining</th><th>Allocation</th></tr></thead>
                <tbody>
                  {enrollments.map((enrollment) => (
                    <tr className="border-t" key={enrollment.id}>
                      <td className="p-3 font-medium">{enrollment.student.firstName} {enrollment.student.lastName}</td>
                      <td>{enrollment.season.name}</td>
                      <td>{enrollment.courseName}</td>
                      <td>{enrollment.teacher?.fullName ?? "—"}</td>
                      <td>{formatCurrency(enrollment.remainingCents)}</td>
                      <td><input className="h-10 w-32 rounded-md border border-border px-3 text-sm" min="0" max={(enrollment.remainingCents / 100).toFixed(2)} name={`allocation:${enrollment.id}`} step="0.01" type="number" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white" type="submit">Create payment</button>
          </form>
        ) : (
          <div className="rounded-xl border bg-white p-8 text-center text-muted-foreground">No outstanding enrollments found for this family.</div>
        )
      ) : null}
    </AppShell>
  );

export default async function NewPaymentPage() {
  const session = await requireSession();
  const [families, enrollments] = await Promise.all([
    prisma.family.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.enrollment.findMany({ where: { remainingCents: { gt: 0 }, status: { in: ["ACTIVE", "PAUSED"] } }, include: { student: { include: { family: true } }, season: true }, orderBy: { updatedAt: "desc" } }),
  ]);
  return <AppShell session={session}><h2 className="mb-4 text-2xl font-bold">Create payment</h2><form action={createPayment} className="space-y-4 rounded-xl border bg-white p-4"><div className="grid gap-3 md:grid-cols-3"><select name="familyId" required className="rounded border p-2">{families.map((f)=><option key={f.id} value={f.id}>{f.name}</option>)}</select><input name="paymentDate" type="date" required defaultValue={new Date().toISOString().slice(0,10)} className="rounded border p-2"/><select name="paymentMethod" className="rounded border p-2"><option value="cash">Cash</option><option value="card">Card</option><option value="check">Check</option><option value="ach">ACH</option></select></div><textarea name="notes" placeholder="Notes" className="w-full rounded border p-2"/><div><h3 className="mb-2 font-semibold">Allocations</h3><div className="grid gap-2">{enrollments.map((e)=><label key={e.id} className="grid gap-2 rounded border p-3 md:grid-cols-[1fr_12rem]"><span><span className="font-medium">{e.student.family.name}: {e.student.firstName} {e.student.lastName}</span> — {e.courseName} ({e.season.name}) <span className="text-muted-foreground">Remaining {formatCurrency(e.remainingCents)}</span><input type="hidden" name="enrollmentId" value={e.id}/></span><input name="amount" type="number" step="0.01" min="0" max={(e.remainingCents/100).toFixed(2)} placeholder="0.00" className="rounded border p-2"/></label>)}</div></div><button className="rounded bg-primary px-4 py-2 text-white">Create payment and receipt</button></form></AppShell>;
}
