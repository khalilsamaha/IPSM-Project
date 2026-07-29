import { notFound } from "next/navigation";
import { closeShift, reopenShift } from "@/actions/shifts";
import { AppShell, DataTable, PageHeader, StatusBadge } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatFormalDate, formatFormalDateTime } from "@/lib/records/format";
import { calculateShiftTotals } from "@/lib/shifts/calculations";

export default async function ShiftDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ error?: string }> }) {
  const session = await requireSession(); const { id } = await params; const sp = await searchParams;
  const shift = await prisma.cashierShift.findUnique({ where: { id }, include: { user: true, closedBy: true, reopenedBy: true, payments: { include: { family: true }, orderBy: { createdAt: "asc" } }, expenses: { orderBy: { createdAt: "asc" } } } });
  if (!shift) notFound();
  const totals = calculateShiftTotals({ openingCashCents: shift.openingCashCents, payments: shift.payments, expenses: shift.expenses });
  const audits = await prisma.auditLog.findMany({ where: { entity: "CashierShift", entityId: id, action: { in: ["reopen", "close", "open"] } }, include: { createdBy: true }, orderBy: { createdAt: "asc" } });
  return <AppShell session={session}><div className="print:hidden"><PageHeader title="Shift Closing Report" description="Printable controlled cash and Whish shift report." /></div>
    {sp?.error ? <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-red-700 print:hidden">{sp.error}</div> : null}
    <section className="rounded-xl border bg-white p-5"><div className="flex justify-between"><div><h1 className="text-2xl font-bold">Closing Report</h1><p>Business date: {formatFormalDate(shift.businessDate)}</p><p>Receptionist: {shift.user.name}</p><p>Opened: {formatFormalDateTime(shift.openedAt)} · Closed: {formatFormalDateTime(shift.closedAt)}</p></div><StatusBadge status={shift.status} /></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Opening cash", shift.openingCashCents], ["Cash payments", totals.cashPaymentsCents], ["Whish payments", totals.whishPaymentsCents], ["Cash expenses", totals.cashExpensesCents], ["Whish expenses", totals.whishExpensesCents], ["Expected cash", totals.expectedCashCents], ["Declared cash", shift.declaredCashCents], ["Difference", shift.differenceCents]].map(([label, value]) => <div className="rounded border p-3" key={label as string}><p className="text-xs uppercase text-muted-foreground">{label}</p><p className="font-bold">{value == null ? "—" : formatCurrency(value as number)}</p></div>)}</div>
    <p className="mt-3 text-sm">Payments: {totals.postedPaymentCount}; Expenses: {totals.expenseCount}; Voided payments: {totals.voidedPaymentCount}. Closing user: {shift.closedBy?.name ?? "—"}.</p>
    {shift.differenceCents != null ? <p className="mt-2 font-semibold">{shift.differenceCents === 0 ? "Balanced" : shift.differenceCents > 0 ? "Cash over" : "Cash short"}</p> : null}
    {shift.varianceReason ? <p className="mt-2 text-sm">Variance reason: {shift.varianceReason}</p> : null}{shift.notes ? <p className="mt-2 whitespace-pre-wrap text-sm">Notes: {shift.notes}</p> : null}</section>
    {shift.status !== "CLOSED" ? <form action={closeShift} className="my-4 grid gap-3 rounded-xl border bg-white p-4 print:hidden"><input type="hidden" name="id" value={shift.id}/><label>Declared cash<input className="ml-2 rounded border p-2" type="number" min="0" step="0.01" name="declaredCash" required /></label><label>Explain the cash difference<input className="ml-2 rounded border p-2" name="varianceReason" /></label><label>Optional close note<input className="ml-2 rounded border p-2" name="closeNote" /></label><p className="text-sm text-muted-foreground">A variance reason is required whenever declared cash differs from expected cash.</p><button className="w-fit rounded bg-primary px-4 py-2 text-white" formAction={closeShift}>Review and close shift</button></form> : null}
    {isAdminOrHigher(session.role) && shift.status === "CLOSED" ? <form action={reopenShift} className="my-4 rounded-xl border border-amber-200 bg-amber-50 p-4 print:hidden"><input type="hidden" name="id" value={shift.id}/><label>Reason<input className="ml-2 rounded border p-2" name="reason" required /></label><button className="ml-3 rounded bg-amber-600 px-4 py-2 text-white">Reopen with audit entry</button></form> : null}
    <h3 className="mb-2 mt-6 font-bold">Payments</h3><DataTable><thead><tr><th>Receipt</th><th>Payer</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead><tbody>{shift.payments.map((p) => <tr key={p.id}><td>{p.receiptNumber ?? "—"}</td><td>{p.family.name}</td><td>{p.paymentMethod}</td><td>{formatCurrency(p.totalAmountCents)}</td><td>{p.voidedAt ? "Voided" : "Posted"}</td></tr>)}</tbody></DataTable>
    <h3 className="mb-2 mt-6 font-bold">Expenses</h3><DataTable><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead><tbody>{shift.expenses.map((e) => <tr key={e.id}><td>{formatFormalDate(e.expenseDate)}</td><td>{e.category}</td><td>{e.description}</td><td>{e.paymentMethod}</td><td>{formatCurrency(e.amountCents)}</td><td>{e.archivedAt ? "Archived" : "Active"}</td></tr>)}</tbody></DataTable>
    <h3 className="mb-2 mt-6 font-bold">Reopening history</h3><ul className="rounded-xl border bg-white p-4">{audits.map((a) => <li key={a.id}>{formatFormalDateTime(a.createdAt)} — {a.action} by {a.createdBy?.name ?? "system"}{a.action === "reopen" ? ` — reason: ${readAuditReason(a.metadata)}` : ""}</li>)}</ul>
  </AppShell>;
}

function readAuditReason(metadata: unknown) {
  if (metadata && typeof metadata === "object" && "reason" in metadata) return String((metadata as { reason?: unknown }).reason ?? "not provided");
  return "not provided";
}
