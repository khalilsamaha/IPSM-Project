import { AppShell } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { ExpenseForm } from "../form";

export default async function NewExpensePage() {
  const session = await requireSession();
  return <AppShell session={session}><h2 className="mb-4 text-2xl font-bold">Create expense</h2><ExpenseForm /></AppShell>;
}
