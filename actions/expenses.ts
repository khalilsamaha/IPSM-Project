"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { hasPermission, isAdminOrHigher } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { parseExpenseForm } from "@/lib/expenses";
import { canPermanentlyDeleteExpense } from "@/lib/deletion-policy";
import { logServerError } from "@/lib/server-log";
import { requireCurrentOpenShift } from "@/lib/shifts/service";
import { assertMutableShiftTransaction } from "@/lib/shifts/calculations";

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
  if (!createdById) throw new Error("User profile not found.");
  if (id) {
    const existing = await prisma.expense.findUnique({ where: { id }, include: { shift: true } });
    if (!existing) throw new Error("Expense not found.");
    assertMutableShiftTransaction(existing);
  }
  const shift = id ? null : await requireCurrentOpenShift(prisma, createdById);
  const row = id
    ? await prisma.expense.update({ where: { id }, data })
    : await prisma.expense.create({ data: { ...data, createdById, shiftId: shift!.id } });
  await auditExpense(id ? "update" : "create", row.id, { ...data, createdById });
  revalidatePath("/expenses");
  revalidatePath(`/expenses/${row.id}/edit`);
  redirect("/expenses");
}

export async function archiveExpense(formData: FormData) {
  await requireExpenseWrite();
  const expenseId = idSchema.parse(formData.get("id"));
  const existing = await prisma.expense.findUnique({ where: { id: expenseId }, include: { shift: true } });
  if (!existing) throw new Error("Expense not found.");
  assertMutableShiftTransaction(existing);
  const row = await prisma.expense.update({ where: { id: expenseId }, data: { archivedAt: new Date() } });
  await auditExpense("archive", row.id);
  revalidatePath("/expenses");
}


export async function restoreExpense(formData: FormData) {
  await requireExpenseWrite();
  const expenseId = idSchema.parse(formData.get("id"));
  const row = await prisma.expense.update({ where: { id: expenseId }, data: { archivedAt: null } });
  await auditExpense("restore", row.id);
  revalidatePath("/expenses");
}


export async function permanentlyDeleteExpense(formData: FormData) {
  const session = await requireSession();
  if (!isAdminOrHigher(session.role)) redirect(`/expenses?error=${encodeURIComponent("Only admins can permanently delete archived expenses.")}`);
  const user = await prisma.userProfile.findUnique({ where: { authId: session.userId }, select: { id: true } });
  const expenseId = idSchema.parse(formData.get("id"));
  const confirmation = String(formData.get("confirmation") ?? "");
  if (confirmation !== "Permanently delete this expense? This action cannot be undone.") {
    redirect(`/expenses?status=archived&error=${encodeURIComponent("Enter the exact confirmation text before permanent deletion.")}`);
  }
  try {
    await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findUnique({ where: { id: expenseId }, include: { createdBy: true } });
      if (!expense) throw new Error("Expense not found.");
      const locked = await tx.expense.findUnique({ where: { id: expenseId }, include: { shift: true } });
      assertMutableShiftTransaction(locked!);
      const decision = canPermanentlyDeleteExpense(expense);
      if (!decision.allowed) {
        await tx.auditLog.create({ data: { action: "delete_blocked", entity: "Expense", entityId: expenseId, actorId: session.userId, createdById: user?.id, metadata: { reason: decision.reason, amount: expense.amountCents, category: expense.category, date: expense.expenseDate, createdBy: expense.createdById, deletionActor: session.userId } } });
        throw new Error(decision.reason);
      }
      const metadata = { amount: expense.amountCents, category: expense.category, date: expense.expenseDate, createdBy: expense.createdById, deletionActor: session.userId };
      await tx.auditLog.create({ data: { action: "delete", entity: "Expense", entityId: expenseId, actorId: session.userId, createdById: user?.id, metadata } });
      await tx.expense.delete({ where: { id: expenseId } });
    });
  } catch (error) {
    logServerError("expense.delete", error, { expenseId });
    redirect(`/expenses?status=archived&error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to delete expense safely.")}`);
  }
  revalidatePath("/expenses");
  redirect(`/expenses?status=archived&success=${encodeURIComponent("Expense permanently deleted.")}`);
}
