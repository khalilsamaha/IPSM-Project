import { allocateFamilyPaymentAutomatically, validateManualFamilyAllocations, type FamilyAllocation } from "./payment-allocation";

export type PaymentEnrollmentOption = {
  id: string; familyId: string; remainingCents: number; startDate: string; createdAt: string;
  studentName: string; courseName: string; levelName: string; seasonName: string;
};

function cents(value: string) {
  if (!value.trim()) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new Error("Enter amounts with no more than two decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result)) throw new Error("Amount is too large.");
  return result;
}

// UI only; authoritative payment validation and persistence stay in payment-service.
export function allocationPreview(familyId: string, amount: string, mode: "automatic" | "manual", values: Record<string, string>, rows: PaymentEnrollmentOption[]) {
  let amountCents = 0;
  let allocations: FamilyAllocation[] = [];
  let error: string | null = null;
  try {
    amountCents = cents(amount);
    const balances = rows.map(row => ({ ...row, startDate: new Date(row.startDate), createdAt: new Date(row.createdAt) }));
    if (mode === "automatic") allocations = allocateFamilyPaymentAutomatically(familyId, amountCents, balances);
    else {
      allocations = rows.map(row => ({ enrollmentId: row.id, amountCents: cents(values[row.id] ?? "") }));
      validateManualFamilyAllocations(familyId, amountCents, allocations, balances);
    }
  } catch (reason) { error = reason instanceof Error ? reason.message : "Check the allocations."; }
  const allocatedCents = allocations.reduce((sum, row) => sum + row.amountCents, 0);
  return { amountCents, allocations, allocatedCents, unallocatedCents: amountCents - allocatedCents, error };
}
