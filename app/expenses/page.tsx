import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import Link from "next/link";
import { archiveExpense } from "@/actions/expenses";
import { AppShell, Pager, StatusBadge, EmptyState, DataTable } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/dashboard/data";
import { expensePaymentMethods, formatExpenseAmount } from "@/lib/expenses";
import { formatDate } from "@/lib/records/format";
import { getPagination } from "@/lib/records/pagination";

type ExpenseSearchParams = { page?: string; dateFrom?: string; dateTo?: string; category?: string; paymentMethod?: string; archived?: string };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<ExpenseSearchParams> }) {
  const params = await searchParams;
  const session = await requireSession();
  const { page, skip, take } = getPagination(params);
  const where = { AND: [
    params.archived === "1" ? {} : { archivedAt: null },
    params.category ? { category: { contains: params.category, mode: "insensitive" as const } } : {},
    params.paymentMethod ? { paymentMethod: params.paymentMethod } : {},
    params.dateFrom ? { expenseDate: { gte: new Date(params.dateFrom) } } : {},
    params.dateTo ? { expenseDate: { lte: new Date(params.dateTo) } } : {},
  ] };
  const [rows, total, categories] = await Promise.all([
    prisma.expense.findMany({ where, include: { createdBy: true }, orderBy: { expenseDate: "desc" }, skip, take }),
    prisma.expense.count({ where }),
    prisma.expense.findMany({ distinct: ["category"], orderBy: { category: "asc" }, select: { category: true } }),
  ]);
  const hrefFor = (targetPage: number) => {
    const next = new URLSearchParams();
    for (const key of ["dateFrom", "dateTo", "category", "paymentMethod", "archived"] as const) if (params[key]) next.set(key, params[key]!);
    if (targetPage > 1) next.set("page", String(targetPage));
    const query = next.toString();
    return query ? `/expenses?${query}` : "/expenses";
  };
  return <AppShell session={session}>
    <div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-bold">Expenses</h2><Link className="rounded bg-primary px-4 py-2 text-white" href="/expenses/new">Create expense</Link></div>
    <form className="mb-4 grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-6">
      <input className="rounded border p-2" type="date" name="dateFrom" defaultValue={params.dateFrom} />
      <input className="rounded border p-2" type="date" name="dateTo" defaultValue={params.dateTo} />
      <input className="rounded border p-2" name="category" list="expense-categories" placeholder="Category" defaultValue={params.category ?? ""} />
      <datalist id="expense-categories">{categories.map((row) => <option key={row.category} value={row.category} />)}</datalist>
      <select name="paymentMethod" className="rounded border p-2" defaultValue={params.paymentMethod ?? ""}><option value="">All methods</option>{expensePaymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="archived" value="1" defaultChecked={params.archived === "1"} /> Show archived</label>
      <button className="rounded bg-primary px-4 py-2 text-white">Apply filters</button>
    </form>
    <DataTable><thead className="bg-muted"><tr><th className="p-3">Date</th><th>Category</th><th>Description</th><th>Method</th><th>Amount</th><th>Created by</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((expense) => <tr className="border-t" key={expense.id}><td className="p-3">{formatDate(expense.expenseDate)}</td><td className="font-medium">{expense.category}</td><td>{expense.description}</td><td>{expense.paymentMethod}</td><td>{formatExpenseAmount(expense.amountCents)}</td><td>{expense.createdBy?.name ?? "—"}</td><td><StatusBadge status={expense.archivedAt ? "Archived" : "Active"} /></td><td className="flex gap-3 py-3"><Link className="text-primary" href={`/expenses/${expense.id}/edit`}>Edit</Link>{expense.archivedAt ? null : <form action={archiveExpense}><input type="hidden" name="id" value={expense.id} /><ConfirmSubmitButton className="text-primary" message="Archive this record? This will hide it from active workflows.">Archive</ConfirmSubmitButton></form>}</td></tr>)}</tbody></DataTable>
    <Pager page={page} total={total} hrefFor={hrefFor} />
  </AppShell>;
}
