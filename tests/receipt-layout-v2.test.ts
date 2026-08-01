import { describe, expect, it } from "vitest";
import { buildReceiptPdfV2 } from "@/lib/payments/receipt-service-v2";

const testStamp = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==",
  "base64",
);

function payment() {
  return {
    receiptNumber: "RCPT-2026-000099",
    paymentDate: new Date("2026-08-01T00:00:00Z"),
    paymentMethod: "cash",
    totalAmountCents: 33000,
    family: {
      familyCode: "FAM-2026-000001",
      name: "Dagher Family",
      email: "family@example.com",
      phone: "+961 1 000000",
      fatherFirstName: "Fouad",
      fatherLastName: "Dagher",
      students: [],
    },
    createdBy: { name: "Administrator", email: "admin@ipsm.local" },
    items: [
      {
        amountCents: 33000,
        enrollment: {
          courseName: "Piano",
          feeCents: 33000,
          discountCents: 0,
          finalFeeCents: 33000,
          remainingCents: 0,
          season: { name: "Summer 2026" },
          course: { name: "Piano" },
          level: { name: "Beginner" },
          student: {
            studentCode: "STU-2026-000001",
            firstName: "Jad",
            lastName: "Dagher",
          },
        },
      },
    ],
  };
}

describe("redesigned receipt PDF", () => {
  it("moves totals into the header and leaves the stamp unboxed", () => {
    const pdf = buildReceiptPdfV2(payment(), "a5", "original", testStamp).toString("utf8");
    expect(pdf).toContain("OFFICIAL PAYMENT RECEIPT");
    expect(pdf).toContain("TOTAL PAID");
    expect(pdf).toContain("Official stamp");
    expect(pdf).toContain("/Stamp Do");
    expect(pdf).not.toContain("Official stamp and authorized signature");
  });

  it("keeps customer and school copies on A4", () => {
    const pdf = buildReceiptPdfV2(payment(), "a4-two-copies", "original", testStamp).toString("utf8");
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
