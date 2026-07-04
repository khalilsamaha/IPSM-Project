import { describe, expect, it } from "vitest";
import { navSections } from "@/components/records/sidebar-nav";
import { canAccessProtectedRoute, canViewNavigationItem } from "@/lib/auth/navigation";

function labelsForSection(sectionLabel: string) {
  const section = navSections.find((item) => item.label === sectionLabel);
  return section?.items.map((item) => item.label) ?? [];
}

describe("admin-only navigation and route access", () => {
  it("organizes sidebar items by workflow area instead of one configuration menu", () => {
    expect(labelsForSection("Daily Operations")).toEqual(["Register Student", "Payments", "Lessons / Schedule", "Expenses"]);
    expect(labelsForSection("People")).toEqual(["Families", "Students", "Teachers"]);
    expect(labelsForSection("Academic")).toEqual(["Seasons", "Enrollments", "Courses & Pricing"]);
    expect(labelsForSection("Scheduling")).toEqual(["Lessons / Schedule", "Rooms", "Teacher Availability"]);
    expect(labelsForSection("Finance")).toEqual(["Payments", "Expenses", "Reports"]);
    expect(labelsForSection("System / Admin")).toEqual(["Users", "School Profile", "Receipt Settings", "Advanced Settings"]);
    expect(navSections.flatMap((section) => section.items.map((item) => item.label))).not.toContain("School Configuration");
  });

  it("hides admin-only configuration navigation from reception users", () => {
    expect(canViewNavigationItem("RECEPTION", "/settings#school-profile")).toBe(false);
    expect(canViewNavigationItem("RECEPTION", "/settings#receipt-settings")).toBe(false);
    expect(canViewNavigationItem("RECEPTION", "/settings#advanced-settings")).toBe(false);
    expect(canViewNavigationItem("RECEPTION", "/users")).toBe(false);
    expect(canViewNavigationItem("RECEPTION", "/admin/academic-pricing")).toBe(false);
    expect(canViewNavigationItem("RECEPTION", "/admin/diagnostics")).toBe(false);
    expect(canViewNavigationItem("RECEPTION", "/rooms")).toBe(false);
    expect(canViewNavigationItem("RECEPTION", "/teacher-availability")).toBe(false);
    expect(canViewNavigationItem("RECEPTION", "/seasons")).toBe(false);
    expect(canViewNavigationItem("RECEPTION", "/dashboard")).toBe(true);
    expect(canViewNavigationItem("RECEPTION", "/register-student")).toBe(true);
    expect(canViewNavigationItem("RECEPTION", "/payments")).toBe(true);
    expect(canViewNavigationItem("RECEPTION", "/schedule")).toBe(true);
    expect(canViewNavigationItem("RECEPTION", "/expenses")).toBe(true);
  });

  it("keeps configuration navigation visible for admins and super admins", () => {
    expect(canViewNavigationItem("ADMIN", "/settings#school-profile")).toBe(true);
    expect(canViewNavigationItem("ADMIN", "/settings#receipt-settings")).toBe(true);
    expect(canViewNavigationItem("ADMIN", "/settings#advanced-settings")).toBe(true);
    expect(canViewNavigationItem("ADMIN", "/users")).toBe(true);
    expect(canViewNavigationItem("ADMIN", "/admin/academic-pricing")).toBe(true);
    expect(canViewNavigationItem("ADMIN", "/rooms")).toBe(true);
    expect(canViewNavigationItem("SUPER_ADMIN", "/users")).toBe(true);
    expect(canViewNavigationItem("SUPER_ADMIN", "/admin/diagnostics")).toBe(true);
  });

  it("blocks reception users from protected admin routes", () => {
    expect(canAccessProtectedRoute("RECEPTION", "/settings")).toBe(false);
    expect(canAccessProtectedRoute("RECEPTION", "/users")).toBe(false);
    expect(canAccessProtectedRoute("RECEPTION", "/admin/courses")).toBe(false);
    expect(canAccessProtectedRoute("RECEPTION", "/admin/diagnostics")).toBe(false);
    expect(canAccessProtectedRoute("RECEPTION", "/rooms")).toBe(false);
    expect(canAccessProtectedRoute("RECEPTION", "/teacher-availability")).toBe(false);
    expect(canAccessProtectedRoute("RECEPTION", "/seasons")).toBe(false);
  });

  it("keeps admin and super admin access to protected admin routes", () => {
    expect(canAccessProtectedRoute("ADMIN", "/settings")).toBe(true);
    expect(canAccessProtectedRoute("ADMIN", "/users")).toBe(true);
    expect(canAccessProtectedRoute("ADMIN", "/admin/courses")).toBe(true);
    expect(canAccessProtectedRoute("ADMIN", "/admin/diagnostics")).toBe(true);
    expect(canAccessProtectedRoute("ADMIN", "/rooms")).toBe(true);
    expect(canAccessProtectedRoute("SUPER_ADMIN", "/settings")).toBe(true);
    expect(canAccessProtectedRoute("SUPER_ADMIN", "/users")).toBe(true);
    expect(canAccessProtectedRoute("SUPER_ADMIN", "/admin/courses")).toBe(true);
  });
});
