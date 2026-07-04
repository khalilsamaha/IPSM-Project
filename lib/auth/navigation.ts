import { hasPermission, type Role } from "@/lib/auth/roles";

const adminOnlyRoutes = [
  "/settings",
  "/users",
  "/admin",
  "/seasons",
  "/rooms",
  "/teacher-availability",
] as const;

export function canViewNavigationItem(role: Role | null | undefined, href: string) {
  if (!adminOnlyRoutes.some((route) => href === route || href.startsWith(`${route}/`))) return true;
  return role === "ADMIN";
}

export function canAccessProtectedRoute(role: Role | null | undefined, pathname: string) {
  if (pathname === "/settings") return hasPermission(role, "settings:manage");
  if (pathname === "/users") return hasPermission(role, "users:manage");
  if (adminOnlyRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return role === "ADMIN";
  return true;
}
