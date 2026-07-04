import { describe, expect, it } from "vitest";
import { buildPaymentCompatibilityFamilyData, buildStudentCreateData, shouldCreatePaymentCompatibilityFamily } from "@/lib/registration/independent-student";

describe("independent student registration helpers", () => {
  it("creates student data without family relation for independent students", () => {
    const data = buildStudentCreateData({ firstName: "Indy", lastName: "Student", email: null, phone: null, dateOfBirth: null }, null);
    expect(data).toEqual({ firstName: "Indy", lastName: "Student", email: null, phone: null, dateOfBirth: null });
    expect(data).not.toHaveProperty("family");
  });

  it("creates student data connected to an existing family", () => {
    const data = buildStudentCreateData({ firstName: "Fam", lastName: "Student" }, "family-1");
    expect(data).toMatchObject({ firstName: "Fam", lastName: "Student", family: { connect: { id: "family-1" } } });
  });

  it("does not create a payment compatibility family without an initial payment", () => {
    expect(shouldCreatePaymentCompatibilityFamily(null, 0)).toBe(false);
  });

  it("creates a lightweight payer payload only for independent initial payments", () => {
    expect(shouldCreatePaymentCompatibilityFamily(null, 2500)).toBe(true);
    expect(shouldCreatePaymentCompatibilityFamily("family-1", 2500)).toBe(false);
    expect(buildPaymentCompatibilityFamilyData({ firstName: "Indy", lastName: "Student", email: "indy@example.com", phone: "555" })).toEqual({
      name: "Student Family / Group",
      email: "indy@example.com",
      phone: "555",
      notes: "Lightweight payer record created for an independent student payment.",
    });
  });
});
