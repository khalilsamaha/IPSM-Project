import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import Link from "next/link";
import { archiveExpense, permanentlyDeleteExpense, restoreExpense } from "@/actions/expenses";
import { AppShell, Pager, StatusBadge, DataTable, StatusTabs, getStatusFilter, type RecordStatusFilter } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { expensePaymentMethods, formatExpenseAmount } from "@/lib/expenses";
import { formatPaymentMethod } from "@/lib/payment-methods";
import { formatDate } from "@/lib/records/format";
import { getPagination } from "@/lib/records/pagination";

type ExpenseSearchParams = { page?: string; dateFrom?: string; dateTo?: string; category?: string; paymentMethod?: string; status?: string };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<ExpenseSearchParams> }) {
  const params = await searchParams;
  const session = await requireSession();
  const { page, skip, take } = getPagination(params);
  const status = getStatusFilter(params.status);
  const isAdmin = isAdminOrHigher(session.role);
  const where = { AND: [
    status === "archived" ? { archivedAt: { not: null } } : status === "all" ? {} : { archivedAt: null },
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
    for (const key of ["dateFrom", "dateTo", "category", "paymentMethod", "status"] as const) if (params[key]) next.set(key, params[key]!);
    if (targetPage > 1) next.set("page", String(targetPage));
    const query = next.toString();
    return query ? `/expenses?${query}` : "/expenses";
  };
  return <AppShell session={session}>
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><h2 className="text-2xl font-bold">Expenses</h2><Link className="rounded bg-primary px-4 py-2 text-white" href="/expenses/new">Create expense</Link></div>
    <div className="mb-4"><StatusTabs value={status} hrefFor={(nextStatus: RecordStatusFilter) => { const next = new URLSearchParams(); for (const key of ["dateFrom", "dateTo", "category", "paymentMethod"] as const) if (params[key]) next.set(key, params[key]!); if (nextStatus !== "active") next.set("status", nextStatus); const query = next.toString(); return query ? `/expenses?${query}` : "/expenses"; }} /></div>
    <form className="mb-4 grid gap-2 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <input className="rounded border p-2" type="date" name="dateFrom" defaultValue={params.dateFrom} />
      <input className="rounded border p-2" type="date" name="dateTo" defaultValue={params.dateTo} />
      <input className="rounded border p-2" name="category" list="expense-categories" placeholder="Category" defaultValue={params.category ?? ""} />
      <datalist id="expense-categories">{categories.map((row) => <option key={row.category} value={row.category} />)}</datalist>
      <select name="paymentMethod" className="rounded border p-2" defaultValue={params.paymentMethod ?? ""}><option value="">All methods</option>{expensePaymentMethods.map((method) => <option key={method} value={method}>{formatPaymentMethod(method)}</option>)}</select>
      <select name="status" className="rounded border p-2" defaultValue={params.status ?? "active"}><option value="active">Active</option><option value="archived">Archived / Inactive</option><option value="all">All</option></select>
      <button className="rounded bg-primary px-4 py-2 text-white">Apply filters</button>
    </form>
    <DataTable><thead className="bg-muted"><tr><th className="p-3">Date</th><th>Category</th><th>Description</th><th>Method</th><th>Amount</th><th>Created by</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((expense) => <tr className="border-t" key={expense.id}><td className="p-3">{formatDate(expense.expenseDate)}</td><td className="font-medium">{expense.category}</td><td>{expense.description}</td><td>{formatPaymentMethod(expense.paymentMethod)}</td><td>{formatExpenseAmount(expense.amountCents)}</td><td>{expense.createdBy?.name ?? "—"}</td><td><StatusBadge status={expense.archivedAt ? "Archived" : "Active"} /></td><td className="flex gap-3 py-3"><Link className="text-primary" href={`/expenses/${expense.id}/edit`}>Edit</Link>{expense.archivedAt ? <><form action={restoreExpense}><input type="hidden" name="id" value={expense.id} /><ConfirmSubmitButton className="text-primary" message="Restore this expense?">Restore</ConfirmSubmitButton></form>{isAdmin ? <form action={permanentlyDeleteExpense} className="flex flex-wrap gap-1"><input type="hidden" name="id" value={expense.id} /><input name="confirmation" className="w-36 rounded border px-2 py-1 text-xs" placeholder="Exact confirmation" /><ConfirmSubmitButton className="text-red-700" message="Permanently delete this expense? This action cannot be undone.">Delete forever</ConfirmSubmitButton></form> : null}</> : <form action={archiveExpense}><input type="hidden" name="id" value={expense.id} /><ConfirmSubmitButton className="text-primary" message="Archive this record? This will hide it from active workflows.">Archive</ConfirmSubmitButton></form>}</td></tr>)}</tbody></DataTable>
    <Pager page={page} total={total} hrefFor={hrefFor} />
  </AppShell>;
}
