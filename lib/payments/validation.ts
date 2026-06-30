import { dollarsToCents } from "@/lib/records/format";

export type PaymentAllocationInput = {
  enrollmentId: string;
  amount: string | number;
};

export type PaymentEnrollmentValidationRecord = {
  id: string;
  remainingCents: number;
  student: { familyId: string };
};

export type ValidatedPaymentAllocation = {
  enrollmentId: string;
  amountCents: number;
};

export class PaymentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentValidationError";
  }
}

export function validatePaymentAllocations({
  familyId,
  allocations,
  enrollments,
}: {
  familyId: string;
  allocations: PaymentAllocationInput[];
  enrollments: PaymentEnrollmentValidationRecord[];
}) {
  const enrollmentById = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment]));
  const validated = allocations
    .map((allocation) => ({
      enrollmentId: allocation.enrollmentId,
      amountCents: dollarsToCents(allocation.amount),
    }))
    .filter((allocation) => allocation.amountCents > 0);

  if (validated.length === 0) {
    throw new PaymentValidationError("Enter an amount for at least one enrollment.");
  }

  for (const allocation of validated) {
    const enrollment = enrollmentById.get(allocation.enrollmentId);
    if (!enrollment || enrollment.student.familyId !== familyId) {
      throw new PaymentValidationError("All allocations must belong to the selected family.");
    }

    if (allocation.amountCents > enrollment.remainingCents) {
      throw new PaymentValidationError("Allocation amount cannot exceed the enrollment balance.");
    }
  }

  return validated;
}
