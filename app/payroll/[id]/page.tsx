import { notFound } from "next/navigation";
import { approveTeacherPayroll, cancelTeacherPayroll, markTeacherPayrollPaid } from "@/actions/payroll";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { AppShell, DataTable, MetricCard, PageHeader, StatusBadge } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/records/format";

export default async function PayrollDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(); const { id } = await params;
  const row = await prisma.teacherPayroll.findUnique({ where: { id }, include: { teacher: true, approvedBy: true, items: { include: { scheduleSession: { include: { student: true } } }, orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }] } } });
  if (!row) notFound();
  return <AppShell session={session}><PageHeader title={`Payroll: ${row.teacher.fullName}`} description={`${formatDate(row.periodStart)} – ${formatDate(row.periodEnd)}. Approved and paid payrolls are locked; use cancellation with audit instead of silent edits.`} />
    <div className="mb-5 grid gap-4 md:grid-cols-4"><MetricCard label="Completed hours" value={(row.completedMinutes / 60).toFixed(2)} /><MetricCard label="Payable missed hours" value={(row.missedPayableMinutes / 60).toFixed(2)} /><MetricCard label="Adjustments" value={formatCurrency(row.adjustmentCents)} /><MetricCard label="Gross payroll" value={formatCurrency(row.grossAmountCents)} /></div>
    <section className="mb-5 rounded-[1.5rem] border bg-white p-4"><div className="flex flex-wrap items-center gap-3"><StatusBadge status={row.status}/><span>Rate snapshot: <b>{formatCurrency(row.hourlyRateSnapshotCents)}</b></span><span>Approved: {row.approvedAt ? `${formatDate(row.approvedAt)} by ${row.approvedBy?.name ?? "—"}` : "—"}</span><span>Paid: {formatDate(row.paidAt)}</span>{row.status === "DRAFT" ? <form action={approveTeacherPayroll}><input type="hidden" name="id" value={row.id}/><button className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white">Approve</button></form> : null}{row.status === "APPROVED" ? <form action={markTeacherPayrollPaid}><input type="hidden" name="id" value={row.id}/><button className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white">Mark paid</button></form> : null}{row.status !== "PAID" && row.status !== "CANCELLED" ? <form action={cancelTeacherPayroll}><input type="hidden" name="id" value={row.id}/><ConfirmSubmitButton className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700" message="Cancel this payroll? This is audited.">Cancel</ConfirmSubmitButton></form> : null}</div>{row.notes ? <p className="mt-3 text-sm text-slate-600">{row.notes}</p> : null}</section>
    <DataTable><thead><tr><th>Date</th><th>Time</th><th>Student</th><th>Type</th><th>Minutes</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{row.items.map((item) => <tr key={item.id}><td>{formatDate(item.sessionDate)}</td><td>{item.startTime}–{item.endTime}</td><td>{item.scheduleSession?.student ? `${item.scheduleSession.student.studentCode} — ${item.scheduleSession.student.firstName} ${item.scheduleSession.student.lastName}` : "Adjustment"}</td><td>{item.itemType}</td><td>{item.minutes}</td><td>{formatCurrency(item.rateSnapshotCents)}</td><td>{formatCurrency(item.amountCents)}</td></tr>)}</tbody></DataTable>
  </AppShell>;
}
