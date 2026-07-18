import { formatCurrency } from "@/lib/records/format";

const sensitiveKey = /password|token|secret|pdf|cookie|database.?url|digest/i;
export function sanitizeAuditMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return {};
  return Object.fromEntries(Object.entries(metadata as Record<string, unknown>).filter(([key]) => !sensitiveKey.test(key)));
}
export function describeAudit(log: { action: string; entity: string; metadata: unknown; createdBy?: { name?: string | null; role?: string | null; email?: string | null } | null; actorId?: string | null }) {
  const metadata = sanitizeAuditMetadata(log.metadata) as any;
  if (metadata.description) return String(metadata.description);
  const actor = log.createdBy?.name ?? log.createdBy?.email ?? log.actorId ?? "System";
  if (log.entity === "Payment" && log.action === "create") {
    const amount = typeof metadata.totalAmountCents === "number" ? ` of ${formatCurrency(metadata.totalAmountCents)}` : "";
    const receipt = metadata.receiptNumber ? ` (${metadata.receiptNumber})` : "";
    return `${actor} recorded a payment${amount}${receipt}.`;
  }
  if (log.entity === "Payment" && log.action === "void") return `${actor} voided a payment.`;
  return `${actor} ${log.action.replace(/[-_]/g, " ")} ${log.entity.replace(/([a-z])([A-Z])/g, "$1 $2")}.`;
}
export function auditOutcome(metadata: unknown) { return ((sanitizeAuditMetadata(metadata) as any).outcome ?? "success") as string; }
