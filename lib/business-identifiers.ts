import type { Prisma, PrismaClient } from "@prisma/client";

export type IdentifierStore = Pick<Prisma.TransactionClient, "$queryRaw">;
export type BusinessIdentifierKind = "STU" | "FAM" | "RCPT";
export const MAX_IDENTIFIER_SERIAL = BigInt("9223372036854775807");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseBusinessIdentifier(value: string | null | undefined) {
  if (!value || value.length > 64) return null;
  const match = value.match(/^(FAM|STU|RCPT)-(IPSM-)?([0-9]{4})-([0-9]+)$/);
  if (!match) return null;
  const serial = BigInt(match[4]);
  const year = Number(match[3]);
  if (serial < BigInt("1") || serial > MAX_IDENTIFIER_SERIAL || year < 2000 || year > 9999) return null;
  if (match[2] && match[4] !== serial.toString().padStart(6, "0")) return null;
  return { kind: match[1] as BusinessIdentifierKind, namespace: match[2] ? "IPSM" as const : "legacy" as const, year, serial };
}

/** Stable display ordering across legacy/new formats, including BIGINT serials. */
export function compareBusinessIdentifiers(left: string | null, right: string | null) {
  const a=parseBusinessIdentifier(left), b=parseBusinessIdentifier(right);
  if (!a || !b) return a ? -1 : b ? 1 : (left ?? "").localeCompare(right ?? "");
  return a.kind.localeCompare(b.kind) || a.year-b.year
    || (a.namespace === b.namespace ? 0 : a.namespace === "legacy" ? -1 : 1)
    || (a.serial === b.serial ? (left ?? "").localeCompare(right ?? "") : a.serial < b.serial ? -1 : 1);
}

/** Call inside the same transaction as creation. Never deliver a value before commit. */
export async function allocateBusinessIdentifier(store: IdentifierStore, kind: BusinessIdentifierKind, ownerId: string, date = new Date()) {
  const activation = process.env.IPSM_IDENTIFIER_ACTIVATION_ID;
  if (!activation || !uuid.test(activation)) throw new Error("Identifier issuance is blocked pending certification and recovery approval.");
  if (!uuid.test(ownerId) || !["FAM", "STU", "RCPT"].includes(kind) || !Number.isFinite(date.getTime())
    || date.getUTCFullYear() < 2000 || date.getUTCFullYear() > 9999) throw new Error("Invalid identifier owner, kind or date.");
  const rows = await store.$queryRaw<{ value: string }[]>`
    SELECT public.allocate_ipsm_identifier(${kind}, ${date.getUTCFullYear()}::integer, ${ownerId}::uuid, ${activation}::uuid) AS value
  `;
  const parsed = parseBusinessIdentifier(rows[0]?.value);
  if (!parsed || parsed.namespace !== "IPSM" || parsed.kind !== kind) throw new Error("Invalid identifier allocation result.");
  return rows[0].value;
}

export function isRetryableTransactionError(error: unknown) {
  const e = error as { code?: string; meta?: { code?: string } };
  return e?.code === "P2034" || ["40001", "40P01"].includes(e?.meta?.code ?? "");
}
export async function retryIdentifierTransaction<T>(work: () => Promise<T>, attempts = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try { return await work(); } catch (error) {
      if (attempt >= attempts || !isRetryableTransactionError(error)) throw error;
    }
  }
}
export function inIdentifierTransaction<T>(client: Prisma.TransactionClient | PrismaClient, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return "$transaction" in client
    ? retryIdentifierTransaction(() => client.$transaction(work, { isolationLevel: "Serializable" }))
    : work(client);
}
