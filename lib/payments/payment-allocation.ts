export type AllocationInput = { enrollmentId: string; remainingCents: number; amountCents: number };
export type EnrollmentBalance = { paidCents: number; remainingCents: number };

export type FamilyEnrollmentBalance = {
  id: string;
  familyId: string;
  remainingCents: number;
  archivedAt?: Date | null;
  startDate: Date;
  createdAt: Date;
};

export type FamilyAllocation = { enrollmentId: string; amountCents: number };

/** Deterministic, cents-only allocation used by both previews and authoritative writes. */
export function allocateFamilyPaymentAutomatically(
  familyId: string,
  amountCents: number,
  enrollments: FamilyEnrollmentBalance[],
): FamilyAllocation[] {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Payment amount must be greater than zero");
  const eligible = enrollments
    .filter((row) => row.familyId === familyId && !row.archivedAt && row.remainingCents > 0)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime()
      || a.createdAt.getTime() - b.createdAt.getTime()
      || a.id.localeCompare(b.id));
  const outstandingCents = eligible.reduce((sum, row) => sum + row.remainingCents, 0);
  if (amountCents > outstandingCents) throw new Error("Payment cannot exceed the family's remaining balance");
  let unallocated = amountCents;
  const allocations: FamilyAllocation[] = [];
  for (const row of eligible) {
    if (!unallocated) break;
    const applied = Math.min(row.remainingCents, unallocated);
    allocations.push({ enrollmentId: row.id, amountCents: applied });
    unallocated -= applied;
  }
  return allocations;
}

export function validateManualFamilyAllocations(
  familyId: string,
  amountCents: number,
  allocations: FamilyAllocation[],
  enrollments: FamilyEnrollmentBalance[],
) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Payment amount must be greater than zero");
  const balances = new Map(enrollments.map((row) => [row.id, row]));
  const nonZero = allocations.filter((row) => row.amountCents !== 0);
  if (!nonZero.length) throw new Error("Select at least one enrollment");
  const seen = new Set<string>();
  let allocatedCents = 0;
  for (const allocation of nonZero) {
    if (seen.has(allocation.enrollmentId)) throw new Error("Duplicate enrollment allocation");
    seen.add(allocation.enrollmentId);
    const enrollment = balances.get(allocation.enrollmentId);
    if (!enrollment || enrollment.familyId !== familyId) throw new Error("Every allocation must belong to the selected family");
    if (enrollment.archivedAt || enrollment.remainingCents <= 0) throw new Error("Settled or archived enrollments cannot receive an allocation");
    if (!Number.isInteger(allocation.amountCents) || allocation.amountCents < 0) throw new Error("Allocation amounts must be valid cents");
    if (allocation.amountCents > enrollment.remainingCents) throw new Error("Payment cannot exceed remaining enrollment balance");
    allocatedCents += allocation.amountCents;
  }
  if (allocatedCents !== amountCents) throw new Error("Manual allocations must equal the payment amount");
  return nonZero;
}

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
