import { notFound } from "next/navigation";
import { AppShell, PageHeader } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/dashboard/data";
import { ExpenseForm } from "../../form";

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense || expense.archivedAt) notFound();
  return <AppShell session={session}><PageHeader title="Edit Expense" description="Update expense details. Archived expenses cannot be edited." /><ExpenseForm expense={expense} /></AppShell>;
}
