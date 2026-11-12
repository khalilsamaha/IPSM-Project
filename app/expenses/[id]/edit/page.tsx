import { isPayrollExpense } from "@/lib/expense-categories";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { notFound } from "next/navigation";
import { AppShell, PageHeader } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ExpenseForm } from "../../form";

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const categories = await prisma.expenseCategory.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const { id } = await params;
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense || expense.archivedAt || isPayrollExpense(expense)) notFound();
  return <AppShell session={session}><PageHeader title="Edit Expense" description="Update expense details. Archived expenses cannot be edited." /><ExpenseForm categories={categories} canManage={isAdminOrHigher(session.role)} expense={expense} /></AppShell>;
}
