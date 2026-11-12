import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  session: { userId: "11111111-1111-4111-8111-111111111111", role: "ADMIN" },
  user: { id: "22222222-2222-4222-8222-222222222222", status: "ACTIVE", archivedAt: null as Date | null, role: "ADMIN" },
  existing: null as null | { id: string; category: string; payrollId: string | null; shiftId: string | null },
  category: "Rent", shift: "OPEN", create: vi.fn(), update: vi.fn(), audit: vi.fn(), requireShift: vi.fn(), transaction: vi.fn(), query: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock("@/lib/auth/session", () => ({ requireSession: async () => state.session }));
vi.mock("@/lib/server-log", () => ({ logServerError: vi.fn() }));
vi.mock("@/lib/shifts/service", () => ({ requireCurrentOpenShift: state.requireShift }));
vi.mock("@/lib/prisma", () => {
  const tx = { userProfile: { findUnique: async () => state.user }, expense: { findUnique: async () => state.existing, create: state.create, update: state.update }, auditLog: { create: state.audit }, $queryRaw: state.query };
  return { prisma: { ...tx, $transaction: async (fn: (store: unknown) => Promise<unknown>) => { state.transaction(); return fn(tx); } } };
});
import { saveExpense, archiveExpense, restoreExpense, permanentlyDeleteExpense } from "@/actions/expenses";
const categoryId = "33333333-3333-4333-8333-333333333333";
function form(patch: Record<string,string> = {}) { const data = new FormData();for (const [key,value] of Object.entries({ categorySelection: categoryId, category: "Forged label", description: "Synthetic studio supplies", amount: "12.50", expenseDate: "2026-11-12", paymentMethod: "cash", ...patch })) data.set(key,value);return data; }
beforeEach(() => {
  vi.clearAllMocks();state.existing=null;state.category="Rent";state.shift="OPEN";state.user.status="ACTIVE";state.user.archivedAt=null;state.user.role="ADMIN";
  state.requireShift.mockResolvedValue({ id: "shift" });state.create.mockResolvedValue({ id: "expense" });state.update.mockResolvedValue({ id: "expense" });
  state.query.mockImplementation(async (strings: TemplateStringsArray) => strings.join("").includes("cashier_shifts") ? [{ status: state.shift }] : [{ name: state.category, archived_at: null }]);
});
describe("authoritative expense category selection", () => {
  it("lets Reception post a catalogue snapshot and ignores a forged label", async () => {
    state.user.role="RECEPTION";
    await expect(saveExpense(form())).rejects.toThrow("REDIRECT /expenses");
    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ category: "Rent", amountCents: 1250 }) }));
    expect(state.audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entity: "Expense", action: "create" }) }));
  });
  it("rejects Other without its note and a forged historical selection on creation", async () => {
    state.category="Other";await expect(saveExpense(form({description:"Other"}))).rejects.toThrow("error=");expect(state.create).not.toHaveBeenCalled();
    await expect(saveExpense(form({categorySelection:"historical"}))).rejects.toThrow("error=");expect(state.create).not.toHaveBeenCalled();
  });
  it("retains the actual historic label when editing and never trusts submitted category text", async () => {
    state.existing={id:categoryId, category:"Legacy utilities",payrollId:null,shiftId:null};
    await expect(saveExpense(form({id:categoryId,categorySelection:"historical"}))).rejects.toThrow("success=");
    expect(state.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({category:"Legacy utilities"})}));
  });
  it("blocks every generic payroll mutation", async () => {
    state.existing={id:categoryId,category:"Teacher Payroll",payrollId:categoryId,shiftId:null};
    for (const action of [saveExpense,archiveExpense,restoreExpense,permanentlyDeleteExpense]) await expect(action(form({id:categoryId,confirmation:"DELETE"}))).rejects.toThrow("error=");
    expect(state.create).not.toHaveBeenCalled();expect(state.update).not.toHaveBeenCalled();expect(state.audit).not.toHaveBeenCalled();
  });
  it("runs existing stale-shift handling before the posting transaction and rejects concurrent closure", async () => {
    state.requireShift.mockRejectedValueOnce(new Error("Previous-day shift closed"));await expect(saveExpense(form())).rejects.toThrow("error=");expect(state.transaction).not.toHaveBeenCalled();
    state.shift="CLOSED";await expect(saveExpense(form())).rejects.toThrow("error=");expect(state.create).not.toHaveBeenCalled();
  });
  it("rejects an inactive database profile even if the session claims ADMIN", async () => {
    state.user.status="INACTIVE";await expect(saveExpense(form())).rejects.toThrow("error=");expect(state.create).not.toHaveBeenCalled();
  });
});
