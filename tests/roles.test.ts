import { describe, expect, it } from "vitest";
import { hasPermission, isAdminOrHigher, isProtectedUser, isRole, isSuperAdmin } from "@/lib/auth/roles";

describe("role permissions", () => {
  it("grants super admins all permissions and identifies them above admin", () => {
    expect(hasPermission("SUPER_ADMIN", "users:manage")).toBe(true);
    expect(hasPermission("SUPER_ADMIN", "settings:manage")).toBe(true);
    expect(hasPermission("SUPER_ADMIN", "finance:delete")).toBe(true);
    expect(isSuperAdmin("SUPER_ADMIN")).toBe(true);
    expect(isAdminOrHigher("SUPER_ADMIN")).toBe(true);
    expect(isAdminOrHigher("ADMIN")).toBe(true);
  });

  it("allows admins to manage users and delete financial records", () => {
    expect(hasPermission("ADMIN", "users:manage")).toBe(true);
    expect(hasPermission("ADMIN", "settings:manage")).toBe(true);
    expect(hasPermission("ADMIN", "finance:delete")).toBe(true);
  });

  it("prevents reception from restricted administrative actions", () => {
    expect(hasPermission("RECEPTION", "users:manage")).toBe(false);
    expect(hasPermission("RECEPTION", "settings:manage")).toBe(false);
    expect(hasPermission("RECEPTION", "finance:delete")).toBe(false);
    expect(hasPermission("RECEPTION", "records:write")).toBe(true);
  });

  it("validates supported role values", () => {
    expect(isRole("SUPER_ADMIN")).toBe(true);
    expect(isRole("ADMIN")).toBe(true);
    expect(isRole("PARENT")).toBe(false);
  });

  it("treats super admin and admin@ipsm.local as protected users", () => {
    expect(isProtectedUser({ role: "SUPER_ADMIN", email: "owner@example.com" })).toBe(true);
    expect(isProtectedUser({ role: "ADMIN", email: "admin@ipsm.local" })).toBe(true);
    expect(isProtectedUser({ role: "ADMIN", email: "admin@example.com" })).toBe(false);
  });
});
