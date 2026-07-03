import Link from "next/link";
import { createPayment } from "@/actions/payments";
import { AppShell } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getOutstandingEnrollmentWhere } from "@/lib/payments/queries";
import { formatCurrency } from "@/lib/records/format";

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ familyId?: string; error?: string }>;
}) {
  const session = await requireSession();
  const { familyId = "", error } = await searchParams;
  const [families, enrollments, independentCount] = await Promise.all([
    prisma.family.findMany({
      where: { status: "ACTIVE" },
      include: { students: { select: { firstName: true, lastName: true, studentCode: true } } },
      orderBy: { name: "asc" },
    }),
    familyId
      ? prisma.enrollment.findMany({
          where: getOutstandingEnrollmentWhere(familyId),
          include: { student: true, season: true, teacher: true, level: true },
          orderBy: [{ season: { startDate: "asc" } }, { student: { lastName: "asc" } }, { courseName: "asc" }],
        })
      : Promise.resolve([]),
    prisma.student.count({ where: { familyId: null, status: "ACTIVE" } }),
  ]);

  const selectedFamily = families.find((family) => family.id === familyId);
  const totalOutstanding = enrollments.reduce((sum, enrollment) => sum + enrollment.remainingCents, 0);
  const seasonBalances = Array.from(
    enrollments.reduce((map, enrollment) => {
      const current = map.get(enrollment.season.name) ?? 0;
      map.set(enrollment.season.name, current + enrollment.remainingCents);
      return map;
    }, new Map<string, number>()),
  );

  return (
    <AppShell session={session}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Create Payment</h2>
          <p className="text-sm text-muted-foreground">Search for a Family / Group payer, then review all open student balances before allocating payment.</p>
        </div>
        <Link className="rounded-md border border-border bg-white px-4 py-2 text-sm shadow-sm" href="/payments">Payment list</Link>
      </div>

      <form className="mb-6 rounded-xl border bg-white p-4" method="get">
        <label className="mb-2 block text-sm font-medium" htmlFor="familySearch">Search Family / Group</label>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <input className="h-10 rounded-md border border-border bg-white px-3 text-sm" id="familySearch" list="family-options" name="familyId" required defaultValue={familyId} placeholder="Search by family, parent, phone/email, student name, or Student ID" />
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white" type="submit">Show outstanding balances</button>
        </div>
        <datalist id="family-options">
          {families.map((family) => {
            const parents = [[family.fatherFirstName, family.fatherLastName].filter(Boolean).join(" "), [family.motherFirstName, family.motherLastName].filter(Boolean).join(" ")].filter(Boolean).join(" / ");
            const students = family.students.map((student) => `${student.firstName} ${student.lastName} (${student.studentCode})`).join(", ");
            const contacts = [family.email, family.phone, family.fatherEmail, family.fatherPhone, family.motherEmail, family.motherPhone].filter(Boolean).join(" · ");
            return <option key={family.id} value={family.id} label={[family.name, parents, contacts, students].filter(Boolean).join(" — ")} />;
          })}
        </datalist>
        <p className="mt-2 text-xs text-muted-foreground">Payments remain family-based. Independent students without a Family / Group must be assigned to or registered with a payer group before payment can be collected. Active independent students needing a payer: {independentCount}.</p>
      </form>

      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div> : null}

      {familyId ? (
        enrollments.length > 0 ? (
          <form action={createPayment} className="rounded-xl border bg-white p-4">
            <input type="hidden" name="familyId" value={familyId} />
            <div className="mb-4 rounded-lg bg-muted p-4">
              <h3 className="font-semibold">Outstanding overview{selectedFamily ? ` for ${selectedFamily.name}` : ""}</h3>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">{seasonBalances.map(([season, cents]) => <span className="rounded-full bg-white px-3 py-1" key={season}>{season}: {cents > 0 ? `${formatCurrency(cents)} remaining` : "paid"}</span>)}</div>
              <p className="mt-3 text-lg font-bold">Total outstanding: {formatCurrency(totalOutstanding)}</p>
            </div>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="text-sm font-medium">Payment method<select className="mt-1 block h-10 w-full rounded-md border border-border bg-white px-3 text-sm" name="paymentMethod" defaultValue="cash"><option value="cash">Cash</option><option value="card">Card</option><option value="check">Check</option><option value="ach">ACH</option></select></label><label className="text-sm font-medium md:col-span-2">Notes<input className="mt-1 block h-10 w-full rounded-md border border-border bg-white px-3 text-sm" name="notes" placeholder="Optional notes" /></label></div>
            <div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr><th className="p-3">Student ID</th><th>Student</th><th>Season</th><th>Course</th><th>Level</th><th>Amount due</th><th>Paid</th><th>Remaining</th><th>Allocation</th></tr></thead><tbody>{enrollments.map((enrollment) => <tr className="border-t" key={enrollment.id}><td className="p-3 font-mono text-xs font-bold">{enrollment.student.studentCode}</td><td className="font-medium">{enrollment.student.firstName} {enrollment.student.lastName}</td><td>{enrollment.season.name}</td><td>{enrollment.courseName}</td><td>{enrollment.level?.name ?? "—"}</td><td>{formatCurrency(enrollment.finalFeeCents)}</td><td>{formatCurrency(enrollment.paidCents)}</td><td>{formatCurrency(enrollment.remainingCents)}</td><td><input className="h-10 w-32 rounded-md border border-border px-3 text-sm" min="0" max={(enrollment.remainingCents / 100).toFixed(2)} name={`allocation:${enrollment.id}`} step="0.01" type="number" /></td></tr>)}</tbody></table></div>
            <button className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white" type="submit">Create payment</button>
          </form>
        ) : <div className="rounded-xl border bg-white p-8 text-center text-muted-foreground">No outstanding enrollments found for this family.</div>
      ) : null}
    </AppShell>
  );
}
