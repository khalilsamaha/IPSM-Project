"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { ExpenseCategoryError, manageExpenseCategory } from "@/lib/expense-categories";
import { prisma } from "@/lib/prisma";

export async function changeExpenseCategory(input: unknown) {
  const session = await requireSession();
  try {
    const category = await manageExpenseCategory(prisma, session.userId, input);
    revalidatePath("/expenses", "layout");
    return { category };
  } catch (error) {
    return { error: error instanceof ExpenseCategoryError ? error.message : "Unable to save the category. Try again." };
  }
}
