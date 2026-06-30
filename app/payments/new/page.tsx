import Link from "next/link";
import { createPayment } from "@/actions/payments";
import { AppShell } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/dashboard/data";
import { getOutstandingEnrollmentWhere } from "@/lib/payments/queries";
import { formatCurrency } from "@/lib/records/format";

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
          <p className="text-sm text-muted-foreground">
            Select a family first, then allocate payment only to that family&apos;s open enrollments.
          </p>
        </div>
        <Link className="rounded-md border border-border bg-white px-4 py-2 text-sm shadow-sm" href="/payments">
          Payment list
        </Link>
      </div>

      <form className="mb-6 rounded-xl border bg-white p-4" method="get">
        <label className="mb-2 block text-sm font-medium" htmlFor="familyId">
          Family
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            className="h-10 rounded-md border border-border bg-white px-3 text-sm"
            defaultValue={familyId}
            id="familyId"
            name="familyId"
            required
          >
            <option value="">Select a family</option>
            {families.map((family) => (
              <option key={family.id} value={family.id}>{family.name}</option>
            ))}
          </select>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white" type="submit">
            Show outstanding enrollments
          </button>
        </div>
      </form>

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      {familyId ? (
        enrollments.length > 0 ? (
          <form action={createPayment} className="rounded-xl border bg-white p-4">
            <input name="familyId" type="hidden" value={familyId} />
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <label className="text-sm font-medium">
                Payment method
                <select
                  className="mt-1 block h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  defaultValue="cash"
                  name="paymentMethod"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="check">Check</option>
                  <option value="ach">ACH</option>
                </select>
              </label>
              <label className="text-sm font-medium md:col-span-2">
                Notes
                <input
                  className="mt-1 block h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  name="notes"
                  placeholder="Optional notes"
                />
              </label>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3">Student</th>
                    <th>Season</th>
                    <th>Course</th>
                    <th>Teacher</th>
                    <th>Remaining</th>
                    <th>Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((enrollment) => (
                    <tr className="border-t" key={enrollment.id}>
                      <td className="p-3 font-medium">
                        {enrollment.student.firstName} {enrollment.student.lastName}
                      </td>
                      <td>{enrollment.season.name}</td>
                      <td>{enrollment.courseName}</td>
                      <td>{enrollment.teacher?.fullName ?? "—"}</td>
                      <td>{formatCurrency(enrollment.remainingCents)}</td>
                      <td>
                        <input
                          className="h-10 w-32 rounded-md border border-border px-3 text-sm"
                          max={(enrollment.remainingCents / 100).toFixed(2)}
                          min="0"
                          name={`allocation:${enrollment.id}`}
                          step="0.01"
                          type="number"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white" type="submit">
              Create payment
            </button>
          </form>
        ) : (
          <div className="rounded-xl border bg-white p-8 text-center text-muted-foreground">
            No outstanding enrollments found for this family.
          </div>
        )
      ) : null}
    </AppShell>
  );
}
