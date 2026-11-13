import { notFound } from "next/navigation";
import { closeShift, reopenShift } from "@/actions/shifts";
import { AppShell, DataTable, PageHeader, StatusBadge } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import {
  formatCurrency,
  formatCurrencyInput,
  formatFormalDate,
  formatFormalDateTime,
} from "@/lib/records/format";
import {
  calculateShiftTotals,
  isTeacherPayrollExpense,
} from "@/lib/shifts/calculations";
import { PrintReportButton } from "@/components/print-report-button";
import { formatPaymentMethod } from "@/lib/payment-methods";
import { describeShiftPaymentAllocations } from "@/lib/shifts/payment-details";

export default async function ShiftDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const query = await searchParams;
  const shift = await prisma.cashierShift.findUnique({
    where: { id },
    include: {
      user: true,
      closedBy: true,
      reopenedBy: true,
      payments: {
        include: {
          family: true,
          items: { include: { enrollment: { include: { student: true, season: true, course: true, level: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
      expenses: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!shift) notFound();

  const totals = calculateShiftTotals({
    openingCashCents: shift.openingCashCents,
    payments: shift.payments,
    expenses: shift.expenses,
  });
  const payrollExpenses = shift.expenses.filter(
    (expense) => !expense.archivedAt && isTeacherPayrollExpense(expense),
  );
  const operatingExpenses = shift.expenses.filter(
    (expense) => !isTeacherPayrollExpense(expense),
  );
  const audits = await prisma.auditLog.findMany({
    where: {
      entity: "CashierShift",
      entityId: id,
      action: { in: ["reopen", "close", "open", "auto_close", "reconcile_auto_close"] },
    },
    include: { createdBy: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <AppShell session={session}>
      <div className="print:hidden">
        <PageHeader
          title="Shift Closing Report"
          description="Printable controlled cash, Whish, expense and teacher-payroll shift report."
        />
      </div>

      {query?.error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 font-bold text-red-700 print:hidden" role="alert">
          {query.error}
        </div>
      ) : null}
      {query?.success ? (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 p-3 font-bold text-emerald-800 print:hidden" role="status">
          {query.success}
        </div>
      ) : null}
      {shift.status === "AUTO_CLOSED" ? (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 font-bold text-amber-900">
          Automatically closed at the business-day boundary — enter the counted cash below to reconcile it.
        </div>
      ) : null}
      {["CLOSED", "AUTO_CLOSED"].includes(shift.status) ? (
        <div className="mb-4 flex gap-2 print:hidden">
          <a className="rounded border px-4 py-2" href={`/api/shifts/${shift.id}/export?format=pdf`}>Download PDF</a>
          <a className="rounded border px-4 py-2" href={`/api/shifts/${shift.id}/export?format=csv`}>Export CSV</a>
          <PrintReportButton />
        </div>
      ) : null}

      <section className="rounded-xl border bg-white p-5">
        <div className="flex justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Closing Report</h1>
            <p>Business date: {formatFormalDate(shift.businessDate)}</p>
            <p>Receptionist: {shift.user.name}</p>
            <p>Opened: {formatFormalDateTime(shift.openedAt)} · Closed: {formatFormalDateTime(shift.closedAt)}</p>
          </div>
          <StatusBadge status={shift.status} />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {[
            ["Opening cash", shift.openingCashCents],
            ["Cash payments", totals.cashPaymentsCents],
            ["Whish payments", totals.whishPaymentsCents],
            ["Cash payroll", totals.cashPayrollCents],
            ["Whish payroll", totals.whishPayrollCents],
            ["Other expenses", totals.operatingExpenseCents],
            ["All cash expenses", totals.cashExpensesCents],
            ["All Whish expenses", totals.whishExpensesCents],
            ["Expected cash", totals.expectedCashCents],
            ["Declared cash", shift.declaredCashCents],
            ["Difference", shift.differenceCents],
          ].map(([label, value]) => (
            <div className="rounded border p-3" key={label as string}>
              <p className="text-xs uppercase text-muted-foreground">{label}</p>
              <p className="font-bold">{value == null ? "—" : formatCurrency(value as number)}</p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm">
          Payments: {totals.postedPaymentCount}; teacher payroll payments: {totals.payrollExpenseCount}; other expenses: {totals.operatingExpenseCount}; voided payments: {totals.voidedPaymentCount}. Closing user: {shift.closedBy?.name ?? "—"}.
        </p>
        {shift.differenceCents != null ? (
          <p className="mt-2 font-semibold">
            {shift.differenceCents === 0 ? "Balanced" : shift.differenceCents > 0 ? "Cash over" : "Cash short"}
          </p>
        ) : null}
        {shift.varianceReason ? <p className="mt-2 text-sm">Variance reason: {shift.varianceReason}</p> : null}
        {shift.notes ? <p className="mt-2 whitespace-pre-wrap text-sm">Notes: {shift.notes}</p> : null}
      </section>

      {shift.status !== "CLOSED" ? (
        <form action={closeShift} className="my-4 grid gap-3 rounded-xl border bg-white p-4 print:hidden">
          <input type="hidden" name="id" value={shift.id} />
          <label className="font-bold">
            Declared cash
            <input
              className="ml-2 rounded border p-2"
              type="number"
              min="0"
              step="0.01"
              name="declaredCash"
              defaultValue={formatCurrencyInput(totals.expectedCashCents)}
              required
            />
          </label>
          <label className="font-bold">
            Explain the cash difference
            <input className="ml-2 rounded border p-2" name="varianceReason" />
          </label>
          <label className="font-bold">
            Optional close note
            <input className="ml-2 rounded border p-2" name="closeNote" />
          </label>
          <p className="text-sm text-muted-foreground">
            Expected cash already deducts cash teacher payroll and other cash expenses. A variance reason is required whenever declared cash differs from expected cash.
          </p>
          <button className="w-fit rounded bg-primary px-4 py-2 text-white">
            {shift.status === "AUTO_CLOSED" ? "Reconcile and finalize shift" : "Review and close shift"}
          </button>
        </form>
      ) : null}

      {isAdminOrHigher(session.role) && shift.status === "CLOSED" ? (
        <form action={reopenShift} className="my-4 rounded-xl border border-amber-200 bg-amber-50 p-4 print:hidden">
          <input type="hidden" name="id" value={shift.id} />
          <label>Reason<input className="ml-2 rounded border p-2" name="reason" required /></label>
          <button className="ml-3 rounded bg-amber-600 px-4 py-2 text-white">Reopen with audit entry</button>
        </form>
      ) : null}

      <h3 className="mb-2 mt-6 font-bold">Student / family payments received</h3>
      <DataTable>
        <thead><tr><th>Receipt</th><th>Payer</th><th>Student / activity details</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>
          {shift.payments.map((payment) => {
            const details = describeShiftPaymentAllocations(payment.items);
            return <tr key={payment.id}>
              <td>{payment.receiptNumber ?? "—"}</td>
              <td>{payment.family.name}</td>
              <td className="min-w-48">
                <p className="font-semibold">{details.students || "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Activities: {details.activities || "—"}</p>
                <p className="text-xs text-muted-foreground">Seasons: {details.seasons || "—"}</p>
                {payment.notes ? <p className="mt-1 whitespace-pre-wrap text-xs">Notes: {payment.notes}</p> : null}
              </td>
              <td>{formatPaymentMethod(payment.paymentMethod)}</td>
              <td>{formatCurrency(payment.totalAmountCents)}</td>
              <td>{payment.voidedAt ? "Voided" : "Posted"}</td>
            </tr>;
          })}
        </tbody>
      </DataTable>

      <h3 className="mb-2 mt-6 font-bold">Teacher payroll paid during this shift</h3>
      <DataTable>
        <thead><tr><th>Date</th><th>Teacher / payroll</th><th>Method</th><th>Amount</th></tr></thead>
        <tbody>
          {payrollExpenses.length ? payrollExpenses.map((expense) => (
            <tr key={expense.id}>
              <td>{formatFormalDate(expense.expenseDate)}</td>
              <td>{expense.description}</td>
              <td>{formatPaymentMethod(expense.paymentMethod)}</td>
              <td>{formatCurrency(expense.amountCents)}</td>
            </tr>
          )) : <tr><td colSpan={4}>No teacher payroll was paid during this shift.</td></tr>}
        </tbody>
      </DataTable>

      <h3 className="mb-2 mt-6 font-bold">Other expenses</h3>
      <DataTable>
        <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>
          {operatingExpenses.map((expense) => (
            <tr key={expense.id}>
              <td>{formatFormalDate(expense.expenseDate)}</td>
              <td>{expense.category}</td>
              <td>{expense.description}</td>
              <td>{formatPaymentMethod(expense.paymentMethod)}</td>
              <td>{formatCurrency(expense.amountCents)}</td>
              <td>{expense.archivedAt ? "Archived" : "Active"}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      <h3 className="mb-2 mt-6 font-bold">Closing and reopening history</h3>
      <ul className="rounded-xl border bg-white p-4">
        {audits.map((audit) => (
          <li key={audit.id}>
            {formatFormalDateTime(audit.createdAt)} — {audit.action} by {audit.createdBy?.name ?? "system"}
            {audit.action === "reopen" ? ` — reason: ${readAuditReason(audit.metadata)}` : ""}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}

function readAuditReason(metadata: unknown) {
  if (metadata && typeof metadata === "object" && "reason" in metadata) {
    return String((metadata as { reason?: unknown }).reason ?? "not provided");
  }
  return "not provided";
}
