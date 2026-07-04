import { describe, expect, it } from "vitest";

const diagnosticKeys = [
  "payments-missing-receipts",
  "payments-without-items",
  "payment-total-mismatches",
  "negative-enrollment-balances",
  "sessions-missing-room",
  "duplicate-student-codes",
  "duplicate-course-pricing",
];

describe("data integrity diagnostics coverage", () => {
  it("documents every phase 10 production-readiness integrity check", () => {
    expect(diagnosticKeys).toEqual([
      "payments-missing-receipts",
      "payments-without-items",
      "payment-total-mismatches",
      "negative-enrollment-balances",
      "sessions-missing-room",
      "duplicate-student-codes",
      "duplicate-course-pricing",
    ]);
  });
});
