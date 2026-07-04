export const roles = ["SUPER_ADMIN", "ADMIN", "RECEPTION"] as const;
export type Role = (typeof roles)[number];

export type Permission = "users:manage" | "settings:manage" | "finance:delete" | "records:write" | "reports:read";

const permissions: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: ["users:manage", "settings:manage", "finance:delete", "records:write", "reports:read"],
  ADMIN: ["users:manage", "settings:manage", "finance:delete", "records:write", "reports:read"],
  RECEPTION: ["records:write", "reports:read"],
};

export const systemOwnerEmail = "admin@ipsm.local";

export function hasPermission(role: Role | null | undefined, permission: Permission) {
  if (!role) return false;
  return permissions[role].includes(permission);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.includes(value as Role);
}

export function isSuperAdmin(role: Role | null | undefined) {
  return role === "SUPER_ADMIN";
}

export function isAdminOrHigher(role: Role | null | undefined) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function isProtectedUser(user: { role?: string | null; email?: string | null }) {
  return user.role === "SUPER_ADMIN" || user.email?.toLowerCase() === systemOwnerEmail;
}
