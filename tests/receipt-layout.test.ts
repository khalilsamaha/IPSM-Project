import { describe, expect, it } from "vitest";
import { buildReceiptPdf } from "@/lib/payments/receipt-service";
import { inspectOfficialStampAsset, OFFICIAL_STAMP_PATH } from "@/lib/payments/receipt-service";
import { readFileSync, statSync } from "node:fs";

// Transparent 1x1 test fixture. Production always reads the separately
// provisioned authorized stamp; tests never substitute this fixture there.
const testStamp = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==", "base64");
const receipt = (value: Parameters<typeof buildReceiptPdf>[0], layout: "a5" | "a4-two-copies" = "a5", mode?: "original" | "reprint" | "voided") => buildReceiptPdf(value, layout, mode, testStamp);

function payment(itemCount = 3) {
  return {
    receiptNumber: "RCPT-2026-0007",
    paymentDate: new Date("2026-07-16T00:00:00Z"),
    paymentMethod: "cash",
    totalAmountCents: itemCount * 1000,
    family: { name: "A very long Family Group Name That Should Wrap Safely Without Leaving Boxes", email: "family@example.com", phone: "+1 555 0000", fatherPhone: null, motherPhone: null, fatherEmail: null, motherEmail: null },
    student: null,
    createdBy: { name: "Reception User", email: "r@example.com" },
    items: Array.from({ length: itemCount }, (_, index) => ({ amountCents: 1000, enrollment: { courseName: `Very Long Instrument Course Name ${index} With Additional Details`, feeCents: 2000, discountCents: 100, finalFeeCents: 1900, remainingCents: 900, season: { name: "Summer 2026" }, course: { name: `Piano Ensemble With Long Course Name ${index}` }, level: { name: "Advanced Level With Long Name" }, student: { studentCode: `STU-${index}`, firstName: "Alexandria-Cassandra", lastName: `Longlastname-${index}` } } })),
  };
}

describe("receipt PDF layout", () => {
  it("decodes and embeds the real committed production stamp", () => {
    expect(statSync(OFFICIAL_STAMP_PATH).size).toBeGreaterThan(0);
    const productionStamp = readFileSync(OFFICIAL_STAMP_PATH);
    const inspection = inspectOfficialStampAsset(productionStamp);
    expect(inspection.width).toBeGreaterThan(1);
    expect(inspection.height).toBeGreaterThan(1);
    for (const [layout, mode] of [["a5", "original"], ["a4-two-copies", "original"], ["a5", "reprint"], ["a5", "voided"]] as const) {
      const pdf = buildReceiptPdf(payment(2), layout, mode, productionStamp).toString("utf8");
      expect(pdf).toContain("/Subtype /Image");
      expect(pdf).toContain("/Stamp Do");
    }
  });
  it("uses A5 MediaBox by default", () => {
    expect(receipt(payment()).toString("utf8")).toContain("/MediaBox [0 0 420 595]");
  });
  it("wraps long names and does not emit omitted allocation notices", () => {
    const pdf = receipt(payment(16)).toString("utf8");
    expect(pdf).not.toContain("omitted");
    expect(pdf).toContain("Continued on next A5 page");
  });
  it("supports A4 two-copy output with the same receipt number", () => {
    const pdf = receipt(payment(2), "a4-two-copies").toString("utf8");
    expect(pdf).toContain("/MediaBox [0 0 595 842]");
    expect(pdf).toContain("Customer Copy");
    expect(pdf).toContain("School Copy");
    expect((pdf.match(/RCPT-2026-0007/g) ?? []).length).toBe(2);
    expect((pdf.match(/\/Stamp Do/g) ?? []).length).toBe(2);
    expect(pdf).toContain("/SMask");
  });
  it("marks voided copies without changing the receipt number", () => {
    const pdf = receipt({ ...payment(1), voidedAt: new Date() }, "a5").toString("utf8");
    expect(pdf).toContain("(VOID)");
    expect(pdf).toContain("RCPT-2026-0007");
    expect(pdf).toContain("allocations were reversed");
  });
});
