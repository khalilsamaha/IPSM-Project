import type { Prisma } from "@prisma/client";

export type IdentifierStore = Pick<Prisma.TransactionClient, "$queryRaw">;
export type BusinessIdentifierKind = "STU" | "FAM" | "RCPT";

/** The database retains issued identifiers and counters across every reset. */
export async function allocateBusinessIdentifier(
  store: IdentifierStore,
  kind: BusinessIdentifierKind,
  date = new Date(),
) {
  const rows = await store.$queryRaw<{ value: string }[]>`
    SELECT public.allocate_business_identifier(${kind}, ${date.getUTCFullYear()}::integer) AS value
  `;
  return rows[0].value;
}
