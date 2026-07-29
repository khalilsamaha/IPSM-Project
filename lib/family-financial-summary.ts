import { logServerError } from "@/lib/server-log";

export type FamilyFinancialSummary = {
  totalAmountCents: number;
  paidCents: number;
  remainingCents: number;
  enrollmentCount: number;
  outstandingEnrollmentCount: number;
  hasReconciliationErrors: boolean;
  reconciliationErrors: string[];
};

export type FinancialEnrollment = {
  id: string;
  finalFeeCents: number;
  paidCents: number;
  remainingCents: number;
};

export function calculateFamilyFinancialSummary(
  rows: FinancialEnrollment[],
  options: { familyId?: string; logErrors?: boolean } = {},
): FamilyFinancialSummary {
  const reconciliationErrors = rows
    .filter((enrollment) => enrollment.finalFeeCents - enrollment.paidCents !== enrollment.remainingCents)
    .map((enrollment) => enrollment.id);

  if (reconciliationErrors.length && options.logErrors !== false) {
    logServerError("family-financial-reconciliation", new Error("Enrollment balances do not reconcile."), {
      familyId: options.familyId,
      enrollmentIds: reconciliationErrors,
    });
  }

  return {
    totalAmountCents: rows.reduce((sum, enrollment) => sum + enrollment.finalFeeCents, 0),
    paidCents: rows.reduce((sum, enrollment) => sum + enrollment.paidCents, 0),
    remainingCents: rows.reduce((sum, enrollment) => sum + enrollment.remainingCents, 0),
    enrollmentCount: rows.length,
    outstandingEnrollmentCount: rows.filter((enrollment) => enrollment.remainingCents > 0).length,
    hasReconciliationErrors: reconciliationErrors.length > 0,
    reconciliationErrors,
  };
}
