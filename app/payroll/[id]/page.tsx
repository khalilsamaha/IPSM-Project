import Link from "next/link";
import { notFound } from "next/navigation";
import {
  approveTeacherPayroll,
  cancelTeacherPayroll,
  markTeacherPayrollPaid,
} from "@/actions/payroll";
import { reconcilePaidPayrollToShift } from "@/actions/payroll-shift-reconciliation";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import {
  AppShell,
  DataTable,
  MetricCard,
  PageHeader,
  StatusBadge,
} from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/records/format";
import { compensationRateLabel } from "@/lib/payroll/calculations";
import { formatPaymentMethod } from "@/lib/payment-methods";

type SearchParams = { error?: string; success?: string };

function auditMetadata(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export default async function PayrollDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [row, paidAudit] = await Promise.all([
    prisma.teacherPayroll.findUnique({
      where: { id },
      include: {
        teacher: true,
        approvedBy: true,
        items: {
          include: { scheduleSession: { include: { student: true } } },
          orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
        },
      },
    }),
    prisma.auditLog.findFirst({
      where: {
        entity: "TeacherPayroll",
        entityId: id,
        action: { in: ["mark_paid", "payroll_shift_reconciled"] },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!row) notFound();

  const basis = row.compensationBasisSnapshot ?? "HOURLY";
  const unitMinutes = row.rateUnitMinutesSnapshot ?? (basis === "SESSION_UNIT" ? 30 : 60);
  const rateCents = row.items[0]?.rateSnapshotCents ?? row.hourlyRateSnapshotCents;
  const completedItems = row.items.filter((item) => item.itemType === "COMPLETED");
  const paidMetadata = auditMetadata(paidAudit?.metadata);
  const paidShiftId = typeof paidMetadata.shiftId === "string" ? paidMetadata.shiftId : null;
  const paidMethod = typeof paidMetadata.paymentMethod === "string" ? paidMetadata.paymentMethod : null;

  return (
    <AppShell session={session}>
      <PageHeader
        title={`Payroll: ${row.teacher.fullName}`}
        description={`${formatDate(row.periodStart)} – ${formatDate(row.periodEnd)}. Approved and paid payrolls are locked; use cancellation with audit instead of silent edits.`}
      />

      {query.error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800" role="alert">
          {query.error}
        </div>
      ) : null}
      {query.success ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800" role="status">
          {query.success}
        </div>
      ) : null}

      <div className="mb-5 grid gap-4 md:grid-cols-5">
        <MetricCard label="Completed lessons" value={String(completedItems.length)} />
        <MetricCard label="Completed hours" value={(row.completedMinutes / 60).toFixed(2)} />
        <MetricCard label="Payable missed hours" value={(row.missedPayableMinutes / 60).toFixed(2)} />
        <MetricCard label="Adjustments" value={formatCurrency(row.adjustmentCents)} />
        <MetricCard label="Gross payroll" value={formatCurrency(row.grossAmountCents)} />
      </div>

      <section className="mb-5 rounded-[1.5rem] border bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={row.status} />
          <span>
            Rate snapshot: <b>{formatCurrency(rateCents)} {compensationRateLabel({ basis, unitMinutes })}</b>
          </span>
          <span>Approved: {row.approvedAt ? `${formatDate(row.approvedAt)} by ${row.approvedBy?.name ?? "—"}` : "—"}</span>
          <span>Paid: {row.paidAt ? formatDate(row.paidAt) : "—"}</span>
          {paidMethod ? <span>Method: <b>{formatPaymentMethod(paidMethod)}</b></span> : null}
          {paidShiftId ? <Link className="font-bold text-primary" href={`/shifts/${paidShiftId}`}>Open shift record</Link> : null}

          {row.status === "DRAFT" ? (
            <form action={approveTeacherPayroll}>
              <input type="hidden" name="id" value={row.id} />
              <button className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white">Approve</button>
            </form>
          ) : null}

          {row.status === "APPROVED" ? (
            <form action={markTeacherPayrollPaid} className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-2">
              <input type="hidden" name="id" value={row.id} />
              <label className="text-xs font-bold text-blue-950">
                Payment method
                <select name="paymentMethod" className="ml-2 rounded border bg-white p-2 text-sm" defaultValue="cash">
                  <option value="cash">Cash</option>
                  <option value="whish">Whish</option>
                </select>
              </label>
              <ConfirmSubmitButton
                className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white"
                message="Mark this payroll as paid and post it to your current open shift?"
              >
                Mark paid and add to shift
              </ConfirmSubmitButton>
            </form>
          ) : null}

          {row.status !== "PAID" && row.status !== "CANCELLED" ? (
            <form action={cancelTeacherPayroll}>
              <input type="hidden" name="id" value={row.id} />
              <ConfirmSubmitButton
                className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700"
                message="Cancel this payroll? This is audited."
              >
                Cancel
              </ConfirmSubmitButton>
            </form>
          ) : null}
        </div>

        {row.status === "APPROVED" ? (
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            Marking payroll paid requires an open shift. The payment is recorded as a <b>Teacher Payroll</b> expense, so cash or Whish totals and the shift closing report remain consistent.
          </p>
        ) : null}

        {row.status === "PAID" && !paidShiftId ? (
          <form action={reconcilePaidPayrollToShift} className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <input type="hidden" name="id" value={row.id} />
            <p className="font-black text-amber-950">This legacy paid payroll is not attached to a shift.</p>
            <p className="mt-1 text-sm text-amber-900">
              The old payment action did not capture Cash versus Whish. Select the actual method to add it once to your current open shift with an audit entry.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="text-sm font-bold text-amber-950">
                Actual payment method
                <select name="paymentMethod" className="ml-2 rounded border bg-white p-2" defaultValue="cash">
                  <option value="cash">Cash</option>
                  <option value="whish">Whish</option>
                </select>
              </label>
              <ConfirmSubmitButton
                className="rounded-xl bg-amber-600 px-3 py-2 text-sm font-bold text-white"
                message="Attach this already-paid payroll to the current open shift using the selected payment method?"
              >
                Attach paid payroll to current shift
              </ConfirmSubmitButton>
            </div>
          </form>
        ) : null}

        {row.notes ? <p className="mt-3 text-sm text-slate-600">{row.notes}</p> : null}
      </section>

      <DataTable>
        <thead>
          <tr><th>Date</th><th>Time</th><th>Student</th><th>Type</th><th>Minutes</th><th>Rate basis</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {row.items.map((item) => {
            const itemBasis = item.compensationBasisSnapshot ?? basis;
            const itemUnit = item.rateUnitMinutesSnapshot ?? unitMinutes;
            return (
              <tr key={item.id}>
                <td>{formatDate(item.sessionDate)}</td>
                <td>{item.startTime}–{item.endTime}</td>
                <td>
                  {item.scheduleSession?.student
                    ? `${item.scheduleSession.student.studentCode} — ${item.scheduleSession.student.firstName} ${item.scheduleSession.student.lastName}`
                    : "Adjustment"}
                </td>
                <td>{item.itemType}</td>
                <td>{item.minutes}</td>
                <td>{formatCurrency(item.rateSnapshotCents)} {compensationRateLabel({ basis: itemBasis, unitMinutes: itemUnit })}</td>
                <td>{formatCurrency(item.amountCents)}</td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </AppShell>
  );
}
