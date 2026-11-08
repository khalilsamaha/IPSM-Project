# PR90 — security remediation and release decision

**NO-GO. Keep draft.** The two mirrored, unapplied reset-integrity migrations now contain the
reviewed security correction. This does not authorize production migration,
permission changes, identifier issuance, reset, merge or deployment.
The [reconciliation matrix](PRODUCTION_RESET_RECONCILIATION.md) and
[administrator summary](evidence/production-reset-2026-11-08-summary.json) distinguish
reported production observations from isolated reproduction.

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
- Query 16 reports three Supabase records with 0/1/1 stored statements and no
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

Only `20261107010000_reset_integrity` and its byte-identical mirror change. They
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

## Teacher guards: preserve-or-change decision

**Recommendation: preserve live behavior pending semantic evidence. Do not approve
replacement based on hashes.** The live function bodies/sanitized rule diff are not
available. The following is analysis of repository SQL, backed by isolated tests,
not a claim about the two different live functions.

| Rule | Reviewed repository behavior | Decision evidence needed |
| --- | --- | --- |
| Availability | Seasonal rows require both dates inside season; course-scoped rows require an active, unarchived course assignment. Assignment level is not checked here. | Body/config/trigger hashes already match; preserve when the other parity objects are verified. |
| Enrollment without teacher | Returns immediately from this guard; other constraints still apply. | Does live permit this historical/unassigned case? |
| Enrollment with teacher | Dates inside season; active/unarchived course assignment at exact level or NULL (all levels); at least one actual weekday occurrence inside the intersection of enrollment and availability dates. Global and seasonal/course-specific availability are supported. | Is live full-period coverage stricter, does it require an occurrence, and how does it handle archived/NULL cases? |
| Schedule with enrollment | Checks teacher, weekday, active/unarchived availability, enrollment's course/season scope, effective dates and inclusive start/end containment. Time comparison uses text (requires normalized HH:MM). | Compare boundary, format, global/season/course scoping and status behavior. |
| Schedule without enrollment | Explicit early return (legacy/import behavior). | Is live stricter? Do not introduce a bypass through parity replacement. |
| Schedule eligibility limits | Does not recheck teacher-course level/active assignment or require its teacher/student to equal enrollment's. Does not itself enforce enrollment date bounds or session season equality; relies on other layers. | Inventory other live checks/app validation and decide whether the live guard supplies any of these protections. |
| Trigger reach | Guard runs on INSERT and listed UPDATE columns, not DELETE. Editing parent availability/assignment does not revalidate existing enrollments/sessions. Balance-only updates do not fire enrollment guard. | Are protections implemented elsewhere? Matching trigger hashes do not establish body equivalence. |

New isolated tests characterize inclusive lesson boundaries, wrong weekday,
effective dates, time overflow, archived availability, global availability,
NULL-enrollment bypass, missing assignment revalidation, occurrence-based enrollment
coverage, exact/all-level assignment, NULL teacher and seasonal availability dates.
Existing tests prove the parity migration refuses an unknown body or changed
trigger. They deliberately do not install a guessed live body.

Two reviewable paths:

1. **Preserve (recommended):** administrator privately supplies a sanitized semantic
   diff/equivalence assessment tied to the recorded live hashes. Reproduce approved
   behavior in isolated staging. Prepare a future validate-and-preserve delta that
   verifies exact approved objects and skips their replacement. Independently verify
   compensation columns/checks, availability FK/index, payroll snapshot columns,
   NULL-level uniqueness and grants; function presence does not waive this work.
2. **Change:** explicitly approve each before/after business rule, provide negative
   and boundary cases for both implementations, check existing records for rejected
   cases read-only, and review an additive replacement migration with recovery plan.
   This is a separate intentional behavior change, not parity cleanup.

The current parity migration deliberately stops at the live schedule hash.
Enrollment is not replaced by it. Do not add live hashes to its exception list
while leaving CREATE OR REPLACE to overwrite them. No choice is implemented here.

## Identifier policy: no reuse claim without a defensible history

The known ledger seed would recover RCPT-2026 through at least sequence 14 and
STU-2026 through at least 5; the next allocator minima are 15 and 6. FAM has no
recovered floor. Empty tables make starting FAM at 1 possible in the current
migration; **this is not safe evidence that 1 was never issued**. Absence of audit
matches cannot establish historical completeness for any kind/year.

Preferred path: privately reconcile receipts, exports, backups and issuance
records for every previously issued kind/year; record a reviewed reservation
manifest (owners where proven, ownerless otherwise), highest issued numbers,
coverage and provenance. Reserve actual known values and disallow new ownership
of legacy codes. A counter floor alone does not stop explicit imports below it.
Do not include individual identifiers or owner data in the public review.

If complete recovery is impossible, recommend a **new, approved issuance namespace**
with a non-overlapping format (a dedicated epoch component, not just a larger number
or new year). Establish that the new format was never historically accepted/issued;
if this cannot be established, keep issuance blocked. Enforce the namespace on all
new creation/import paths at the database layer, retain legacy reservations and
allow legacy ownership only through reviewed historical restoration. Update
allocator/parser/receipt display/export validation and tests together before any
use. The current allocator and regex backfill do not implement this policy.
An arbitrary large starting number or 2027 rollover is not a proof of non-reuse.
This recommendation requires a separate focused PR1 correction/approval; nothing
has been reserved or renumbered in production.

## Canonical migration path and concrete release sequence

Use **Supabase as the sole canonical history/deployment mechanism** for this database.
Keep Prisma for client/schema generation and reviewed mirror checks, not independent
production migration replay. Preserve the actual three versions and their original
contents unchanged. A 0-statement record may have unavailable SQL, manual DDL may be
unrecorded, and two stored statements may contain compound SQL: counts alone cannot
attribute objects. Do not reconstruct or label fictitious historical executions.

| Gate / owner | Required artifact before advancing |
| --- | --- |
| Evidence / administrator | Raw sanitized 10 and 12–16 reports with timestamps, exact default ACLs (17), actual Vercel-runtime and selected migration-connection role names from their existing authorized connections. Dashboard current_user is insufficient. |
| Guards / application owner + DBA | Signed preserve/change rule comparison, full non-guard parity object review and live-compatible isolated tests. Current parity remains blocked. |
| Financial history / financial owner | Acknowledge three preserved absent-record audits; no current financial repair authorized. Recheck payroll aggregates if records change. |
| Identifiers / business owner + DBA | Complete reservation/ownership policy or enforceable proven-disjoint namespace; exercise deleted-history, manual import, concurrent issuance and overflow tests. |
| ACLs / security reviewer + DBA | Correction implemented and isolated tests added. Review final SQL; verify actual creator/runtime ownership and memberships in isolated staging. Post-installation effective permissions remain unverified in production (objects absent). |
| Provenance / release owner | Privately inspect actual stored statements and trusted deployment artifacts; inventory current objects and explicitly document unrecoverable history. Produce a sanitized current-schema snapshot as a reconstruction baseline, **not a migration claimed to have run**. |
| Release packaging / DBA | Isolated release workspace containing only truthful canonical history and the approved future delta. Where old SQL cannot be recovered, resolve the tool's history-matching strategy explicitly before deployment; do not synthesize statements/repair applied rows to make tooling happy. Review the pending list/dry-run and prove it contains only approved new changes. |
| Staging / QA | Build an isolated PG17 database from the reviewed current schema (including guards/default ACLs), replay only the future delta; test rollback, runtime role, permissions, data integrity, identifiers, concurrency/lock load and backup restoration. No production data/credentials needed in CI. |
| Approval / owner | Full CI on the final commit, human review, Preview database isolation, maintenance/backup plan and explicit separate migration/deployment authorization. Keep draft until these are satisfied. |
| Future release / authorized operator | Only after separate approval: pause relevant writers, take/verify backup, apply canonical reviewed delta once, run read-only postchecks, then release compatible application version. Treat partial/failed verification as stop; recover using tested procedure, not ad hoc down SQL. Never include a Production Reset execution in deployment validation. |

For role identity, use the existing authorized runtime-configured connection and
separately the selected migration connection, read-only `SELECT current_user,
session_user`; share only role names/context. Do not retrieve or publish secrets,
create diagnostic endpoints, deploy, or change environment variables for this review.

## Validation scope

The earlier exposure-characterization tests are replaced by regression tests that
require denial. All destructive/role/corruption probes run in the owned disposable
loopback cluster and roll back. The fixture reproduces the real eight-privilege
Supabase defaults and adds PUBLIC/inherited grants to test additional paths.
Migration negative fixtures positively verify rollback on unsafe memberships and
predefined-role access; historical payroll audits remain preserved.

Prisma generation, TypeScript and 405 unit tests passed locally. PostgreSQL 17.6
passed all migration fixtures, 29 Dashboard tests before and after migration,
18 reset integration tests and 33 security/guard tests. The 80 integration tests
are gated out of the ordinary unit run. The production build passed with the
existing ESLint compatibility warning and expected static-read failures against
an unavailable loopback fixture; this is not a clean standalone lint result.
Hosted CI is recorded in the PR and completion report. No production database was accessed for implementation.
No teacher-guard migration, application business logic, dependency version or CI
workflow is changed by this correction. Only the still-unapplied reset-integrity
migration pair changes; historical migrations remain unchanged.
