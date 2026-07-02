import { describe, expect, it } from "vitest";
import { nextReceiptNumber, nextReceiptNumberFromExisting } from "@/lib/payments/receipt-number";

function buildReceiptPdfName(payment: { id: string; receiptNumber: string | null }) {
  return `${payment.receiptNumber ?? payment.id}.pdf`;
}

describe("receipt number safety", () => {
  it("keeps the RCPT-YYYY-000001 sequence format", () => {
    expect(nextReceiptNumber(null, new Date("2026-01-01T00:00:00Z"))).toBe("RCPT-2026-000001");
    expect(nextReceiptNumber("RCPT-2026-000099", new Date("2026-07-02T00:00:00Z"))).toBe("RCPT-2026-000100");
  });

  it("generates six-digit receipts after legacy seed data", () => {
    expect(nextReceiptNumberFromExisting(["RCPT-2026-0001", "RCPT-2026-0006"], new Date("2026-07-02T00:00:00Z"))).toBe("RCPT-2026-000007");
  });

  it("retries duplicate conflicts conceptually by advancing from the newest committed receipt", () => {
    const firstCandidate = nextReceiptNumber("RCPT-2026-000001", new Date("2026-07-02T00:00:00Z"));
    expect(firstCandidate).toBe("RCPT-2026-000002");
    const retryCandidate = nextReceiptNumber(firstCandidate, new Date("2026-07-02T00:00:00Z"));
    expect(retryCandidate).toBe("RCPT-2026-000003");
  });

  it("PDF download naming is idempotent and does not need payment mutation", () => {
    const payment = { id: "payment-1", receiptNumber: "RCPT-2026-000010", totalAmountCents: 12500 };
    const before = { ...payment };
    expect(buildReceiptPdfName(payment)).toBe("RCPT-2026-000010.pdf");
    expect(payment).toEqual(before);
  });

  it("plans missing receipt number repair without touching already-numbered payments", () => {
    const payments = [{ id: "p1", receiptNumber: null, itemCount: 1 }, { id: "p2", receiptNumber: "RCPT-2026-000001", itemCount: 0 }];
    const receipts = [{ paymentId: "p2", receiptNumber: "RCPT-2026-000001" }];
    const missingReceiptNumbers = payments.filter((payment) => !payment.receiptNumber).map((payment) => ({ id: payment.id, nextReceiptNumber: nextReceiptNumberFromExisting(["RCPT-2026-000001"], new Date("2026-07-02T00:00:00Z")) }));
    expect(missingReceiptNumbers).toEqual([{ id: "p1", nextReceiptNumber: "RCPT-2026-000002" }]);
    expect(payments.filter((payment) => !receipts.some((receipt) => receipt.paymentId === payment.id)).map((payment) => payment.id)).toEqual(["p1"]);
    expect(payments.filter((payment) => payment.itemCount === 0).map((payment) => payment.id)).toEqual(["p2"]);
  });
});
