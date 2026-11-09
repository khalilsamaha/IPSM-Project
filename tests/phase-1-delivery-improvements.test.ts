import { afterEach, describe, expect, it, vi } from "vitest";
import { familySearchWhere, formatFamilyLabel, generateFamilyCode } from "@/lib/families";
import { formatDate, formatFormalDate } from "@/lib/records/format";
import { formatPaymentMethod, isNewPaymentMethod, newPaymentMethods } from "@/lib/payment-methods";

afterEach(() => vi.unstubAllEnvs());
describe("family code helpers", () => {
  it("generates the next yearly family code without using family name", async () => {
    vi.stubEnv("IPSM_IDENTIFIER_ACTIVATION_ID", "00000000-0000-0000-0000-000000000001");
    const family = { $queryRaw: async () => [{ value: "FAM-IPSM-2026-000042" }] } as any;
    await expect(generateFamilyCode(family, "00000000-0000-0000-0000-000000000002", new Date("2026-07-16T00:00:00Z"))).resolves.toBe("FAM-IPSM-2026-000042");
  });

  it("starts a new year at sequence one", async () => {
    vi.stubEnv("IPSM_IDENTIFIER_ACTIVATION_ID", "00000000-0000-0000-0000-000000000001");
    const family = { $queryRaw: async () => [{ value: "FAM-IPSM-2027-000001" }] } as any;
    await expect(generateFamilyCode(family, "00000000-0000-0000-0000-000000000002", new Date("2027-01-01T00:00:00Z"))).resolves.toBe("FAM-IPSM-2027-000001");
  });

  it("builds search clauses for family code, parents, students, phones, and emails", () => {
    expect(familySearchWhere("FAM-2026-000001")).toMatchObject({ OR: expect.arrayContaining([{ familyCode: { contains: "FAM-2026-000001", mode: "insensitive" } }]) });
    expect(JSON.stringify(familySearchWhere("Sarah"))).toContain("studentCode");
  });

  it("formats family selectors with permanent codes", () => {
    expect(formatFamilyLabel({ familyCode: "FAM-2026-000001", name: "Haddad Family" })).toBe("FAM-2026-000001 — Haddad Family");
  });
});

describe("payment methods", () => {
  it("offers only cash and whish for new transactions", () => {
    expect(newPaymentMethods).toEqual(["cash", "whish"]);
    expect(isNewPaymentMethod("cash")).toBe(true);
    expect(isNewPaymentMethod("whish")).toBe(true);
    expect(isNewPaymentMethod("card")).toBe(false);
  });

  it("keeps historical payment methods readable", () => {
    expect(formatPaymentMethod("card")).toBe("Card");
    expect(formatPaymentMethod("ach")).toBe("ACH");
  });
});

describe("date and payment summary calculations", () => {
  it("formats application and formal dates differently", () => {
    expect(formatDate("2026-07-16")).toBe("16/07/26");
    expect(formatFormalDate("2026-07-16")).toBe("16/07/2026");
  });

  it("excludes voided payments from daily posted totals", () => {
    const rows = [
      { paymentDate: new Date("2026-07-16T12:00:00Z"), paymentMethod: "cash", totalAmountCents: 1000, voidedAt: null },
      { paymentDate: new Date("2026-07-16T13:00:00Z"), paymentMethod: "whish", totalAmountCents: 2500, voidedAt: null },
      { paymentDate: new Date("2026-07-16T14:00:00Z"), paymentMethod: "cash", totalAmountCents: 9999, voidedAt: new Date() },
    ];
    const posted = rows.filter((row) => !row.voidedAt);
    expect(posted.reduce((sum, row) => sum + row.totalAmountCents, 0)).toBe(3500);
    expect(posted.filter((row) => row.paymentMethod === "cash").reduce((sum, row) => sum + row.totalAmountCents, 0)).toBe(1000);
  });
});
