import Link from "next/link";
import { saveExpense } from "@/actions/expenses";
import { FormSection } from "@/components/records/shell";
import { expensePaymentMethods, formatExpenseAmountInput } from "@/lib/expenses";

export type ExpenseFormValue = { id?: string; category?: string; description?: string; amountCents?: number; expenseDate?: Date; paymentMethod?: string };
const label = "grid gap-1 text-sm font-medium";
const input = "rounded-md border border-border p-2 text-sm";

export function ExpenseForm({ expense }: { expense?: ExpenseFormValue }) {
  return <form action={saveExpense} className="space-y-4">
    {expense?.id ? <input type="hidden" name="id" value={expense.id} /> : null}
    <FormSection title="Expense details" description="Fields marked with * are required for accurate financial reports.">
      <div className="grid gap-4 md:grid-cols-2">
        <label className={label}>Category *<input className={input} name="category" required defaultValue={expense?.category ?? ""} placeholder="Rent, supplies, utilities" /><span className="text-xs font-normal text-muted-foreground">Use consistent category names for cleaner reports.</span></label>
        <label className={label}>Payment method<select className={input} name="paymentMethod" defaultValue={expense?.paymentMethod ?? "cash"}>{expensePaymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
        <label className={label}>Amount *<input className={input} name="amount" type="number" step="0.01" min="0.01" required defaultValue={expense?.amountCents ? formatExpenseAmountInput(expense.amountCents) : ""} placeholder="0.00" /></label>
        <label className={label}>Date *<input className={input} name="expenseDate" type="date" required defaultValue={expense?.expenseDate ? expense.expenseDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)} /></label>
        <label className={`${label} md:col-span-2`}>Description *<textarea className={input} name="description" required defaultValue={expense?.description ?? ""} placeholder="Describe what this expense was for." /></label>
      </div>
    </FormSection>
    <div className="flex gap-3"><button className="rounded-md bg-primary px-4 py-2 font-medium text-white">{expense?.id ? "Save Expense" : "Add Expense"}</button><Link className="rounded-md border border-border bg-white px-4 py-2 font-medium" href="/expenses">Cancel</Link></div>
  </form>;
}
