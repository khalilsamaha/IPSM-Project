export function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

export function academicPricingUrl(kind: "success" | "error", message: string) {
  return `/admin/academic-pricing?${kind}=${encodeURIComponent(message)}`;
}
