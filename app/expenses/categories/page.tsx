import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { AppShell, PageHeader } from "@/components/records/shell";
import { ExpenseCategoryManager } from "@/components/expense-category-manager";

export default async function ExpenseCategoriesPage() {
  const session = await requireSession();
  if (!isAdminOrHigher(session.role)) notFound();
  const categories = await prisma.expenseCategory.findMany({ orderBy: { name: "asc" } });
  return <AppShell session={session}><PageHeader title="Expense categories" description="Manage choices for new expenses. Historical expense labels and reports remain unchanged." />
    <ExpenseCategoryManager categories={categories.map(row => ({ id: row.id, name: row.name, archived: Boolean(row.archivedAt) }))} />
  </AppShell>;
}
