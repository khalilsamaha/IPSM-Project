import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import { historicalCategorySelection } from "./expense-category-options";
export class ExpenseCategoryError extends Error {}
const normalized = (name: string) => name.trim().replace(/\s+/g, " ");
export function isPayrollExpense(expense: { payrollId?: string | null; category: string }) {
  return Boolean(expense.payrollId) || normalized(expense.category).toLowerCase() === "teacher payroll";
}
export function assertOrdinaryExpense(expense: { payrollId?: string | null; category: string }) {
  if (isPayrollExpense(expense)) throw new ExpenseCategoryError("Teacher payroll expenses are protected. Use the payroll workflow.");
}
export function requireOtherNote(category: string, description: string) {
  if (normalized(category).toLowerCase() === "other" &&
    (description.trim().length < 8 || /^(other|miscellaneous|misc|expense|n\/a)[.!\s]*$/i.test(description.trim()))) {
    throw new ExpenseCategoryError("For Other, describe the expense in at least 8 characters (not just ‘Other’ or ‘Miscellaneous’).");
  }
}
export async function requireExpenseActor(tx: Prisma.TransactionClient, authId: string, manage = false) {
  const user = await tx.userProfile.findUnique({ where: { authId } });
  if (!user || user.status !== "ACTIVE" || user.archivedAt ||
    !["SUPER_ADMIN", "ADMIN", ...(manage ? [] : ["RECEPTION"])].includes(user.role)) {
    throw new ExpenseCategoryError("You do not have permission to manage expense categories or expenses.");
  }
  return user;
}
export async function resolveExpenseCategory(tx: Prisma.TransactionClient, selection: string, existing?: { category: string; payrollId?: string | null } | null) {
  if (existing) assertOrdinaryExpense(existing);
  if (selection === historicalCategorySelection && existing) return existing.category;
  if (!z.string().uuid().safeParse(selection).success) throw new ExpenseCategoryError("Select an available expense category.");
  // Serialize against rename/archive so a new posting uses an available snapshot.
  const rows = await tx.$queryRaw<Array<{ name: string; archived_at: Date | null }>>`
    SELECT name, archived_at FROM public.expense_categories WHERE id=${selection}::uuid FOR SHARE`;
  if (rows.length !== 1 || rows[0].archived_at) throw new ExpenseCategoryError("This category is no longer available. Select another category.");
  assertOrdinaryExpense({ category: rows[0].name });
  return rows[0].name;
}
const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: z.string().min(1).max(80) }),
  z.object({ action: z.literal("rename"), id: z.string().uuid(), name: z.string().min(1).max(80) }),
  z.object({ action: z.enum(["archive", "restore"]), id: z.string().uuid() }),
]);
export async function manageExpenseCategory(db: PrismaClient, authId: string, input: unknown) {
  const parsed = mutation.safeParse(input);
  if (!parsed.success) throw new ExpenseCategoryError("Enter a valid category name (1–80 characters) and action.");
  const command = parsed.data;
  try {
    return await db.$transaction(async tx => {
      const user = await requireExpenseActor(tx, authId, true);
      const name = "name" in command ? normalized(command.name) : undefined;
      if (name !== undefined && !name) throw new ExpenseCategoryError("Category name is required.");
      if (name) assertOrdinaryExpense({ category: name });
      let before = null;
      if (command.action !== "create") {
        await tx.$queryRaw`SELECT id FROM public.expense_categories WHERE id=${command.id}::uuid FOR UPDATE`;
        before = await tx.expenseCategory.findUnique({ where: { id: command.id } });
        if (!before) throw new ExpenseCategoryError("Category not found.");
        if (before.name.toLowerCase() === "other" && ["rename", "archive"].includes(command.action)) {
          throw new ExpenseCategoryError("Other is a required fallback category and cannot be renamed or archived.");
        }
      }
      const row = command.action === "create"
        ? await tx.expenseCategory.create({ data: { name: name! } })
        : await tx.expenseCategory.update({ where: { id: command.id }, data: command.action === "rename" ? { name } : { archivedAt: command.action === "archive" ? new Date() : null } });
      await tx.auditLog.create({ data: { actorId: authId, createdById: user.id, entity: "ExpenseCategory", entityId: row.id, action: command.action,
        metadata: { before: before ? { name: before.name, archivedAt: before.archivedAt?.toISOString() ?? null } : null,
          after: { name: row.name, archivedAt: row.archivedAt?.toISOString() ?? null } } } });
      return { id: row.id, name: row.name, archived: Boolean(row.archivedAt) };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ExpenseCategoryError("That category already exists, including archived categories.");
    throw error;
  }
}
