import { describe, expect, it } from "vitest";
import { getOutstandingEnrollmentWhere } from "@/lib/payments/queries";
import { PaymentValidationError, validatePaymentAllocations, type PaymentEnrollmentValidationRecord } from "@/lib/payments/validation";

const familyA = "10000000-0000-0000-0000-000000000001";
const familyB = "10000000-0000-0000-0000-000000000002";

const enrollments: PaymentEnrollmentValidationRecord[] = [
  { id: "30000000-0000-0000-0000-000000000001", remainingCents: 5000, student: { familyId: familyA } },
  { id: "30000000-0000-0000-0000-000000000002", remainingCents: 7500, student: { familyId: familyA } },
  { id: "30000000-0000-0000-0000-000000000003", remainingCents: 9000, student: { familyId: familyB } },
];

describe("validatePaymentAllocations", () => {
  it("accepts allocations for the selected family's enrollments only", () => {
    expect(validatePaymentAllocations({
      familyId: familyA,
      enrollments,
      allocations: [
        { enrollmentId: enrollments[0].id, amount: "10.00" },
        { enrollmentId: enrollments[1].id, amount: "0" },
      ],
    })).toEqual([{ enrollmentId: enrollments[0].id, amountCents: 1000 }]);
  });

  it("rejects allocations from another family", () => {
    expect(() => validatePaymentAllocations({
      familyId: familyA,
      enrollments,
      allocations: [{ enrollmentId: enrollments[2].id, amount: "10.00" }],
    })).toThrow(PaymentValidationError);
  });

  it("rejects empty allocations", () => {
    expect(() => validatePaymentAllocations({
      familyId: familyA,
      enrollments,
      allocations: [
        { enrollmentId: enrollments[0].id, amount: "0" },
        { enrollmentId: enrollments[1].id, amount: "" },
      ],
    })).toThrow("Enter an amount for at least one enrollment.");
  });

  it("rejects overpayments", () => {
    expect(() => validatePaymentAllocations({
      familyId: familyA,
      enrollments,
      allocations: [{ enrollmentId: enrollments[0].id, amount: "50.01" }],
    })).toThrow("Allocation amount cannot exceed the enrollment balance.");
  });
});


describe("getOutstandingEnrollmentWhere", () => {
  it("filters outstanding enrollments to the selected family", () => {
    expect(getOutstandingEnrollmentWhere(familyA)).toEqual({
      remainingCents: { gt: 0 },
      student: { familyId: familyA },
    });
  });
});
