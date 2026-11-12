"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { formatCurrency } from "@/lib/records/format";
import { allocationPreview, type PaymentEnrollmentOption } from "@/lib/payments/allocation-preview";

export function PaymentAllocationFields({ familyId, enrollments, paymentMethod = "cash", notes = "" }: {
  familyId: string; enrollments: PaymentEnrollmentOption[]; paymentMethod?: string; notes?: string;
}) {
  const [mode, setMode] = useState<"automatic" | "manual">("automatic");
  const [amount, setAmount] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const { pending } = useFormStatus();
  const preview = allocationPreview(familyId, amount, mode, values, enrollments);
  const outstanding = enrollments.reduce((sum, row) => sum + row.remainingCents, 0);
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1 font-medium">Amount received<input name="amount" min="0.01" max={(outstanding / 100).toFixed(2)} step=".01" type="number" className="input" required value={amount} onChange={event => setAmount(event.target.value)} /></label>
      <label className="grid gap-1 font-medium">Payment method<select name="paymentMethod" defaultValue={paymentMethod} className="input"><option value="cash">Cash</option><option value="whish">Whish</option></select></label>
    </div>
    <label className="grid gap-1 text-sm font-medium">Notes (optional)<input name="notes" defaultValue={notes} className="input" /></label>
    <fieldset><legend className="mb-2 font-semibold">Allocate across this family’s students</legend>
      <div className="grid gap-3 sm:grid-cols-2">{(["automatic", "manual"] as const).map(value => <label key={value} className={`cursor-pointer rounded-xl border p-4 ${mode === value ? "border-primary bg-blue-50" : "bg-white"}`}>
        <span className="flex items-center gap-2 font-semibold"><input type="radio" name="allocationMode" value={value} checked={mode === value} onChange={() => setMode(value)} />{value === "automatic" ? "Automatic allocation" : "Choose allocations manually"}</span>
        <span className="mt-2 block text-sm text-muted-foreground">{value === "automatic" ? "Apply oldest enrollment balances first, across all students in this family." : "Enter how much to pay toward each eligible student enrollment below."}</span>
      </label>)}</div>
    </fieldset>
    <section aria-label="Enrollment allocations" className="space-y-3">
      <h3 className="font-semibold">{mode === "manual" ? "Manual allocations" : "Automatic allocation preview"}</h3>
      <p className="text-sm text-muted-foreground">All eligible enrollments are shown. Archived and settled enrollments are excluded. Balances are checked again when you save.</p>
      {enrollments.map(row => <div key={row.id} className="grid items-center gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_auto_9rem]">
        <div className="min-w-0"><p className="break-words font-semibold">{row.studentName}</p><p className="break-words text-sm text-muted-foreground">{row.courseName} · {row.levelName} · {row.seasonName}</p></div>
        <p className="text-sm">Remaining <strong>{formatCurrency(row.remainingCents)}</strong></p>
        {mode === "manual" ? <label className="grid gap-1 text-sm">Pay now — {row.studentName}<input type="number" min="0" max={(row.remainingCents / 100).toFixed(2)} step=".01" name={`allocation:${row.id}`} aria-label={`Allocate to ${row.studentName} — ${row.courseName}`} className="input" placeholder="0.00" value={values[row.id] ?? ""} onChange={event => setValues(previous => ({ ...previous, [row.id]: event.target.value }))} /></label> : <p className="text-sm">Pay now <strong>{formatCurrency(preview.allocations.find(item => item.enrollmentId === row.id)?.amountCents ?? 0)}</strong></p>}
      </div>)}
    </section>
    <div aria-live="polite" aria-atomic="true" className="rounded-xl border bg-slate-50 p-4">
      <dl className="grid gap-3 sm:grid-cols-3"><div><dt className="text-sm">Received</dt><dd className="font-bold">{formatCurrency(preview.amountCents)}</dd></div><div><dt className="text-sm">Allocated</dt><dd className="font-bold">{formatCurrency(preview.allocatedCents)}</dd></div><div><dt className="text-sm">{preview.unallocatedCents < 0 ? "Over-allocated" : "Unallocated"}</dt><dd className="font-bold">{formatCurrency(Math.abs(preview.unallocatedCents))}</dd></div></dl>
      <p className={`mt-3 text-sm ${preview.error ? "text-red-700" : "text-emerald-800"}`}>{preview.error ?? "The full payment is allocated. Ready to save."}</p>
    </div>
    <button className="btn-primary disabled:opacity-50" disabled={pending || Boolean(preview.error)}>{pending ? "Recording payment…" : "Create payment"}</button>
  </div>;
}
