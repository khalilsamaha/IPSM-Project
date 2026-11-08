import { parseBusinessIdentifier } from "@/lib/business-identifiers";

/** Read-only legacy/IPSM compatibility. Issuance is exclusively PostgreSQL-backed. */
export function parseReceiptNumber(value: string | null | undefined) {
  const parsed = parseBusinessIdentifier(value);
  return parsed?.kind === "RCPT" ? { year: parsed.year, sequence: parsed.serial, namespace: parsed.namespace } : null;
}
