# PR90 — security remediation and release decision

**NO-GO. Keep draft.** The two mirrored, unapplied reset-integrity migrations now contain the
reviewed security correction. This does not authorize production migration,
permission changes, identifier issuance, reset, merge or deployment.
The [reconciliation matrix](PRODUCTION_RESET_RECONCILIATION.md) and
[administrator summary](evidence/production-reset-2026-11-08-summary.json) distinguish
reported production observations from isolated reproduction.

## Approved identifier implementation follow-up

The selected unversioned IPSM format is implemented in a third additive mirrored
migration and application paths. See [the implementation/security/recovery review](PRODUCTION_RESET_IDENTIFIER_IMPLEMENTATION.md).
The two foundation migration pairs, teacher guards and historical migrations remain
unchanged. The new objects use the same owner-only effective-ACL enforcement; all
functions remain SECURITY INVOKER. BIGINT counters, immutable reservations,
transactional creation, exact-owner restoration/import, payment replay and legacy
compatibility are covered by the final-schema suite.

Activation is absent by default and requires a separately selected latest enabled
attestation, historical non-use/recovery evidence and a matching database/server
lifetime. Restores/restarts fail closed until recertified. This is an explicit
availability trade-off; read the release runbook before approval. Actual owner/runtime
role identity remains unverified. No test certificate or environment setting is
installed in production.

The older foundation-test counts below are historical. Current validation results
are recorded in the identifier implementation evidence and the final draft PR CI
report. The [current gate ledger](PRODUCTION_RESET_REMAINING_GATES.md) supersedes
older identifier-format approval/implementation requests: format approval is complete;
non-use certification and production activation are not.

## Prior foundation consolidation (before identifier implementation)

The [final gate ledger](PRODUCTION_RESET_REMAINING_GATES.md) and
[release/recovery runbook](PRODUCTION_RESET_RELEASE_RUNBOOK.md) replace requests
for repeated diagnostics. Administrator Queries18/19 are complete: 14/14 schema
MATCH, four metadata REVIEW_REQUIRED, zero blockers, PG17.6. Teacher schema and
existing guard attributes/configuration/triggers/ownership/ACL review is closed
for that snapshot. Candidate postgres execution is confirmed; actual Vercel and
intended migration connection identities are not.

New independent work: metadata-only Vercel scope inspection confirms shared
Production/Preview DB/Auth configuration; repository migration-lineage research;
complete proposed identifier contract; truthful future-delta package/verifier;
synthetic release/load/backup/restore rehearsal; financial-owner acknowledgement
and production runbook. That earlier consolidation left application behavior and
the two foundation migration pairs unchanged. The current follow-up implements
the selected IPSM grammar in a third delta; historical non-use proof remains pending.

## What the new evidence resolves

- Query 10 completed 42/42 items, no explicit blockers, for supplied roles
  `postgres` / `postgres`. Both exist; required schema access, DML on 25 tables,
  BYPASSRLS and existing teacher-function execution were reported. This is a
  **candidate-role permission check**, not evidence that Vercel actually uses
  that role, nor a future-object permission check. Query 10 emits REVIEW_REQUIRED
  for privilege values: no explicit blocker is not itself a security certificate.
- Queries 12–13 confirm the 45 reviewed FKs, 22 accepted update variants, matching
  availability body and differing schedule/enrollment bodies. No new FK fix needed.
- Query 14 reports three historical payroll audit events referencing absent
  records, with zero current payroll / teacher-payroll expense rows. There is no
  reported current financial posting to repair or backfill. Preserve audits and
  obtain the financial owner's acknowledgement of unresolved historical provenance;
  do not invent postings or delete evidence. Recheck if financial data changes.
- Query 15 confirms families, students, payments and receipts are empty. This
  resolves population uncertainty, **not historical issuance uncertainty**.
- Query 16 administrator evidence maps the three Supabase versions to 0/1/1 stored statements and reports no
  Prisma ledger. These do not reconstruct the schema's full creation history.

## Query 17 evidence and implemented security model

The [administrator's Query 17 summary](evidence/production-reset-query17-summary.json)
reports 84/84 items, READ ONLY / REPEATABLE READ, REVIEW_REQUIRED. Actual
`postgres` public-schema TABLE defaults grant SELECT, INSERT, UPDATE, DELETE,
TRUNCATE, REFERENCES, TRIGGER and MAINTAIN to anon, authenticated and service_role.
The first two do not bypass RLS; service_role does. All five proposed tables and
four functions are absent. This establishes **real creator-default exposure**, not
post-installation effective permissions and not Vercel runtime identity. Exact
function defaults, full role graph, raw report and timestamp were not supplied.
The correction removes any non-owner default-function grants as well.

The unchanged `20261107010000_reset_integrity` pair provides the security correction. They
create five tables: `production_reset_requests`, `production_reset_state`,
`reset_registration_submissions`, `business_identifier_counters` and
`issued_business_identifiers`. All remain RLS-enabled with no policies.

| Boundary | Implemented behavior |
| --- | --- |
| PUBLIC, anon, authenticated, service_role | Explicit ALL revocation on all five tables and four functions in the creation transaction. ALL includes PostgreSQL 17 MAINTAIN. BYPASSRLS is not a grant of table privileges. |
| Additional/default/inherited grantees | Enumerate actual new-object ACLs and revoke every non-owner grant, with dependent grants removed on those objects only. This includes custom intermediary roles and PUBLIC. No global defaults or role memberships are changed. |
| Effective permissions | Before COMMIT, check all table privileges (including MAINTAIN on PG17), column privileges and function EXECUTE for each client and every membership-reachable role. NOINHERIT paths are included conservatively because SET ROLE may be possible. |
| Ownership / predefined-role powers | Reject clients that are superusers or can assume the creating owner. Abort if effective access remains via e.g. pg_read_all_data; revokes must not pretend to remove such global powers. Do not rewrite memberships to force deployment. |
| Authorized backend | Owner access is retained; no speculative runtime grant is added. The actual Vercel role must be verified and its effective access approved before deployment. If it is a distinct role needing grants/policies, stop and design/test a separate explicit entitlement; do not substitute service_role. |
| Function execution | All four functions stay SECURITY INVOKER with empty search_path. No SECURITY DEFINER, new elevated owner, client RPC capability or permissive RLS policy is introduced. |
| Unrelated objects | Global/schema default ACLs and unrelated table privileges remain unchanged; isolated fixtures assert this and mirror equality. Existing migration history is untouched. |

The application still enforces active SUPER_ADMIN server-side for preview and
execution. Database ownership is not an application role or a replacement for
that check. Database administrators/owners can intentionally alter their objects;
this model does not claim to constrain a malicious administrator or an existing
privileged RPC capable of doing so. Audit existing elevated RPCs and verified
runtime/migration ownership during release review.

PostgreSQL documents [RLS's TRUNCATE/REFERENCES exclusions and bypass rules](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)
and [creator-specific defaults, including MAINTAIN](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).
The migration targets actual new-object ACLs, covering global and schema defaults
without modifying either. No production permissions were changed during testing.

## Fail-closed generation guard

`guard_reset_generation()` remains SECURITY INVOKER. Its function-local
`row_security=off` makes policy-filtered reads **error**, not bypass RLS. It reads
all state rows with `INTO STRICT ... FOR SHARE`, requires exactly one `school`
row and a non-NULL timestamp, and rejects a generation at/after the writer's
transaction start. Missing/multiple/invalid state raises SQLSTATE 55000;
permission/RLS denial propagates 42501; stale generation or concurrent snapshot
conflict raises 40001. Errors are never converted into authorization to write.

The state table has a singleton-ID CHECK, NOT NULL timestamp and rejection of
positive infinity. Negative infinity remains the intentional initial generation.
The function independently checks shape so a missing row or corrupted constraint
cannot silently disable it. An owner can still intentionally tamper with the
ledger; that is outside the untrusted-client boundary.

FOR SHARE retains its row lock until the writer transaction ends. A generation
update waits for existing writers; a REPEATABLE READ writer cannot lock a row
updated since its snapshot. Reset's existing ordered table locks, SERIALIZABLE
transaction, actor-bound stale-preview checks and transactional audit remain
unchanged. No client is granted visibility into the state table to make a trigger
succeed. A client with unrelated domain write access but no authorized state access
now fails closed; confirm legitimate application writers use the verified backend.

Tests cover direct/ PUBLIC / inherited / NOINHERIT / BYPASSRLS access, actual denied
CRUD/TRUNCATE/REFERENCES/TRIGGER/REINDEX operations, all eight effective permissions
on PG17, all four function permissions, ordinary registration/payment/scheduling/
payroll writes as a non-superuser owner, missing/inaccessible/invisible/corrupted
state, row-lock blocking, concurrent snapshot rejection and the existing reset
concurrency suite. The old successful exposure probes are now denial regressions.

[Query 17](sql/production-reset-dashboard/17_reset_client_permissions.sql) is updated
to report MAINTAIN and flag any client/service-role table or function grant after
installation. It remains strictly read-only. Missing future objects cannot certify
protection; use it on an approved isolated staging copy with the actual creator and
role graph before release. It supplements the transactional migration assertions,
not the still-missing runtime identity check.

## Teacher guards: verified preserve decision

**Preserve the exact approved live bodies.** Both reported differences now reproduce
exactly: 59 LF→CRLF conversions for enrollment; removal of only the 109-byte two-line
comment for schedule. Availability is unchanged. PostgreSQL 17 confirms the reported
prosrc hashes and identical outcomes across 43 differential behavior cases.

The [equivalence and non-function DDL review](PRODUCTION_RESET_GUARD_EQUIVALENCE.md)
records precise hashes, transformations, tests and limitations. The unapplied parity
pair accepts exact canonical/live strings with strict function/configuration/owner
and trigger assertions, then leaves existing definitions and ACLs untouched. It
never normalizes incoming arbitrary source to force a match. Unknown variants,
attributes, triggers and schema definitions still fail closed.

The historical enrollment function must exist; it is neither fabricated nor replaced.
The older-schema path may create both-absent availability/schedule pairs using their
original canonical definitions. IPSM reports all three present, so its intended path
is preservation. Previously implemented reset security migrations remain unchanged.

Administrator Query18/19 now completes the scoped non-function and metadata
review alongside Query02. The release rehearsal tests the exact approved delta
against synthetic reconstruction. These scoped findings are not a full production
history/runtime-role certificate or deployment authorization.

No business rules change: NULL teacher/enrollment behavior, occurrence-based
registration eligibility, archived handling and time windows remain as before.
Schedule still relies on other layers for assignment/level revalidation and
enrollment-date limits; this task does not introduce unrelated rule hardening.

## Historical identifier rationale (now implemented as inactive IPSM)

The known ledger seed would recover RCPT-2026 through at least sequence 14 and
STU-2026 through at least 5; the next allocator minima are 15 and 6. FAM has no
recovered floor. Empty tables make starting FAM at 1 possible in the current
migration; **this is not safe evidence that 1 was never issued**. Absence of audit
matches cannot establish historical completeness for any kind/year.

If complete historical sources can be certified, privately reconcile receipts,
exports, backups and issuance records for every previously issued kind/year; record a reviewed reservation
manifest (owners where proven, ownerless otherwise), highest issued numbers,
coverage and provenance. Reserve actual known values and disallow new ownership
of legacy codes. A counter floor alone does not stop explicit imports below it.
Do not include individual identifiers or owner data in the public review.

No complete source was found in available evidence. Recommend the
[selected IPSM namespace contract](PRODUCTION_RESET_IDENTIFIER_DECISION.md), subject
to historical non-use proof and approved recovery semantics. If complete recovery is impossible, use a
**new, approved issuance namespace**
with a non-overlapping format (a dedicated epoch component, not just a larger number
or new year). Establish that the new format was never historically accepted/issued;
if this cannot be established, keep issuance blocked. Enforce the namespace on all
new creation/import paths at the database layer, retain legacy reservations and
allow legacy ownership only through reviewed historical restoration. Update
allocator/parser/receipt display/export validation and tests together before any
use. The third identifier delta now implements the approved policy and blocks activation
until certification; the two foundation migrations alone do not.
An arbitrary large starting number or 2027 rollover is not a proof of non-reuse.
The focused PR1 implementation is now prepared; nothing has been activated,
reserved or renumbered in production.

## Canonical migration path and concrete release sequence

Use **Supabase as the sole canonical history/deployment mechanism** for this database.
Keep Prisma for client/schema generation and reviewed mirror checks, not independent
production migration replay. Preserve the actual three versions and their original
contents unchanged. The confirmed empty array does not explain bootstrap DDL.
Both nonempty statement bodies are now supplied and fingerprint-mapped. The
canonical workspace preserves the exact recorded arrays without claiming complete
original deployment provenance. Do not reconstruct or label fictitious historical executions.

| Gate / owner | Required artifact before advancing |
| --- | --- |
| Evidence / administrator | Queries02/18/19 are reconciled; no repeat requested. Confirm actual runtime/migration roles and memberships. Refresh target history/checksums immediately before an authorized release; known SQL bodies need not be supplied again. |
| Guards / application owner + DBA | Body, schema and metadata preservation checks are closed for the reported snapshot; no repeat needed. Keep strict assertions. Synthetic delta rehearsal preserves guard catalog entries. |
| Financial history / financial owner | Acknowledge three preserved absent-record audits; no current financial repair authorized. Recheck payroll aggregates if records change. |
| Identifiers / business owner + DBA | Approved IPSM implementation/tests are prepared; certify historical non-use and complete recovery before activation. No repeated format decision is needed. |
| ACLs / security reviewer + DBA | Correction implemented and isolated tests added. Review final SQL; verify actual creator/runtime ownership and memberships in isolated staging. Post-installation effective permissions remain unverified in production (objects absent). |
| Provenance / release owner | Accept the documented existing-database-only release boundary: preserve the empty transcript without claiming bootstrap execution. If complete original lineage is mandatory, recover original artifacts/operator evidence; no history repair or synthetic application claims. |
| Release packaging / DBA | Canonical six-file workspace and real CLI2.78.1 isolated rehearsal are prepared. Verify fresh target version/content equality and exactly three pending future deltas; local tests are not current production certification. |
| Staging / QA | Synthetic PG17 delta/role/load/restore rehearsal implemented. Remaining acceptance is actual intended role/membership and representative workload/platform recovery, plus separately isolated Preview/Auth. No production data/credentials in CI. |
| Approval / owner | Full CI on the final commit, human review, Preview database isolation, maintenance/backup plan and explicit separate migration/deployment authorization. Keep draft until these are satisfied. |
| Future release / authorized operator | Only after separate approval: pause relevant writers, take/verify backup, apply canonical reviewed delta once, run read-only postchecks, then release compatible application version. Treat partial/failed verification as stop; recover using tested procedure, not ad hoc down SQL. Never include a Production Reset execution in deployment validation. |

For role identity, use the existing authorized runtime-configured connection and
separately the selected migration connection, read-only `SELECT current_user,
session_user`; share only role names/context. Do not retrieve or publish secrets,
create diagnostic endpoints, deploy, or change environment variables for this review.

## Prior foundation validation scope

The consolidated follow-up passed Prisma generation, TypeScript and **414 unit
tests** locally. The **169 database tests** are gated out of the unit run and
executed by the disposable runner: **40 Dashboard checks before and after the
migration**, **18 reset integration tests**, **33 security regressions**, **70
teacher-parity tests**, and **8 new release/recovery tests**. Historical migration
fixtures, preflight synthetic-secret redaction and byte-identical mirror checks
also pass. Local PostgreSQL is **17.6**; see the
[recorded rehearsal evidence](evidence/production-reset-release-rehearsal.json)
for commands, package hashes, timings and synthetic-only limitations.

The new release tests reconstruct reported live FK/guard/default-ACL behavior,
apply only the checked future delta under a non-superuser owner, preserve guard
catalog entries, reject repeated migration, roll back an injected mid-migration
failure and lock timeout, exercise all six scopes, protect users/audit/Auth mock
records, and restore pre/post backups with matching logical data/schema/permissions.
They prove mechanics for synthetic records, not unknown production history or roles.

The production build passed with the existing ESLint compatibility warning and
expected static reads against an unavailable loopback fixture; this is not a clean
standalone lint result. Build subprocesses used explicit loopback-only DB/Supabase
settings. Next's generated lockfile patch was discarded; no dependency change is
part of this review. Hosted CI and its actual job logs for the final commit are
recorded in the draft PR and final completion report, separate from local results.

Those foundation results preceded the current identifier implementation. The two
foundation migration pairs, historical migrations, dependencies and CI workflow
remain unchanged. The current follow-up adds the third identifier delta, application
paths and final-schema tests described above. No production functions,
permissions, data, environment configuration or history were modified. PR90 remains
draft; PR2 is unimplemented.

Current identifier validation: [machine-readable evidence](evidence/production-reset-ipsm-identifiers.json)
records 425 unit tests and 200 disposable PostgreSQL tests (including 31 identifier
tests), Prisma generation, TypeScript and production build. Hosted CI is recorded
on the draft PR for the published commit. Local PostgreSQL is 17.6; synthetic
certificates and roles do not close the production evidence gates.

## Canonical recorded-history release workspace

The administrator-supplied three history records are now package inputs; the two
completed SQL fingerprint comparisons were not reopened. CLI2.78.1's native fetch
serialization represents the zero-statement entry as `;\n`, without attributing
bootstrap DDL or an original execution to it. See the
[canonical workspace review](PRODUCTION_RESET_CANONICAL_WORKSPACE.md) for the exact
six-file package, checksum validation, isolated real-CLI rehearsal and limits.
No history repair or production access is needed to prepare this artifact.
Production remains NO-GO pending fresh target verification, acceptance of the
existing-database-only provenance boundary and the other release gates.
