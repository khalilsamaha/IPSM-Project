"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
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

const expenseMessages = {
  closedShift: "This expense belongs to a closed shift and can no longer be changed. Ask an administrator to reopen the shift first.",
  missing: "This expense no longer exists or has already been removed.",
  permission: "You do not have permission to change this expense.",
  unknown: "We could not update this expense. Please try again.",
};

function expensesUrl(messageKey: "success" | "error", message: string) {
  return `/expenses?${messageKey}=${encodeURIComponent(message)}`;
}

function expenseActionErrorRedirect(action: string, error: unknown, context?: Record<string, unknown>) {
  logServerError(`expense.${action}`, error, context);
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("closed shift")) return expensesUrl("error", expenseMessages.closedShift);
  if (message.includes("not authorized") || message.includes("permission") || message.includes("forbidden")) return expensesUrl("error", expenseMessages.permission);
  if (message.includes("not found") || message.includes("no record") || error instanceof z.ZodError) return expensesUrl("error", expenseMessages.missing);
  return expensesUrl("error", expenseMessages.unknown);
}

async function findMutableExpenseOrThrow(expenseId: string) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId }, include: { shift: true } });
  if (!expense) throw new Error("Expense not found.");
  assertMutableShiftTransaction(expense);
  return expense;
}

export async function saveExpense(formData: FormData) {
  let redirectUrl = "/expenses";
  let rowId: string | null = null;
  let parsedData: ReturnType<typeof parseExpenseForm> | null = null;
  try {
    const { createdById } = await requireExpenseWrite();
    parsedData = parseExpenseForm(Object.fromEntries(formData));
    const { id, ...data } = parsedData;
    if (!createdById) throw new Error("Not authorized");
    if (id) await findMutableExpenseOrThrow(id);
    const shift = id ? null : await requireCurrentOpenShift(prisma, createdById);
    const row = id
      ? await prisma.expense.update({ where: { id }, data })
      : await prisma.expense.create({ data: { ...data, createdById, shiftId: shift!.id } });
    rowId = row.id;
    await auditExpense(id ? "update" : "create", row.id, { ...data, createdById });
    revalidatePath("/expenses");
    revalidatePath(`/expenses/${row.id}/edit`);
    redirectUrl = id ? expensesUrl("success", "Expense updated successfully.") : "/expenses";
  } catch (error) {
    redirectUrl = expenseActionErrorRedirect("save", error, { expenseId: parsedData?.id ?? rowId });
  }
  redirect(redirectUrl);
}

export async function archiveExpense(formData: FormData) {
  let redirectUrl = expensesUrl("success", "Expense archived successfully.");
  let expenseId: string | null = null;
  try {
    await requireExpenseWrite();
    expenseId = idSchema.parse(formData.get("id"));
    await findMutableExpenseOrThrow(expenseId);
    const row = await prisma.expense.update({ where: { id: expenseId }, data: { archivedAt: new Date() } });
    await auditExpense("archive", row.id);
    revalidatePath("/expenses");
  } catch (error) {
    redirectUrl = expenseActionErrorRedirect("archive", error, { expenseId });
  }
  redirect(redirectUrl);
}


export async function restoreExpense(formData: FormData) {
  let redirectUrl = expensesUrl("success", "Expense restored successfully.");
  let expenseId: string | null = null;
  try {
    await requireExpenseWrite();
    expenseId = idSchema.parse(formData.get("id"));
    await findMutableExpenseOrThrow(expenseId);
    const row = await prisma.expense.update({ where: { id: expenseId }, data: { archivedAt: null } });
    await auditExpense("restore", row.id);
    revalidatePath("/expenses");
  } catch (error) {
    redirectUrl = expenseActionErrorRedirect("restore", error, { expenseId });
  }
  redirect(redirectUrl);
}


export async function permanentlyDeleteExpense(formData: FormData) {
  let redirectUrl = expensesUrl("success", "Expense deleted successfully.");
  let expenseId: string | null = null;
  try {
    const session = await requireSession();
    if (!hasPermission(session.role, "records:write")) throw new Error("Not authorized");
    const user = await prisma.userProfile.findUnique({ where: { authId: session.userId }, select: { id: true } });
    expenseId = idSchema.parse(formData.get("id"));
    const confirmation = String(formData.get("confirmation") ?? "");
    if (confirmation !== "DELETE") throw new Error("Type DELETE to confirm.");
    await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findUnique({ where: { id: expenseId! }, include: { createdBy: true, shift: true } });
      if (!expense) throw new Error("Expense not found.");
      assertMutableShiftTransaction(expense);
      const decision = canPermanentlyDeleteExpense(expense);
      const details = {
        actor: session.userId,
        actorRole: session.role,
        date: expense.expenseDate,
        category: expense.category,
        description: expense.description,
        amountCents: expense.amountCents,
        paymentMethod: expense.paymentMethod,
        creator: expense.createdBy?.name ?? expense.createdById,
        shiftStatus: expense.shift?.status ?? "No shift",
      };
      if (!decision.allowed) {
        await tx.auditLog.create({ data: { action: "delete_blocked", entity: "Expense", entityId: expenseId!, actorId: session.userId, createdById: user?.id, metadata: { ...details, outcome: "blocked", reason: decision.reason } } });
        throw new Error(decision.reason ?? "Expense deletion is blocked by safety rules.");
      }
      await tx.auditLog.create({ data: { action: "delete", entity: "Expense", entityId: expenseId!, actorId: session.userId, createdById: user?.id, metadata: { ...details, outcome: "deleted" } } });
      await tx.expense.delete({ where: { id: expenseId! } });
    });
    revalidatePath("/expenses");
  } catch (error) {
    if (error instanceof Error && error.message === "Type DELETE to confirm.") {
      redirectUrl = expensesUrl("error", error.message);
    } else {
      redirectUrl = expenseActionErrorRedirect("delete", error, { expenseId });
    }
  }
  redirect(redirectUrl);
}
