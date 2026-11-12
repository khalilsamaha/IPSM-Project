import { prisma } from "@/lib/prisma";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { AppShell, PageHeader } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { ExpenseForm } from "../form";

export default async function NewExpensePage() {
  const session = await requireSession();
  const categories = await prisma.expenseCategory.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return <AppShell session={session}><PageHeader title="Add Expense" description="Record a school expense so profit and loss reports stay accurate." /><ExpenseForm categories={categories} canManage={isAdminOrHigher(session.role)} /></AppShell>;
}
