export const roles = ["ADMIN", "RECEPTION"] as const;
export type Role = (typeof roles)[number];

export type Permission = "users:manage" | "settings:manage" | "finance:delete" | "records:write" | "reports:read";

const permissions: Record<Role, readonly Permission[]> = {
  ADMIN: ["users:manage", "settings:manage", "finance:delete", "records:write", "reports:read"],
  RECEPTION: ["records:write", "reports:read"],
};

export function hasPermission(role: Role | null | undefined, permission: Permission) {
  if (!role) return false;
  return permissions[role].includes(permission);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.includes(value as Role);
}
