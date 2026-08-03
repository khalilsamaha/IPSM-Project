import { describe, expect, it } from "vitest";
import {
  buildReceiptPdfV2,
  receiptFamilyBalanceTotals,
} from "@/lib/payments/receipt-service-v2";

const testStamp = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==",
  "base64",
);

function payment() {
  return {
    receiptNumber: "RCPT-2026-000099",
    paymentDate: new Date("2026-08-01T00:00:00Z"),
    paymentMethod: "cash",
    totalAmountCents: 4000,
    family: {
      familyCode: "FAM-2026-000001",
      name: "Germanos Family",
      email: "family@example.com",
      phone: "+961 1 000000",
      fatherFirstName: "Fouad",
      fatherLastName: "Germanos",
      students: [],
    },
    createdBy: { name: "Administrator", email: "admin@ipsm.local" },
    familyBalances: [
      {
        student: {
          studentCode: "STU-2026-000001",
          firstName: "Maria",
          lastName: "Germanos",
        },
        activity: "Piano / Beginner · Summer 2026",
        balanceBeforePaymentCents: 17000,
        paidNowCents: 4000,
        remainingCents: 13000,
      },
      {
        student: {
          studentCode: "STU-2026-000002",
          firstName: "Charbel",
          lastName: "Germanos",
        },
        activity: "Saxophone / Beginner · Summer 2026",
        balanceBeforePaymentCents: 17000,
        paidNowCents: 0,
        remainingCents: 17000,
      },
    ],
    items: [
      {
        amountCents: 4000,
        enrollment: {
          courseName: "Piano",
          feeCents: 17000,
          discountCents: 0,
          finalFeeCents: 17000,
          remainingCents: 13000,
          season: { name: "Summer 2026" },
          course: { name: "Piano" },
          level: { name: "Beginner" },
          student: {
            studentCode: "STU-2026-000001",
            firstName: "Maria",
            lastName: "Germanos",
          },
        },
      },
    ],
  };
}

describe("redesigned receipt PDF", () => {
  it("shows every family student and a family totals row", () => {
    const pdf = buildReceiptPdfV2(
      payment(),
      "a5",
      "original",
      testStamp,
    ).toString("utf8");
    expect(pdf).toContain("Maria Germanos");
    expect(pdf).toContain("Charbel Germanos");
    expect(pdf).toContain("FAMILY TOTALS");
    expect(pdf).toContain("Family remaining");

    expect(receiptFamilyBalanceTotals(payment())).toEqual({
      balanceBeforePaymentCents: 34000,
      paidNowCents: 4000,
      remainingCents: 30000,
    });
  });

  it("moves totals into the header and leaves the stamp unboxed", () => {
    const pdf = buildReceiptPdfV2(
      payment(),
      "a5",
      "original",
      testStamp,
    ).toString("utf8");
    expect(pdf).toContain("OFFICIAL PAYMENT RECEIPT");
    expect(pdf).toContain("TOTAL PAID");
    expect(pdf).toContain("Official stamp");
    expect(pdf).toContain("/Stamp Do");
    expect(pdf).not.toContain("Official stamp and authorized signature");
  });

  it("keeps customer and school copies on A4", () => {
    const pdf = buildReceiptPdfV2(
      payment(),
      "a4-two-copies",
      "original",
      testStamp,
    ).toString("utf8");
    expect(pdf).toContain("/MediaBox [0 0 595 842]");
    expect(pdf).toContain("Customer Copy");
    expect(pdf).toContain("School Copy");
    expect((pdf.match(/\/Stamp Do/g) ?? []).length).toBe(2);
  });

  it("preserves voided marking and the original receipt number", () => {
    const pdf = buildReceiptPdfV2(
      { ...payment(), voidedAt: new Date("2026-08-02T00:00:00Z") },
      "a5",
      "voided",
      testStamp,
    ).toString("utf8");
    expect(pdf).toContain("(VOID)");
    expect(pdf).toContain("RCPT-2026-000099");
  });
});
