import type { IdentifierStore, BusinessIdentifierKind } from "@/lib/business-identifiers";
// ONLY for the two pre-namespace foundation suites. Final-schema issuance tests
// run separately after the namespace delta. No production fallback exists.
export async function allocateBusinessIdentifier(store: IdentifierStore, kind: BusinessIdentifierKind, date = new Date()) {
  const rows = await store.$queryRaw<{value:string}[]>`SELECT public.allocate_business_identifier(${kind}, ${date.getUTCFullYear()}::integer) AS value`;
  return rows[0].value;
}
