# Approved IPSM identifiers — deployed; recovery remains administrator-controlled

The approved unversioned FAM/STU/RCPT-IPSM-YYYY-serial format is live at
`c5de2a062db5f38e15f09aeb51cc1b5d9af2075d`. All three reviewed migrations applied
on 2026-11-09, and the owner-approved activation and matching Production-only
Vercel setting were verified. [Completed release evidence](PRODUCTION_RESET_FINAL_DELIVERY.md)
records scope and validation; no historical evidence is rewritten here.

Use the [operational recovery runbook and read-only health command](IDENTIFIER_RECOVERY_RUNBOOK.md)
for routine monitoring and restart/recovery. This maintenance documentation does
not authorize another attestation, restore, deployment or configuration change.

## Allocation and persistence

- Canonical positive decimal serial padded to at least six digits; range
  1..9223372036854775807. UTC year is 2000..9999. SQL BIGINT and JavaScript BigInt
  avoid Number rounding. PostgreSQL counter keys encode `(kind,IPSM,year)`;
  durable ledger metadata additionally has a unique `(kind,namespace,year,serial)`
  index. Exhaustion raises an error; no timestamp/random/numeric fallback.
- The allocator receives a predetermined record UUID and activation UUID.
  Immutable `(kind,owner_id)` allocation records make retries return the same
  reservation. Receipt/payment share RCPT ownership through the payment UUID.
- Family/student helpers open one serializable transaction when passed the root
  client, or join the caller's transaction. Allocation, binding and record creation
  commit together. Payment and registration transactions have bounded whole-
  transaction conflict retries. Values are returned to actions only after commit;
  receipt/PDF delivery remains after commit. No new external delivery channel exists.
- Payment forms carry a request UUID. A replay uses the original payment UUID and
  an actor/payload fingerprint in the protected payment audit, returning the committed
  result without a second posting. Changed payload/actor rejects. After a reset,
  the retained allocation prevents recreating a deleted payment via that request.
- `business_identifier_counters` is widened to BIGINT. Issued rows, allocations,
  import manifests and activations are immutable; ordinary direct INSERT into the
  ledger/counters and UPDATE/DELETE/TRUNCATE are rejected. Counter advancement is
  confined to allocation/import triggers. Existing generation barriers remain.
- All fourteen reset scopes preserve all identifier history. Counter/issued-ledger
  changes affect the existing reset fingerprint; new history tables are never in
  deletion plans. Their writes also run the fail-closed generation guard.
- The old two-argument allocator now raises. Older application code cannot resume
  legacy issuance. Existing code values remain unchanged and readable.

## Certification and fail-closed activation

The server must explicitly select `IPSM_IDENTIFIER_ACTIVATION_ID` (UUID) **and**
PostgreSQL must find that exact, latest, enabled attestation. The table is empty
on installation. Each administrator attestation contains private evidence SHA-256
references for historical non-use and recovery completeness, an approver reference,
and an audit entry. Known pre-activation IPSM strings in reserved legacy values
or audit metadata block activation and appear only as aggregate postcheck counts.
Before the first enabled attestation every matching audit event is reviewed,
regardless of its timestamp. Subsequent checks interpret Prisma’s timestamp-without-
time-zone audit columns explicitly as UTC; a non-UTC server session cannot misclassify
new postings as historical. Their absence is not proof about deleted/external history. A valid-looking hash is not proof: the administrator must review
and certify the underlying evidence before creating an enabled record.

The trigger binds each attestation to the current database OID and PostgreSQL
postmaster start time. A fresh restored database or restarted/failover server
invalidates it. After a restart, writes needing a new identifier stay blocked until
recovery is reviewed, a new attestation is inserted and the selected deployment ID
is updated through an authorized configuration change. This deliberate availability
trade-off requires release-owner acceptance; do not weaken it to avoid a hold.

Attestations are append-only. `enabled` defaults **false**. Inserting a newer
**disabled** attestation holds new issuance and invalidates earlier IDs without
editing history. An enabled replacement requires the two reviewed evidence hashes.
Monotonic attestation timestamps and an advisory lock order competing operator
changes. Existing in-flight writes must be drained during activation/hold changes;
this is not a substitute for a maintenance admission barrier.

The ID is a deployment binding, not a public client capability. No API/action
creates attestations or imports. All new objects are owner-only, RLS-enabled with
no permissive policies, SECURITY INVOKER/empty-search-path functions. The same
object-scoped ACL sweep and effective membership checks cover all eight PG17
privileges and EXECUTE, including service_role despite BYPASSRLS.

The Production runtime and migration profiles were verified as effective/login
`postgres` during release. This is dated evidence, not a perpetual identity guarantee. A database
owner can intentionally alter objects or submit a dishonest attestation; SQL cannot
constrain that trusted administrator. If the runtime is the owner, approved operator
procedures and trusted server code distinguish operations; there is no claim of
DB-role separation. A distinct runtime role needs a separately reviewed minimal
entitlement model. No speculative grants or SECURITY DEFINER bypass were added.

## Imports, legacy compatibility and restoration

Normal creation cannot select a manual code. Even the original owner cannot
recreate a deleted record merely by replaying a committed allocation: creation
requires an allocation or reviewed restoration grant in the **same transaction**.
The stored transaction ID is generated by the trigger, not accepted from a caller.

The private `business_identifier_imports` manifest path is for an authorized DBA:

- `reservation`: reserve a known legacy code, with original owner when proven or
  NULL when unknown. Unknown ownership never authorizes a new business record.
- `restoration`: exact code + original owner UUID + reviewed manifest hash and
  approver. Insert the grant and restore the record in one transaction. The first
  proven owner binding of an ownerless reservation is retained in append-only
  history; subsequent conflicting owners are rejected. This does not reconstruct
  financial transactions from an identifier alone.
- `recovery`: reserve independently journaled post-backup IPSM values and advance
  the appropriate BIGINT high-water mark before activation. This does not create
  business/financial records. Restoration of such records requires a separate
  exact-owner restoration grant. Unknown/noncanonical/wrong-kind new-format values
  reject; conflicts cannot silently reassign ownership.

No generic form flag, SQL session setting, import endpoint or application grant
bypasses this path. The DBA must validate the private manifest; fake hashes do not
become authentic evidence. Import audit entries contain references, not copied
financial audit payloads. The three historical payroll audits remain untouched.

Receipt reprint/void/repair uses the same number and owner. An existing historical
receipt/payment can be relinked without activating new issuance. Legacy arbitrary
text is preserved for display; parsers recognize valid old and new forms only.
The old surviving-max receipt generators were removed. PDF headers fit the longest
new serial; receipt year comes from the dual-format parser. Search, labels and CSV
continue passing full raw identifiers. Shift receipt bounds use numeric BIGINT-aware
ordering across the legacy/new formats rather than lexical serial ordering. Seed allocation now follows the same
transaction/certification rules and preserves existing codes on rerun; no synthetic
certificate is installed by seed.

## Recovery protocol and limits

1. Hold issuance, stop writers and clear the selected activation in the affected
   non-production/production environment only with separate authorization.
2. Restore to a **fresh database or fresh server instance**. In-place logical
   replacement inside the same live database/postmaster is unsupported: catalogs
   cannot reliably distinguish it from normal administrator writes. Do not reuse
   an active deployment binding across such a restore.
3. Compare restored schema, permissions, reservations/counters and protected data.
   Privately reconcile an independent issuance journal, exports or delivered
   documents after the recovery point. pg_dump alone cannot recover those values.
4. Import every proven post-backup issuance with manifest evidence. If completeness
   or historical namespace non-use is unproven, leave issuance blocked. Do not pick
   a larger floor or fabricate a namespace/history to reopen service.
5. Record a new enabled attestation and select its ID only after review. Validate
   ordinary approved writes under the actual backend role; never use a production
   reset as a recovery smoke test.

The automated test restores a pre-issuance backup, proves its old activation fails,
imports a synthetic external journal, recertifies, and allocates above that journal.
It also restarts the owned PG17 server and verifies a new attestation is necessary.
These prove mechanics, not completeness of the unknown production history.

## Migration/release prerequisites

Canonical order: teacher parity → reset integrity → IPSM identifiers. Apply one
mechanism (Supabase), never both mirrors. The third delta is transactional and
rejects repeat application. Partial application of separate files is not a
single all-or-nothing release; keep admission closed until all postchecks pass.

The foundation migration still fails closed if newly discovered legacy backfill
values exceed its historical INTEGER range. Current reported maxima 14/5 do not
trigger this. Review any changed source history before applying the package;
never silently truncate out-of-range historical values to make migration succeed.

The initial release prerequisites were closed under explicit owner approval; the
three deltas are already applied. Do not replay them for a restart. Future recovery
requires its own evidence review and approval using the runbook above. Existing
fail-closed bindings, immutable history and restoration restrictions remain intact.
