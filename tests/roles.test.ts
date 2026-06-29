import { describe, expect, it } from "vitest";
import { hasPermission, isRole } from "@/lib/auth/roles";

describe("role permissions", () => {
  it("allows admins to manage users and delete financial records", () => {
    expect(hasPermission("ADMIN", "users:manage")).toBe(true);
    expect(hasPermission("ADMIN", "finance:delete")).toBe(true);
  });

  it("prevents reception from restricted administrative actions", () => {
    expect(hasPermission("RECEPTION", "users:manage")).toBe(false);
    expect(hasPermission("RECEPTION", "finance:delete")).toBe(false);
    expect(hasPermission("RECEPTION", "records:write")).toBe(true);
  });

  it("validates supported role values", () => {
    expect(isRole("ADMIN")).toBe(true);
    expect(isRole("PARENT")).toBe(false);
  });
});
