import { saveExpense } from "@/actions/expenses";
import { expensePaymentMethods, formatExpenseAmountInput } from "@/lib/expenses";

export type ExpenseFormValue = {
  id?: string;
  category?: string;
  description?: string;
  amountCents?: number;
  expenseDate?: Date;
  paymentMethod?: string;
};

export function ExpenseForm({ expense }: { expense?: ExpenseFormValue }) {
  return (
    <form action={saveExpense} className="grid gap-4 rounded-xl border bg-white p-4 md:grid-cols-2">
      {expense?.id ? <input type="hidden" name="id" value={expense.id} /> : null}
      <label className="grid gap-1 text-sm font-medium">Category<input className="rounded border p-2" name="category" required defaultValue={expense?.category ?? ""} /></label>
      <label className="grid gap-1 text-sm font-medium">Payment method<select className="rounded border p-2" name="paymentMethod" defaultValue={expense?.paymentMethod ?? "cash"}>{expensePaymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-medium">Amount<input className="rounded border p-2" name="amount" type="number" step="0.01" min="0.01" required defaultValue={expense?.amountCents ? formatExpenseAmountInput(expense.amountCents) : ""} /></label>
      <label className="grid gap-1 text-sm font-medium">Date<input className="rounded border p-2" name="expenseDate" type="date" required defaultValue={expense?.expenseDate ? expense.expenseDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)} /></label>
      <label className="grid gap-1 text-sm font-medium md:col-span-2">Description<textarea className="rounded border p-2" name="description" required defaultValue={expense?.description ?? ""} /></label>
      <button className="rounded bg-primary px-4 py-2 text-white md:col-span-2">Save expense</button>
    </form>
  );
}
