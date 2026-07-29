import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { calculateFamilyFinancialSummary } from "@/lib/family-financial-summary";
import { formatDateShort, formatDateTimeShort, formatTime24 } from "@/lib/date-time";

const paymentAction = readFileSync("actions/payments.ts", "utf8");
const coveredPages = ["app/families/page.tsx", "app/families/[id]/page.tsx", "app/payments/page.tsx", "app/payments/new/page.tsx", "app/payments/[id]/page.tsx", "app/shifts/page.tsx", "app/shifts/[id]/page.tsx"].map((path) => readFileSync(path, "utf8")).join("\n");

describe("production payment action", () => {
  it("handles shift validation before creating anything and preserves form context", () => {
    expect(paymentAction.indexOf("requireCurrentOpenShift")).toBeLessThan(paymentAction.indexOf("createPaymentWithAllocations(prisma"));
    expect(paymentAction).toContain("Open your cashier shift before recording a payment.");
    expect(paymentAction).toContain("familyId, paymentMethod: method, notes");
    expect(paymentAction).toContain('logServerError("create-payment-shift"');
  });
  it("keeps success redirect outside the payment catch", () => {
    expect(paymentAction).toMatch(/catch \(error\)[\s\S]*?redirect\(paymentFormUrl[\s\S]*?\}\n\n  \/\/ Keep the successful redirect[\s\S]*redirect\(`\/payments\/\$\{paymentId\}/);
  });
});

describe("family financial summaries", () => {
  it.each([
    ["one", [{ id: "a", finalFeeCents: 10000, paidCents: 0, remainingCents: 10000 }], [10000, 0, 10000, 1]],
    ["siblings and seasons", [{ id: "a", finalFeeCents: 10000, paidCents: 4000, remainingCents: 6000 }, { id: "b", finalFeeCents: 20000, paidCents: 20000, remainingCents: 0 }], [30000, 24000, 6000, 1]],
    ["settled", [{ id: "a", finalFeeCents: 10000, paidCents: 10000, remainingCents: 0 }], [10000, 10000, 0, 0]],
    ["void reversal", [{ id: "a", finalFeeCents: 10000, paidCents: 2000, remainingCents: 8000 }], [10000, 2000, 8000, 1]],
  ])("calculates %s from stored enrollment cents", (_name, rows, expected) => {
    const result = calculateFamilyFinancialSummary(rows, { logErrors: false });
    expect([result.totalAmountCents, result.paidCents, result.remainingCents, result.outstandingEnrollmentCount]).toEqual(expected);
  });
  it("reports reconciliation mismatches", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = calculateFamilyFinancialSummary([{ id: "bad", finalFeeCents: 100, paidCents: 20, remainingCents: 70 }], { familyId: "family" });
    expect(result.hasReconciliationErrors).toBe(true);
    expect(result.reconciliationErrors).toEqual(["bad"]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("business date displays", () => {
  it("uses dd/mm/yy and 24-hour formats at a UTC midnight edge", () => {
    const instant = new Date("2026-07-27T21:30:00.000Z");
    expect(formatDateShort(instant)).toBe("28/07/26");
    expect(formatDateTimeShort(instant)).toBe("28/07/26 00:30");
    expect(formatTime24(instant)).toBe("00:30");
  });
  it("does not use visible ISO slicing on covered pages", () => {
    expect(coveredPages).not.toContain("{p.paymentDate.toISOString");
    expect(coveredPages).not.toContain("{family.updatedAt.toISOString");
  });
});
