import { describe, expect, it } from "vitest";
import { buildReceiptPdfV3 } from "@/lib/payments/receipt-service-v3";
import { receiptFamilyBalanceTotals } from "@/lib/payments/receipt-service-v2";

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
  it("shows every family student on a separate header line and a family totals row", () => {
    const pdf = buildReceiptPdfV3(payment(), "a5", "original", testStamp).toString("utf8");
    expect(pdf).toContain("(Students:) Tj");
    expect(pdf).toContain("(- STU-2026-000001 - Maria Germanos) Tj");
    expect(pdf).toContain("(- STU-2026-000002 - Charbel Germanos) Tj");
    expect(pdf).not.toContain("Maria Germanos, STU-2026-000002");
    expect(pdf).toContain("FAMILY TOTALS");
    expect(pdf).toContain("Family remaining");

    expect(receiptFamilyBalanceTotals(payment())).toEqual({
      balanceBeforePaymentCents: 34000,
      paidNowCents: 4000,
      remainingCents: 30000,
    });
  });

  it("keeps student codes in the header but removes them from balance-table rows", () => {
    const pdf = buildReceiptPdfV3(payment(), "a5", "original", testStamp).toString("utf8");
    expect(pdf).toContain("(- STU-2026-000001 - Maria Germanos) Tj");
    expect(pdf).toContain("(Maria Germanos - Piano / Beginner - Summer 2026) Tj");
    expect(pdf).toContain("(Charbel Germanos - Saxophone / Beginner - Summer 2026) Tj");
    expect(pdf).not.toContain("(STU-2026-000001 Maria Germanos - Piano");
    expect(pdf).not.toContain("(STU-2026-000002 Charbel Germanos - Saxophone");
  });

  it("keeps summary text in the separate right column", () => {
    const pdf = buildReceiptPdfV3(payment(), "a5", "original", testStamp).toString("utf8");
    const receivedBy = /BT \/F1 7 Tf (\d+) (\d+) Td \(Received by: Administrator\)/.exec(pdf);
    const maria = /BT \/F1 7 Tf (\d+) (\d+) Td \(- STU-2026-000001 - Maria Germanos\)/.exec(pdf);
    expect(receivedBy).not.toBeNull();
    expect(maria).not.toBeNull();
    expect(Number(receivedBy?.[1])).toBeGreaterThan(Number(maria?.[1]));
  });

  it("moves totals into the header and leaves the stamp unboxed", () => {
    const pdf = buildReceiptPdfV3(payment(), "a5", "original", testStamp).toString("utf8");
    expect(pdf).toContain("OFFICIAL PAYMENT RECEIPT");
    expect(pdf).toContain("TOTAL PAID");
    expect(pdf).toContain("Official stamp");
    expect(pdf).toContain("/Stamp Do");
    expect(pdf).not.toContain("Official stamp and authorized signature");
  });

  it("keeps customer and school copies on A4", () => {
    const pdf = buildReceiptPdfV3(payment(), "a4-two-copies", "original", testStamp).toString("utf8");
    expect(pdf).toContain("/MediaBox [0 0 595 842]");
    expect(pdf).toContain("Customer Copy");
    expect(pdf).toContain("School Copy");
    expect((pdf.match(/\/Stamp Do/g) ?? []).length).toBe(2);
  });

  it("preserves voided marking and the original receipt number", () => {
    const pdf = buildReceiptPdfV3(
      { ...payment(), voidedAt: new Date("2026-08-02T00:00:00Z") },
      "a5",
      "voided",
      testStamp,
    ).toString("utf8");
    expect(pdf).toContain("(VOID)");
    expect(pdf).toContain("RCPT-2026-000099");
  });
});
