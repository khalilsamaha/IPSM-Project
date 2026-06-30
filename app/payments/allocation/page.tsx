import { createPayment } from "@/actions/records";
import { AppShell } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/dashboard/data";
import { formatCurrency } from "@/lib/records/format";

export default async function PaymentAllocationPage() {
  const session = await requireSession();
  const [families, enrollments] = await Promise.all([
    prisma.family.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.enrollment.findMany({ where: { remainingCents: { gt: 0 }, status: { in: ["ACTIVE", "PAUSED"] } }, include: { student: { include: { family: true } }, season: true }, orderBy: { updatedAt: "desc" } }),
  ]);
  return <AppShell session={session}><h2 className="mb-4 text-2xl font-bold">Payment allocation</h2><form action={createPayment} className="space-y-4 rounded-xl border bg-white p-4"><div className="grid gap-3 md:grid-cols-3"><select name="familyId" required className="rounded border p-2">{families.map((f)=><option key={f.id} value={f.id}>{f.name}</option>)}</select><input name="paymentDate" type="date" required defaultValue={new Date().toISOString().slice(0,10)} className="rounded border p-2"/><select name="paymentMethod" className="rounded border p-2"><option value="cash">Cash</option><option value="card">Card</option><option value="check">Check</option><option value="ach">ACH</option></select></div><textarea name="notes" placeholder="Notes" className="w-full rounded border p-2"/><div><h3 className="mb-2 font-semibold">Allocations</h3><div className="grid gap-2">{enrollments.map((e)=><label key={e.id} className="grid gap-2 rounded border p-3 md:grid-cols-[1fr_12rem]"><span><span className="font-medium">{e.student.family.name}: {e.student.firstName} {e.student.lastName}</span> — {e.courseName} ({e.season.name}) <span className="text-muted-foreground">Remaining {formatCurrency(e.remainingCents)}</span><input type="hidden" name="enrollmentId" value={e.id}/></span><input name="amount" type="number" step="0.01" min="0" max={(e.remainingCents/100).toFixed(2)} placeholder="0.00" className="rounded border p-2"/></label>)}</div></div><button className="rounded bg-primary px-4 py-2 text-white">Allocate payment and generate receipt</button></form></AppShell>;
}
