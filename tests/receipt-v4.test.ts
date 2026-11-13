import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { buildReceiptPdfV4, OFFICIAL_LOGO_PATH, OFFICIAL_LOGO_SHA256, RECEIPT_A5 } from "@/lib/payments/receipt-service-v4";
import { receiptFamilyBalanceTotals } from "@/lib/payments/receipt-service-v2";
import { receiptFixture } from "./fixtures/receipt-v4";
const assetFailure = vi.hoisted(() => ({ target: "", code: "ENOENT" }));
vi.mock("node:fs", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, readFileSync: (...args: Parameters<typeof actual.readFileSync>) => {
    if (assetFailure.target && String(args[0]).includes(assetFailure.target)) throw Object.assign(new Error("Synthetic asset failure"), { code: assetFailure.code });
    return actual.readFileSync(...args);
  } };
});
const testStamp = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==", "base64");
async function inspect(bytes: Buffer) {
  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPages().map(page => {
    const contents = page.node.Contents() as PDFArray;
    const stream = contents.asArray().map(ref => Buffer.from(decodePDFRawStream(doc.context.lookup(ref) as PDFRawStream).decode()).toString("latin1")).join("\n");
    const text = [...stream.matchAll(/<([0-9A-Fa-f]+)> Tj/g)].map(match => Buffer.from(match[1], "hex").toString("latin1")).join("\n");
    return { page, stream, text };
  });
  return { doc, pages, text: pages.map(page => page.text).join("\n") };
}
afterEach(() => { assetFailure.target = ""; assetFailure.code = "ENOENT"; });

describe("authoritative A5 receipt V4", () => {
  it.each([1, 2, 3, 5, 6, 10, 24])("retains all %i student balance rows and paginates measured A5 pages", async count => {
    const payment = receiptFixture(count, count === 24, count !== 1), before = structuredClone(payment);
    const { pages, text } = await inspect(await buildReceiptPdfV4(payment, "a4-two-copies", undefined, testStamp));
    for (const [index, { page, text: pageText }] of pages.entries()) {
      expect(page.getWidth()).toBeCloseTo(RECEIPT_A5.width, 6);
      expect(page.getHeight()).toBeCloseTo(RECEIPT_A5.height, 6);
      expect(pageText).toContain(payment.receiptNumber);
      expect(pageText).toContain(`Page ${index + 1} of ${pages.length}`);
      if (index !== pages.length - 1) expect(pageText).not.toContain("FAMILY TOTALS");
    }
    if (count <= 3) expect(pages).toHaveLength(1);
    if (count >= 10) expect(pages.length).toBeGreaterThan(1);
    for (const row of payment.familyBalances!) {
      expect(text.split(row.student.studentCode)).toHaveLength(2);
      // All wrapped words retained, including zero-paid rows and multiple seasons.
      for (const word of `${row.student.firstName} ${row.student.lastName} ${row.activity}`.split(/\s+/)) expect(text).toContain(word);
    }
    expect(text.split("FAMILY TOTALS")).toHaveLength(2);
    const totals = receiptFamilyBalanceTotals(payment);
    const last = pages.at(-1)!.text;
    expect(last).toContain("STUDENT / ACTIVITY");
    expect(last).toContain(`USD ${(totals.balanceBeforePaymentCents / 100).toFixed(2)}`);
    expect(last).toContain(`USD ${(totals.paidNowCents / 100).toFixed(2)}`);
    expect(last).toContain(`USD ${(totals.remainingCents / 100).toFixed(2)}`);
    expect(text).toContain("Amount in words:");
    expect(text).toContain("Student balances and family totals reflect this posted payment.");
    expect(text).not.toContain("...");
    expect(payment).toEqual(before);
  });
  it("splits an oversized single activity without repeating monetary entries", async () => {
    const payment = receiptFixture(1);
    payment.familyBalances![0].activity = Array.from({ length: 250 }, (_, i) => `Course-${i} advanced season`).join(", ");
    const { pages, text } = await inspect(await buildReceiptPdfV4(payment, "a5", undefined, testStamp));
    expect(pages.length).toBeGreaterThan(2);
    expect(text).toContain("Course-249");
    expect(pages.at(-1)!.text).toContain("STUDENT / ACTIVITY");
    expect(text.split(payment.familyBalances![0].student.studentCode)).toHaveLength(2);
    expect(text.split("USD 46.90").length - 1).toBe(5); // total-paid summary, row before/paid, final before/paid
    for (const { text: pageText } of pages.slice(1, -1)) {
      expect(pageText).toContain("STUDENT / ACTIVITY");
      expect(pageText).not.toContain("USD 46.90");
    }
  });
  it("flows long summary fields without truncation or orphaned table headings", async () => {
    const payment = receiptFixture(1);
    payment.family.name = "Long family information ".repeat(250) + "LAST-FAMILY-WORD";
    const { pages, text } = await inspect(await buildReceiptPdfV4(payment, "a5", undefined, testStamp));
    expect(pages.length).toBeGreaterThan(2);
    expect(text).toContain("LAST-FAMILY-WORD");
    for (const { text: pageText } of pages) if (pageText.includes("STUDENT / ACTIVITY")) expect(pageText).toContain("STU-IPSM");
  });
  it("embeds the exact original JPEG separately from the validated stamp and alpha mask", async () => {
    const original = readFileSync(OFFICIAL_LOGO_PATH);
    expect(createHash("sha256").update(original).digest("hex")).toBe(OFFICIAL_LOGO_SHA256);
    const { doc, pages } = await inspect(await buildReceiptPdfV4(receiptFixture(10)));
    const streams = doc.context.enumerateIndirectObjects().map(([, object]) => object).filter((object): object is PDFRawStream => object instanceof PDFRawStream);
    const jpeg = streams.filter(stream => stream.dict.get(PDFName.of("Filter"))?.toString() === "/DCTDecode");
    expect(jpeg).toHaveLength(1);
    expect(Buffer.from(jpeg[0].contents)).toEqual(original);
    expect(streams.filter(stream => stream.dict.has(PDFName.of("SMask")))).toHaveLength(1);
    expect(pages.filter(page => /\/Stamp-\d+ Do/.test(page.stream))).toHaveLength(1);
    expect(pages.at(-1)!.text).toContain("Official stamp");
    expect(pages.every(page => page.stream.includes("W\nn"))).toBe(true); // blank-margin clipping only
  });
  it.each(["original", "reprint", "voided"] as const)("retains mode %s, full BIGINT receipt number and Whish", async mode => {
    const payment = receiptFixture(1); payment.paymentMethod = "whish";
    payment.receiptNumber = "RCPT-IPSM-2027-9223372036854775807";
    const { text } = await inspect(await buildReceiptPdfV4(payment, "a5", mode, testStamp));
    expect(text).toContain(payment.receiptNumber);
    expect(text).toContain(mode === "voided" ? "VOIDED COPY" : mode.toUpperCase());
    expect(text).toContain("Whish");
  });
  it("does not let a requested original mode hide a voided payment", async () => {
    const { text } = await inspect(await buildReceiptPdfV4({ ...receiptFixture(), voidedAt: new Date() }, "a5", "original", testStamp));
    expect(text).toContain("VOIDED COPY");
  });
  it.each([["ipsm-logo-original.jpg", "ENOENT", "LOGO_FILE_MISSING"], ["ipsm-logo-original.jpg", "EACCES", "LOGO_FILE_UNREADABLE"], ["ipsm-official-stamp.png", "ENOENT", "STAMP_FILE_MISSING"], ["ipsm-official-stamp.png", "EACCES", "STAMP_FILE_UNREADABLE"]])("fails safely for %s / %s", async (target, code, expected) => {
    assetFailure.target = target; assetFailure.code = code;
    await expect(buildReceiptPdfV4(receiptFixture())).rejects.toMatchObject({ code: expected });
  });
  it("rejects corrupt logo/stamp and never silently substitutes an unbranded receipt", async () => {
    await expect(buildReceiptPdfV4(receiptFixture(), "a5", undefined, testStamp, Buffer.from("corrupt"))).rejects.toMatchObject({ code: "LOGO_INVALID_JPEG" });
    await expect(buildReceiptPdfV4(receiptFixture(), "a5", undefined, Buffer.from("corrupt"))).rejects.toMatchObject({ code: "STAMP_INVALID_PNG" });
  });
  it("preserves accented Latin text and explicitly rejects unsupported font characters", async () => {
    const payment = receiptFixture(); payment.family.name = "Élodie Saint-Michel";
    expect((await inspect(await buildReceiptPdfV4(payment, "a5", undefined, testStamp))).text).toContain(payment.family.name);
    payment.family.name = "موسيقى";
    await expect(buildReceiptPdfV4(payment, "a5", undefined, testStamp)).rejects.toMatchObject({ code: "TEXT_UNSUPPORTED" });
  });
});
