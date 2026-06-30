export type AllocationInput = { enrollmentId: string; remainingCents: number; amountCents: number };
export type EnrollmentBalance = { paidCents: number; remainingCents: number };

export function validatePaymentAllocations(items: AllocationInput[]) {
  if (items.length === 0) throw new Error("Select at least one enrollment");
  const seen = new Set<string>();
  let totalCents = 0;
  for (const item of items) {
    if (seen.has(item.enrollmentId)) throw new Error("Duplicate enrollment allocation");
    seen.add(item.enrollmentId);
    if (!Number.isInteger(item.amountCents) || item.amountCents <= 0) throw new Error("Allocation amounts must be greater than zero");
    if (item.amountCents > item.remainingCents) throw new Error("Payment cannot exceed remaining enrollment balance");
    totalCents += item.amountCents;
  }
  return totalCents;
}

export function applyPaymentBalance(enrollment: EnrollmentBalance, amountCents: number) {
  if (amountCents > enrollment.remainingCents) throw new Error("Payment cannot exceed remaining enrollment balance");
  return { paidCents: enrollment.paidCents + amountCents, remainingCents: enrollment.remainingCents - amountCents };
}

export function reversePaymentBalance(enrollment: EnrollmentBalance, amountCents: number) {
  return { paidCents: Math.max(0, enrollment.paidCents - amountCents), remainingCents: enrollment.remainingCents + amountCents };
}
