# PR90 — November 8 security review and release decision

**NO-GO. Keep draft.** This is a review and isolated test change, not permission to
apply migrations, modify privileges, issue identifiers, reset, merge or deploy.
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

## Security review: proposed infrastructure

The integrity migration creates five tables: `production_reset_requests`
(actor-bound preview/result), `production_reset_state` (concurrency generation),
`reset_registration_submissions` (replay tombstones),
`business_identifier_counters` and `issued_business_identifiers` (non-reuse).
All enable RLS, none forces RLS, and none has a policy. The four new functions
are SECURITY INVOKER with an empty search_path and schema-qualified references.
Execution is revoked from PUBLIC, anon and authenticated. **There is no explicit
table ACL revocation.** No sequence is created; counters use an integer column.

| Access path | Effective behavior / conclusion |
| --- | --- |
| anon/authenticated, ordinary row operations, no elevated memberships | With broad table grants, policy-free RLS hides rows; INSERT fails, UPDATE/DELETE cannot target hidden rows. Allocator EXECUTE is explicitly revoked. Isolated tests verify these properties. |
| anon/authenticated, TRUNCATE | RLS does not apply. If creator defaults include TRUNCATE (e.g. ALL), the migration retains it. Isolated tests successfully truncate all five new tables as each client role, then roll back. **Blocking exposure**, not an approved behavior. |
| REFERENCES / TRIGGER | RLS does not govern REFERENCES; broad defaults also leave trigger-creation rights. Exploitability depends on further privileges/functions; remove unnecessary effective grants in an explicitly reviewed correction. |
| owner / superuser / BYPASSRLS | Owner bypasses RLS unless FORCE applies; superuser/BYPASSRLS still bypass FORCE. The supplied postgres role has BYPASSRLS. Server-side active SUPER_ADMIN checks remain essential and are not database policies. |
| service_role / inherited privileged roles | Function revocation names do not remove another role's grants or inherited rights. A service role with default grants and BYPASSRLS can read/write these tables and call the allocator. The fixture reproduces this with a synthetic BYPASSRLS role; actual service_role grants/membership remain unverified. |
| Browser/PostgREST | No normal table REST TRUNCATE endpoint is established by this review. SQL privilege exposure does not prove a browser exploit. Privileged RPCs, exposed schemas, views, inherited roles and other SQL bridges still need review; no service credential may reach clients. |
| Generation guard on client-writable existing tables | The invoker guard reads `production_reset_state FOR SHARE`; if RLS hides its sole row, the result is NULL and its comparison does not reject the write. Missing grants can instead error. A writable client path must not be assumed to have the same concurrency guarantee as the verified privileged Prisma path. |

PostgreSQL documents [RLS's TRUNCATE/REFERENCES exclusions and bypass rules](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)
and [creator-specific default privileges](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).
Defaults come from the **effective creating role**, not all its memberships.
Global and schema-specific defaults, PUBLIC and inherited privileges must all be
accounted for. FORCE RLS alone cannot solve TRUNCATE or BYPASSRLS access.

**Required future correction, not implemented or executed here:** deny effective
client access to these five tables (including TRUNCATE/REFERENCES/TRIGGER) and the
four functions; inspect PUBLIC, direct, inherited and service-role paths. Prefer
object-scoped restrictions in the pending migration over changing unrelated global
default ACLs. Define the verified backend/migration role requirements explicitly,
and ensure ordinary registrations/payments/payroll can still execute their
SECURITY INVOKER triggers. Review fail-closed behavior when the generation row is
missing or invisible. Do not merely grant RLS visibility to public clients to make
writes pass. Retain protection within the same migration transaction as creation.
No production or repository migration permissions were changed by this review.
Only the owned disposable fixture models broad grants.

[Query 17](sql/production-reset-dashboard/17_reset_client_permissions.sql) returns
expanded creator defaults, client role/membership metadata and (when present)
effective grants/policies on the five tables and four functions. It is read-only;
missing future objects are expected before installation and cannot certify future
protection. It assumes only the supplied candidate creator `postgres`, not Prisma
identity. Run it now for catalog evidence, then against approved isolated staging
with the actual creator before release. Exact ACL entries, elevated memberships,
RPC exposure and actual creator/runtime contexts remain gaps. Do not apply the
migrations merely to obtain a post-installation report.

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
| ACLs / security reviewer + DBA | Separate reviewed object-scoped permission correction and missing/invisible state decision; test anon/authenticated denial, service-role boundary, backend writer success and no inherited bypass. |
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

The new tests are **characterization tests**: a passing TRUNCATE exposure test is
evidence of a blocker, not proof that the migration is secure. They use only the
owned disposable runner and rollback all security/guard probes. No application
business logic, migration SQL, dependency versions or CI workflow changed.
Local validation: Prisma generation, TypeScript and 405 unit tests passed.
On PostgreSQL 17.6, all migration fixtures passed, including 29 Dashboard checks
before and after migration, 18 reset integration tests, and 20 security/guard
characterization tests. The production build passed with the previously
documented ESLint compatibility warning and expected static-read errors against
an unavailable loopback database; it is not a clean standalone lint result.
Hosted CI is recorded in the PR and completion report. The regular unit run skips the 67 tests gated
to the disposable database runner.
