import { describe, expect, it } from "vitest";
import { canAccessProtectedRoute, canViewNavigationItem } from "@/lib/auth/navigation";

describe("admin-only navigation and route access", () => {
  it("hides Settings and Users navigation from reception users", () => {
    expect(canViewNavigationItem("RECEPTION", "/settings")).toBe(false);
    expect(canViewNavigationItem("RECEPTION", "/users")).toBe(false);
    expect(canViewNavigationItem("RECEPTION", "/dashboard")).toBe(true);
  });

  it("keeps Settings and Users navigation visible for admins", () => {
    expect(canViewNavigationItem("ADMIN", "/settings")).toBe(true);
    expect(canViewNavigationItem("ADMIN", "/users")).toBe(true);
  });

  it("blocks reception users from protected admin routes", () => {
    expect(canAccessProtectedRoute("RECEPTION", "/settings")).toBe(false);
    expect(canAccessProtectedRoute("RECEPTION", "/users")).toBe(false);
  });

  it("keeps admin access to protected admin routes unchanged", () => {
    expect(canAccessProtectedRoute("ADMIN", "/settings")).toBe(true);
    expect(canAccessProtectedRoute("ADMIN", "/users")).toBe(true);
  });
});
