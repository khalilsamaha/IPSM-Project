"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { assertOrdinaryExpense, ExpenseCategoryError, requireExpenseActor, requireOtherNote, resolveExpenseCategory } from "@/lib/expense-categories";
import { parseExpenseForm } from "@/lib/expenses";
import { canPermanentlyDeleteExpense } from "@/lib/deletion-policy";
import { logServerError } from "@/lib/server-log";
import { requireCurrentOpenShift } from "@/lib/shifts/service";
import { assertMutableShiftTransaction } from "@/lib/shifts/calculations";

async function requireExpenseWrite() {
  const session = await requireSession();
  if (!hasPermission(session.role, "records:write")) throw new Error("Not authorized");
  const user = await requireExpenseActor(prisma, session.userId);
  return { session, createdById: user.id };
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
  if (error instanceof ExpenseCategoryError) return expensesUrl("error", error.message);
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("closed shift")) return expensesUrl("error", expenseMessages.closedShift);
  if (message.includes("not authorized") || message.includes("permission") || message.includes("forbidden")) return expensesUrl("error", expenseMessages.permission);
  if (message.includes("not found") || message.includes("no record") || error instanceof z.ZodError) return expensesUrl("error", expenseMessages.missing);
  return expensesUrl("error", expenseMessages.unknown);
}

async function findMutableExpenseOrThrow(expenseId: string) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId }, include: { shift: true } });
  if (!expense) throw new Error("Expense not found.");
  assertOrdinaryExpense(expense);
  assertMutableShiftTransaction(expense);
  return expense;
}

export async function saveExpense(formData: FormData) {
  let redirectUrl = "/expenses";
  let rowId: string | null = null;
  try {
    const { session, createdById } = await requireExpenseWrite();
    const idValue = formData.get("id");
    const id = idValue ? idSchema.parse(idValue) : undefined;
    // Keep the existing stale-shift auto-closure outside the posting transaction.
    const shift = id ? null : await requireCurrentOpenShift(prisma, createdById);
    const row = await prisma.$transaction(async tx => {
      const user = await requireExpenseActor(tx, session.userId);
      if (id) await tx.$queryRaw`SELECT id FROM public.expenses WHERE id=${id}::uuid FOR UPDATE`;
      const existing = id ? await tx.expense.findUnique({ where: { id }, include: { shift: true } }) : null;
      if (id && !existing) throw new Error("Expense not found.");
      const shiftId = existing?.shiftId ?? shift?.id;
      if (shiftId) {
        const shifts = await tx.$queryRaw<Array<{ status: string }>>`SELECT status::text FROM public.cashier_shifts WHERE id=${shiftId}::uuid FOR SHARE`;
        if (shifts.length !== 1 || !["OPEN", "REOPENED"].includes(shifts[0].status)) throw new Error("This expense belongs to a closed shift.");
      }
      if (existing) { assertOrdinaryExpense(existing); assertMutableShiftTransaction(existing); }
      const category = await resolveExpenseCategory(tx, String(formData.get("categorySelection") ?? ""), existing);
      const parsedData = parseExpenseForm({ ...Object.fromEntries(formData), category });
      const { id: ignoredId, ...data } = parsedData;
      requireOtherNote(category, data.description);
      const saved = id
        ? await tx.expense.update({ where: { id }, data })
        : await tx.expense.create({ data: { ...data, createdById: user.id, shiftId: shift!.id } });
      await tx.auditLog.create({ data: { action: id ? "update" : "create", entity: "Expense", entityId: saved.id,
        actorId: session.userId, createdById: user.id, metadata: { ...data, expenseDate: data.expenseDate.toISOString(), incurredAt: data.incurredAt.toISOString(), previousCategory: existing?.category ?? null } } });
      return saved;
    }, { isolationLevel: "Serializable" });
    rowId = row.id;
    revalidatePath("/expenses");
    revalidatePath(`/expenses/${row.id}/edit`);
    redirectUrl = id ? expensesUrl("success", "Expense updated successfully.") : "/expenses";
  } catch (error) {
    redirectUrl = expenseActionErrorRedirect("save", error, { expenseId: rowId });
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
    const user = await requireExpenseActor(prisma, session.userId);
    expenseId = idSchema.parse(formData.get("id"));
    const confirmation = String(formData.get("confirmation") ?? "");
    if (confirmation !== "DELETE") throw new Error("Type DELETE to confirm.");
    await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findUnique({ where: { id: expenseId! }, include: { createdBy: true, shift: true } });
      if (!expense) throw new Error("Expense not found.");
      assertOrdinaryExpense(expense);
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
