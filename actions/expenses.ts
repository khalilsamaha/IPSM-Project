"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { prisma } from "@/lib/dashboard/data";
import { parseExpenseForm } from "@/lib/expenses";

async function requireExpenseWrite() {
  const session = await requireSession();
  if (!hasPermission(session.role, "records:write")) throw new Error("Not authorized");
  const user = await prisma.userProfile.findUnique({ where: { authId: session.userId }, select: { id: true } });
  return { session, createdById: user?.id };
}

async function auditExpense(action: string, entityId: string, metadata?: unknown) {
  const { session, createdById } = await requireExpenseWrite();
  await prisma.auditLog.create({ data: { action, entity: "Expense", entityId, actorId: session.userId, createdById, metadata: metadata as object } });
}

const idSchema = z.string().uuid();

export async function saveExpense(formData: FormData) {
  const { createdById } = await requireExpenseWrite();
  const parsed = parseExpenseForm(Object.fromEntries(formData));
  const { id, ...data } = parsed;
  const row = id
    ? await prisma.expense.update({ where: { id }, data })
    : await prisma.expense.create({ data: { ...data, createdById } });
  await auditExpense(id ? "update" : "create", row.id, { ...data, createdById });
  revalidatePath("/expenses");
  revalidatePath(`/expenses/${row.id}/edit`);
  redirect("/expenses");
}

export async function archiveExpense(formData: FormData) {
  await requireExpenseWrite();
  const expenseId = idSchema.parse(formData.get("id"));
  const row = await prisma.expense.update({ where: { id: expenseId }, data: { archivedAt: new Date() } });
  await auditExpense("archive", row.id);
  revalidatePath("/expenses");
}
