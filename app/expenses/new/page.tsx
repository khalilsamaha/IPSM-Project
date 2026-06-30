import { AppShell, PageHeader } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { ExpenseForm } from "../form";

export default async function NewExpensePage() {
  const session = await requireSession();
  return <AppShell session={session}><PageHeader title="Add Expense" description="Record a school expense so profit and loss reports stay accurate." /><ExpenseForm /></AppShell>;
}
