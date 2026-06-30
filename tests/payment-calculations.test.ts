import { describe, expect, it } from "vitest";
import { applyPaymentBalance, reversePaymentBalance, validatePaymentAllocations } from "@/lib/payments/payment-allocation";
import { nextReceiptNumber } from "@/lib/payments/receipt-number";

describe("payment calculations", () => {
  it("supports partial payments", () => {
    expect(validatePaymentAllocations([{ enrollmentId: "a", remainingCents: 50000, amountCents: 12500 }])).toBe(12500);
    expect(applyPaymentBalance({ paidCents: 0, remainingCents: 50000 }, 12500)).toEqual({ paidCents: 12500, remainingCents: 37500 });
  });

  it("supports one payment covering multiple students/enrollments", () => {
    expect(validatePaymentAllocations([
      { enrollmentId: "student-one-enrollment", remainingCents: 50000, amountCents: 12500 },
      { enrollmentId: "student-two-enrollment", remainingCents: 30000, amountCents: 30000 },
    ])).toBe(42500);
  });

  it("rejects overpayments and duplicate enrollment allocations", () => {
    expect(() => validatePaymentAllocations([{ enrollmentId: "a", remainingCents: 1000, amountCents: 1001 }])).toThrow(/exceed/);
    expect(() => validatePaymentAllocations([
      { enrollmentId: "a", remainingCents: 1000, amountCents: 500 },
      { enrollmentId: "a", remainingCents: 1000, amountCents: 500 },
    ])).toThrow(/Duplicate/);
  });

  it("reverses balances when a payment is voided", () => {
    const posted = applyPaymentBalance({ paidCents: 1000, remainingCents: 4000 }, 1500);
    expect(posted).toEqual({ paidCents: 2500, remainingCents: 2500 });
    expect(reversePaymentBalance(posted, 1500)).toEqual({ paidCents: 1000, remainingCents: 4000 });
  });

  it("generates unique six-digit yearly receipt numbers", () => {
    expect(nextReceiptNumber("RCPT-2026-000009", new Date("2026-06-29T00:00:00Z"))).toBe("RCPT-2026-000010");
    expect(nextReceiptNumber("RCPT-2025-000009", new Date("2026-01-01T00:00:00Z"))).toBe("RCPT-2026-000001");
  });
});
