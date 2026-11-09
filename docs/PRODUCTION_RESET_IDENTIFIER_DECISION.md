# Identifier decision for PR90 — IPSM namespace selected; activation blocked

**Implementation status:** the approved format was deployed and activated under
owner approval on 2026-11-09. See [release evidence](PRODUCTION_RESET_FINAL_DELIVERY.md)
and [recovery operations](IDENTIFIER_RECOVERY_RUNBOOK.md). The decision and its
pre-release conditions below are preserved as historical context.


**Business-format decision (2026-11-08):** The owner selected the unversioned `IPSM`
namespace for new FAM/STU/RCPT identifiers, rather than versioned `IPSM1` or `IPSM2`.
This approves the display grammar and preparation of draft-PR implementation;
it does **not** establish historical non-use or authorize production activation.
Keep production NO-GO until historical non-overlap is certified (including manual
and external issuance), the implementation and restoration policy pass review,
and a separate migration/deployment approval is given.

## Research and limits

The verified baseline's `lib/families.ts` and `lib/students.ts` derived sequential
codes from surviving rows (year prefix and descending text maximum). Historical
receipt helpers similarly selected current-year maxima. Relevant introductions:
`4c1b467` (family/student workflow), `fb617151` (payments/receipts), `d27e62e`
(receipt repair), `5a24180` (family safety). Current PR90 delegates FAM/STU/RCPT
allocation to PostgreSQL and retains committed reservations across resets.

The historical `prisma/seed.ts` assigned legacy-format synthetic FAM/STU/RCPT
values; seed code is not proof those numbers were issued in production. The current
seed uses certified allocation and preserves existing identifiers on rerun. No trusted IPSM
issuance export, backup or historical import manifest was found in the known
private evidence/download locations. Unrelated backups were excluded. The two
IPSM schema-export files contain metadata only and cannot recover missing codes.

Student/family codes and receipt numbers are TEXT in the repository schema.
Explicit database writes historically could accept nonstandard strings. Therefore
proving disjointness against the repository generator regex alone is insufficient.
Payments use UUID primary IDs and share RCPT business numbering with receipts;
there is no separate sequential PAY namespace to introduce.

Known production facts: current four source tables empty; recoverable 2026 RCPT
at least 14, STU at least 5; FAM unknown. The migration's audit regex recovers only
legacy-shaped codes. These are minimums, not complete issuance or safe restart floors.

## Two complete paths

| Requirement | Historical reservations | Proposed epoch namespace |
| --- | --- | --- |
| Proof | Business/financial owner certifies complete issuer/import/year coverage and a private exact-value reservation manifest, including voids/deleted/nonstandard codes. | Owner certifies proposed grammar/epoch was never accepted or issued by any historical channel, including manual imports and external documents. Show old accepted language L and new N have empty intersection; resolve arbitrary-text exceptions privately. |
| User-visible contract | Keep KIND-YYYY-number. | Selected future grammar (not activated): `^(FAM|STU|RCPT)-IPSM-[0-9]{4}-[0-9]{6,19}$`, canonical positive decimal serial padded to at least six digits. The `IPSM` format is **approved for future use**, but is not claimed historically unused. Year is UTC issuance year. |
| Recovery work | Reconcile exact codes and owners where proven; historical-only reservations otherwise. Reserve every issued value, advance counters, reject ambiguous ownership. | Retain all recoverable old reservations; never renumber old documents. Block ordinary new rows/imports in legacy grammar; allow restoration only via a separately reviewed procedure tied to evidence. |
| Failure to prove | Do not allocate from guessed floors. | Do not substitute random prefix/high number/new year as proof. If proposed epoch cannot be certified, both paths remain NO-GO. |

The separate namespace is maintainable because it separates future issuance from
unrecoverable old numeric maxima. It does not remove the need to establish that
namespace's historical non-use. Approval must also cover receipt/export display
changes and the recovery policy below. The approved format is now implemented in the third unapplied migration and
application paths. [Implementation and recovery details](PRODUCTION_RESET_IDENTIFIER_IMPLEMENTATION.md)
record enforcement and operational limits. Production activation remains blocked.

## Approved implementation contract

1. **Allocator and limits.** Add an immutable approved epoch configuration and
   database allocation keyed by `(kind, epoch, UTC year)`. Use BIGINT counters,
   checked year/kind/epoch, atomic increment and explicit exhaustion at
   9223372036854775807. Format serials as decimal strings; never round through a
   JavaScript Number. No timestamp/random fallback on conflict or exhaustion.
2. **Issuance ledger.** Preserve durable exact `(kind,value)` uniqueness and owner
   binding. Store epoch/year/serial as validated metadata, with unique tuple keys
   for new-format entries. Allocate/reserve/bind to a predetermined owner UUID in
   the same transaction as creating the business record; prevent owner changes or
   deletion by ordinary runtime/import paths. No broad client grants, SECURITY
   DEFINER bypass or reset-ledger deletion. Privileged DBAs remain trusted operators.
3. **Transaction boundary.** Rollback may release an unpublished allocation, but
   never print/send/export its code before commit. Commit delivery through an
   idempotent after-commit/outbox path if needed. If the business requires numbers
   never to be recycled even before commit, that is a separate nontransactional
   sequence/journal requirement; decide before implementation. Gaps are acceptable;
   issuance must not claim gaplessness.
4. **Legacy and restoration.** Preserve existing values verbatim, with verified
   owner or historical-only reservations. Ownerless historical values cannot be
   claimed by arbitrary new rows. Restoration requires original owner evidence,
   a reviewed import manifest and durable audit; no generic bypass flag in a normal
   form, API or session setting. Do not reconstruct financial postings or receipt
   ownership from a code alone.
5. **Explicit assignment/import.** New creation normally cannot supply arbitrary
   codes. Enforce grammar, kind, epoch and reservation ownership at the database
   boundary for every insert/update/import, including cancelled/archived records.
   Approved external assignments must go through the same allocator/ledger and
   update high-water state safely. A matching prefix is not import authorization.
6. **Receipt semantics.** Receipt and payment share one RCPT reservation owned by
   the payment UUID; a second payment cannot reuse it. Void/reprint retains the
   same original code. Repair creates a code only for an unnumbered authorized
   payment through the new allocator. No renumbering or invented old receipts.
7. **Application map.** Update `lib/business-identifiers.ts`, the SQL allocator/
   retention triggers, `lib/payments/receipt-number.ts` legacy/new parser,
   `receipt-repair.ts`, and `receipt-service.ts`'s embedded `RCPT-(year)-` extraction.
   Reports/CSV, searches, family/student labels and receipt V1/V2 display preserve
   full raw strings; test wrapping/layout and sorting explicitly. Keep legacy
   read paths working, but remove legacy allocation/repair fallbacks from write
   paths. Update explicit seed/import fixtures without treating them as history.
8. **Concurrency.** Row-level counter serialization plus unique ledger constraints;
   bounded retries for serialization/deadlock failures at the whole transaction
   boundary. Replayed requests return their committed result via idempotency keys.
   Receipt and registration retries must not create extra postings or owners.
9. **Reset persistence.** Protect epoch configuration, counters, reservations and
   restoration audit from all six reset scopes. Reject namespace rollback or code
   mutation; a newly deployed older allocator must not resume old-format issuance.
10. **Backup/recovery.** A database restore can lose codes issued after its recovery
    point. Before reopening writes, reconcile an independently retained issuance
    journal/document set since that point and reserve those values. If impossible,
    remain closed or obtain approval and non-overlap proof for a further epoch.
    A successful pg_restore alone never establishes non-reuse of post-backup codes.

## Required acceptance tests for the approved implementation

- Old/new grammar separation; exact kind/epoch/year; noncanonical padding,
  negative/zero/overflow values; legacy read-only display and unknown format handling.
- Deleted-owner and ownerless reservations; manual imports; duplicate codes across
  payments/receipts; original-owner restoration; ambiguous restoration blocked.
- Concurrent allocations, transaction rollback, retry idempotency, delivery only
  after commit; overflow fails without counter wrap or fallback.
- Every reset scope preserves ledgers/epoch; archived/voided history remains reserved;
  rollback to an older application cannot issue legacy codes.
- Auth/client/PUBLIC/inherited-role denial for all ledger mutation routes; trigger
  enforcement for direct SQL/import paths; no session-variable bypass.
- Backup/restore retains ledger and permission state; missing post-backup issuance
  journal blocks reopening; externally delivered codes cannot be issued again.
- Receipt/PDF/CSV/filters/search mixed old/new values; duplicate repair and partial
  registration retries; timezone/year boundary and maximum-length formatting.

The implementation now exercises this contract in unit and disposable PostgreSQL
suites, including BIGINT bounds, imports/restoration, permissions, replay, reset
persistence, external-journal recovery and server restart holds. These synthetic
tests do not certify unknown production issuance or actual runtime identity.

## Remaining certification (format approval is complete)

The selected unversioned IPSM grammar needs **no repeated format approval**.
The administrator/business owner must certify historical non-use across manual,
external and import channels, provide private manifest hashes/coverage and approve
the recovery admission record. If proof is unavailable, keep activation absent or
held; do not substitute a guessed prefix/floor. Runtime/migration identity,
canonical history, Preview/Auth isolation, financial acknowledgement and production
release authorization remain separate gates. No production activation is authorized.
