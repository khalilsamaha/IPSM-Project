import { hasPermission, type Role } from "@/lib/auth/roles";

const adminOnlyRoutes = new Set(["/settings", "/users"]);

export function canViewNavigationItem(role: Role | null | undefined, href: string) {
  if (!adminOnlyRoutes.has(href)) return true;
  return role === "ADMIN";
}

export function canAccessProtectedRoute(role: Role | null | undefined, pathname: string) {
  if (pathname === "/settings") return hasPermission(role, "settings:manage");
  if (pathname === "/users") return hasPermission(role, "users:manage");
  return true;
}
