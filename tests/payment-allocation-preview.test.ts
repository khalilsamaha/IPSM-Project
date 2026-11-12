import { describe, expect, it } from "vitest";
import { allocationPreview, type PaymentEnrollmentOption } from "@/lib/payments/allocation-preview";
const rows: PaymentEnrollmentOption[] = [
  { id: "new", familyId: "family", remainingCents: 6000, startDate: "2026-11-01", createdAt: "2026-11-01", studentName: "Synthetic Lea", courseName: "Piano", levelName: "Beginner", seasonName: "Autumn" },
  { id: "old", familyId: "family", remainingCents: 4000, startDate: "2026-09-01", createdAt: "2026-09-01", studentName: "Synthetic Sami", courseName: "Guitar", levelName: "Beginner", seasonName: "Autumn" },
];
describe("payment allocation UI uses authoritative allocation rules", () => {
  it("allocates oldest first across two students regardless of display order", () => {
    expect(allocationPreview("family", "70", "automatic", {}, rows)).toMatchObject({ error: null, allocatedCents: 7000, unallocatedCents: 0,
      allocations: [{ enrollmentId: "old", amountCents: 4000 }, { enrollmentId: "new", amountCents: 3000 }] });
  });
  it("shows remaining and excess manual amounts live", () => {
    expect(allocationPreview("family", "70", "manual", { new: "30", old: "20" }, rows)).toMatchObject({ allocatedCents: 5000, unallocatedCents: 2000, error: "Manual allocations must equal the payment amount" });
    expect(allocationPreview("family", "70", "manual", { new: "50", old: "30" }, rows).unallocatedCents).toBe(-1000);
    expect(allocationPreview("family", "70", "manual", { new: "40", old: "30" }, rows).error).toBeNull();
  });
  it("rejects overpayment, empty, negative and fractional-cent amounts", () => {
    for (const amount of ["", "0", "-1", "1.001", "101"]) expect(allocationPreview("family", amount, "automatic", {}, rows).error).toBeTruthy();
    expect(allocationPreview("family", "70", "manual", { new: "70" }, rows).error).toContain("remaining enrollment balance");
    expect(allocationPreview("family", "1", "manual", { new: "-1" }, rows).error).toBeTruthy();
  });
  it("does not submit hidden manual values in automatic mode and rejects foreign families", () => {
    expect(allocationPreview("family", "1", "automatic", { new: "99999" }, rows).error).toBeNull();
    expect(allocationPreview("different", "1", "manual", { new: "1" }, rows).error).toContain("selected family");
  });
});
