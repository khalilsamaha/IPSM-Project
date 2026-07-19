import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("actions/expenses.ts", "utf8");

describe("expense action friendly errors", () => {
  it("archives active, OPEN, and REOPENED expenses through mutable shift validation", () => {
    expect(source).toContain("export async function archiveExpense");
    expect(source).toContain("findMutableExpenseOrThrow(expenseId)");
    expect(source).toContain("assertMutableShiftTransaction(expense)");
  });

  it("maps closed shifts, missing expenses, permissions, and raw backend errors to friendly messages", () => {
    expect(source).toContain("This expense belongs to a closed shift and can no longer be changed.");
    expect(source).toContain("This expense no longer exists or has already been removed.");
    expect(source).toContain("You do not have permission to change this expense.");
    expect(source).toContain("We could not update this expense. Please try again.");
    expect(source).not.toContain("redirect(`/expenses?error=${encodeURIComponent(message)}");
  });

  it("keeps redirects outside caught mutation blocks so NEXT_REDIRECT is not caught", () => {
    expect(source).not.toContain("NEXT_REDIRECT");
    expect(source).toMatch(/try \{[\s\S]*?\} catch \(error\) \{[\s\S]*?\}\n  redirect\(redirectUrl\);/);
  });

  it("uses success messages for archive, restore, update, and delete", () => {
    for (const message of ["Expense archived successfully.", "Expense restored successfully.", "Expense updated successfully.", "Expense deleted successfully."]) {
      expect(source).toContain(message);
    }
  });
});
