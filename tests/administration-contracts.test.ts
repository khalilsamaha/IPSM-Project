import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assertOrdinaryExpense, requireOtherNote } from "@/lib/expense-categories";
import { renderReceipt } from "@/lib/payments/receipt-renderer";
import { buildReceiptPdfV3 } from "@/lib/payments/receipt-service-v3";

describe("administration compatibility", () => {
  it("retains the supplied logo bytes and separate receipt stamp", () => {
    expect(createHash("sha256").update(readFileSync("public/assets/branding/ipsm-logo-original.jpg")).digest("hex")).toBe("ce96d609dc682392b5b98dfa1057c351ad40ada7d7534352ec7f4c3708b337f4");
    const favicon = readFileSync("public/assets/branding/ipsm-fingerprint-icon.png");
    expect(createHash("sha256").update(favicon).digest("hex")).toBe("f59a21454fdd014d472c5967d8c85689b32055c23dbc0d796c32be4e99cd750d");
    expect(readFileSync("app/layout.tsx", "utf8")).toContain("/assets/branding/ipsm-fingerprint-icon.png");
    expect(renderReceipt).toBe(buildReceiptPdfV3);
    expect(readFileSync("lib/payments/receipt-service.ts", "utf8")).toContain("STAMP_FILE_MISSING");
  });
  it("protects linked and legacy payroll expense postings", () => {
    for (const expense of [{ category: "Teacher Payroll" }, { category: " teacher   payroll " }, { category: "Rent", payrollId: "linked" }]) expect(() => assertOrdinaryExpense(expense)).toThrow(/protected/);
    expect(() => assertOrdinaryExpense({ category: "Historic utilities" })).not.toThrow();
  });
  it("requires descriptive Other notes without rewriting legacy category values", () => {
    for (const note of ["", "Other", "Miscellaneous", "Short"]) expect(() => requireOtherNote("Other", note)).toThrow();
    expect(() => requireOtherNote("Other", "Replacement music stand feet")).not.toThrow();
    expect(() => requireOtherNote("Historic supplies", "Note")).not.toThrow();
  });
  it("keeps the category delta mirrors identical", () => {
    expect(readFileSync("prisma/migrations/20261112000000_expense_categories/migration.sql", "utf8")).toBe(readFileSync("supabase/migrations/20261112000000_expense_categories.sql", "utf8"));
  });
});
