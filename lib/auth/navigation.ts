import { hasPermission, isAdminOrHigher, isSuperAdmin, type Role } from "@/lib/auth/roles";

const adminOnlyRoutes = [
  "/settings",
  "/users",
  "/admin",
  "/seasons",
  "/rooms",
  "/payroll",
  "/attendance",
] as const;

const adminOnlyNavigationRoutes = [...adminOnlyRoutes] as const;

export function canViewNavigationItem(role: Role | null | undefined, href: string) {
  const [pathname] = href.split("#");
  if (pathname === "/admin/operations" || pathname.startsWith("/admin/operations/")) return Boolean(role);
  if (pathname === "/settings/production-reset" || pathname.startsWith("/settings/production-reset/") || pathname === "/admin/activity" || pathname.startsWith("/admin/activity/")) return isSuperAdmin(role);
  if (!adminOnlyNavigationRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return true;
  return isAdminOrHigher(role);
}

export function canAccessProtectedRoute(role: Role | null | undefined, pathname: string) {
  if (pathname === "/admin/operations" || pathname.startsWith("/admin/operations/")) return Boolean(role);
  if (pathname === "/settings/production-reset" || pathname.startsWith("/settings/production-reset/") || pathname === "/admin/activity" || pathname.startsWith("/admin/activity/")) return isSuperAdmin(role);
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return hasPermission(role, "settings:manage");
  if (pathname === "/teacher-availability" || pathname.startsWith("/teacher-availability/")) return Boolean(role);
  if (pathname === "/users" || pathname.startsWith("/users/")) return hasPermission(role, "users:manage");
  if (adminOnlyRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return isAdminOrHigher(role);
  return true;
}
