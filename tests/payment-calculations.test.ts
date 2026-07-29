import { describe, expect, it } from "vitest";
import { allocateFamilyPaymentAutomatically, applyPaymentBalance, reversePaymentBalance, validateManualFamilyAllocations, validatePaymentAllocations } from "@/lib/payments/payment-allocation";
import { nextReceiptNumber, parseReceiptNumber } from "@/lib/payments/receipt-number";

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

  it("parses legacy four-digit receipt numbers", () => {
    expect(parseReceiptNumber("RCPT-2026-0001")).toEqual({ year: 2026, sequence: 1 });
    expect(nextReceiptNumber("RCPT-2026-0006", new Date("2026-06-29T00:00:00Z"))).toBe("RCPT-2026-000007");
  });

  it("generates unique six-digit yearly receipt numbers", () => {
    expect(nextReceiptNumber("RCPT-2026-000009", new Date("2026-06-29T00:00:00Z"))).toBe("RCPT-2026-000010");
    expect(nextReceiptNumber("RCPT-2025-000009", new Date("2026-01-01T00:00:00Z"))).toBe("RCPT-2026-000001");
  });
});

describe("family allocation", () => {
  const date = (value: string) => new Date(`${value}T00:00:00Z`);
  const rows = [
    { id: "later", familyId: "family", remainingCents: 4000, startDate: date("2026-02-01"), createdAt: date("2026-01-02") },
    { id: "oldest", familyId: "family", remainingCents: 2000, startDate: date("2026-01-01"), createdAt: date("2026-01-03") },
    { id: "settled", familyId: "family", remainingCents: 0, startDate: date("2025-01-01"), createdAt: date("2025-01-01") },
    { id: "archived", familyId: "family", remainingCents: 9000, archivedAt: date("2026-01-01"), startDate: date("2024-01-01"), createdAt: date("2024-01-01") },
  ];
  it("allocates oldest-first and spans balances", () => {
    expect(allocateFamilyPaymentAutomatically("family", 3000, rows)).toEqual([
      { enrollmentId: "oldest", amountCents: 2000 }, { enrollmentId: "later", amountCents: 1000 },
    ]);
  });
  it("rejects zero, negative, and family overpayments", () => {
    expect(() => allocateFamilyPaymentAutomatically("family", 0, rows)).toThrow(/greater than zero/);
    expect(() => allocateFamilyPaymentAutomatically("family", -1, rows)).toThrow(/greater than zero/);
    expect(() => allocateFamilyPaymentAutomatically("family", 6001, rows)).toThrow(/remaining balance/);
  });
  it("validates exact manual allocations and rejects duplicates", () => {
    expect(validateManualFamilyAllocations("family", 3000, [{ enrollmentId: "later", amountCents: 3000 }], rows)).toHaveLength(1);
    expect(() => validateManualFamilyAllocations("family", 3000, [{ enrollmentId: "later", amountCents: 2000 }], rows)).toThrow(/equal/);
    expect(() => validateManualFamilyAllocations("family", 2000, [{ enrollmentId: "later", amountCents: 1000 }, { enrollmentId: "later", amountCents: 1000 }], rows)).toThrow(/Duplicate/);
  });
});
