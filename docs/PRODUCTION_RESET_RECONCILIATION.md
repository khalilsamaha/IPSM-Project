# PR 90 — production preflight reconciliation

**Overall: NO-GO for migration, reset, merge or production deployment.** The FK
compatibility blocker has an evidence-based correction. Default-ACL and
invisible-state vulnerabilities are corrected in the unapplied migration pair.
The reported teacher-body differences are now reproduced exactly and preserved.
Teacher schema/metadata reconciliation is closed by administrator Queries18/19. Identifier history, migration provenance,
actual runtime identity and live-compatible security validation remain unresolved. PR 90 stays draft;
PR 2 is untouched.

## Evidence and limits

The [metadata-only administrator evidence](evidence/production-reset-2026-11-07.json)
records project `rakzehtbpzseetldbohm`, reports at 2026-11-07 22:02:24.628833 UTC
(schema) and 22:02:52.844139 UTC (guards), all 45 validated FKs, source filename
and SHA-256. It contains no records, credentials or function bodies. The connector
again denied the read-only IPSM catalog request; no other project was accessed.
These are supplied observations, not an independently repeated live inspection.

The November 8 [administrator summary](evidence/production-reset-2026-11-08-summary.json)
supersedes the earlier unknown source counts and payroll classification. Query 10
completed 42/42 items with no explicit blockers for the **supplied** `postgres` /
`postgres` roles: required schema access, DML on 25 application tables,
BYPASSRLS and teacher-function execution were reported. This verifies those
candidate roles' permissions, **not the actual Vercel Prisma runtime identity**.
Raw report JSON and execution timestamps were not supplied; findings are
attributed to the administrator summaries. The later Query 17 summary supplies
the exact TABLE default grants listed below.

Queries 12–16 confirm the reviewed 45 FKs/22 variants and guard hash differences;
three historical payroll audit events reference absent records; current payroll
and teacher-payroll-expense counts are zero. All four identifier source tables
are empty. Recoverable 2026 RCPT/STU maxima are 14/5; FAM history is unknown.
The three Supabase records contain 0, 1 and 1 statements; Prisma history is absent.
Statement counts do not reconstruct the missing bootstrap or prove provenance.

See the [security review, guard decision and release plan](PRODUCTION_RESET_RELEASE_REVIEW.md)
for the permission/state correction, isolated regression tests and concrete gates.

Query 17 subsequently completed 84 items, read-only/repeatable-read,
REVIEW_REQUIRED: candidate creator postgres grants all eight TABLE privileges
(including MAINTAIN) to anon/authenticated/service_role; only service_role bypasses
RLS. All five tables and four functions remain absent. See the
[Query 17 evidence summary](evidence/production-reset-query17-summary.json).
This verifies creator defaults, not post-installation privileges or Vercel identity.
The mirrored unapplied reset-integrity migrations now revoke all non-owner grants,
assert effective client denial including membership paths, and fail closed on
missing/invisible/invalid generation state without SECURITY DEFINER.

## Consolidated execution and closed evidence

[Final remaining gates](PRODUCTION_RESET_REMAINING_GATES.md) and the
[release/recovery runbook](PRODUCTION_RESET_RELEASE_RUNBOOK.md) consolidate this
review. Administrator Query18 reports 14/14 MATCH at 2026-11-08T06:28:58.231143+00:00;
Query19 reports four REVIEW_REQUIRED items, zero blockers at
2026-11-08T06:32:02.008971+00:00, both PostgreSQL 17.6. Together with original
Query02 and prior body verification, this closes the scoped teacher schema,
function/trigger metadata and existing ACL review. Do not rerun those reports.

All three function/table owners are postgres; candidate postgres roles can execute.
Existing guard EXECUTE belongs to postgres/service_role; anon/authenticated have
no effective EXECUTE. That does not entitle service_role to the new reset tables
or establish actual Vercel identity. See the [administrator evidence summary](evidence/production-reset-final-admin-summary.json).
Both migration mirrors remain unchanged. The added rehearsal/package/tests use
only synthetic data and a verified disposable cluster; no production mutation.

## GO / NO-GO matrix

| Gate | Decision | Evidence / required resolution |
| --- | --- | --- |
| Core table presence | GO for this check | All 25 reported present; not a full schema/permissions certificate. |
| FK deletion compatibility | GO with this correction | 23 original matches plus 22 exact NO ACTION variants; ordered columns and delete actions unchanged. New payroll FK remains separately proposed. |
| Availability guard | GO for body/trigger/config parity | All hashes match the PostgreSQL 17 reference; other parity DDL/grants still require review. |
| Schedule guard source | GO for exact equivalence and preservation | Removing only the 109-byte comment reproduces live MD5 8bf0ff83d02322ec49fb6500f794a74e. No executable difference; positive/negative differential tests pass. |
| Enrollment guard source | GO for exact equivalence and preservation | Converting 59 LF characters to CRLF reproduces live MD5 2e995c04ca6865d8160d798ee9e5099f. Existing historical guard is validated and preserved. |
| Parity definitions / reported properties | GO for Query 02 snapshot | Both enum labels/order, all nine displayed types/defaults/nullability/generation flags, two CHECKs and two index definitions/keys/exported flags match. Full original and 16-item extract checked; pretty/default CHECK rendering explains differing hashes. |
| Remaining teacher schema flags / reported ownership | GO for reported Query18/19 snapshot | 14/14 MATCH; table/function ownership postgres reported. Actual migration connection identity remains a separate gate. |
| Availability-course FK | GO for scoped parity | Query02 definition/actions/validation/deferral and Query18 inheritance checks match. |
| Guard metadata / reported ownership / existing ACLs | GO for candidate-role snapshot | Query19 confirms all three expected attributes/configuration/triggers and postgres ownership; postgres/service_role EXECUTE, anon/authenticated denied. Preserve these existing guards; actual runtime identity still unverified. |
| Registration uniqueness | GO for duplicate check; migration pending | Zero duplicate groups. Missing unique indexes require the separately approved canonical rollout. |
| Payroll | GO for no current posting mismatch; historical sign-off pending | Query 14: three absent-record audit events, zero current payroll and payroll expenses. Preserve audits; absence does not establish legitimate deletion. |
| Receipts / balances | GO for reported checks | Four checks returned zero; retain evidence and recheck before rollout. |
| Identifier history | NO-GO | Query 15: all four sources empty; RCPT/STU 14/5 remain lower bounds, FAM unknown. Recover complete issuance or adopt an enforced disjoint namespace. |
| Migration provenance | NO-GO | Three Supabase versions, statement counts 0/1/1, no Prisma ledger. Counts do not establish object provenance; preserve truthful history and reconcile a future delta. |
| Candidate database permissions | GO for supplied roles only | Query 10 completed 42/42: postgres/postgres schema access, 25-table DML, BYPASSRLS and teacher-function execution reported. Proposed objects absent. |
| Actual Vercel runtime identity | NO-GO | Not independently verified; Query 10 cannot prove which role Prisma uses. |
| New-table client protection | GO for isolated remediation; NO-GO for rollout | Exact broad TABLE defaults confirmed. New-object ACL cleanup and effective assertions deny all eight privileges and function execution to clients; strict invoker state guard closes NULL/RLS bypass. Actual creator/runtime memberships and live-compatible staging still require verification. |
| PostgreSQL 17 syntax/integrity | GO on fixture | Tested on PostgreSQL 17.6; not a production data, role, load or lock certification. |
| Synthetic release/recovery | GO for isolated scope | Future-delta checksum/order, non-superuser owner, six scopes, rollback/repeat rejection, modest lock/load and pre/post backup restoration tested. Not actual production roles/history/platform recovery. |
| Deployment readiness | NO-GO | Metadata confirms shared Preview/Production database/Auth entries. Resolve identities, identifier approval/implementation, genuine history, Preview isolation and human/platform acceptance. CI is not production authorization. |

## FK assessment

The correction adds only the 22 supplied column-identical, DELETE-identical
NO ACTION signatures alongside the existing Prisma CASCADE variants. It does
not change production FKs or accept arbitrary update-action/column changes,
unvalidated constraints or unknown relationships.

Reset deletes records and updates balances/registration payment references; it
does not change referenced primary-key IDs. ON UPDATE NO ACTION therefore does
not alter these deletion paths. This is not approval for other code to rewrite
IDs. [PostgreSQL 17 referential-action documentation](https://www.postgresql.org/docs/17/sql-createtable.html).

The exact 22 differences, individual deletion assessments and complete 45-FK
comparison appear below. [Query 12](sql/production-reset-dashboard/12_foreign_key_reconciliation.sql)
retains the original baseline so those differences remain visible while
distinguishing reviewed variants from new drift.

## Teacher guards and parity migration

The [exact equivalence review](PRODUCTION_RESET_GUARD_EQUIVALENCE.md) and
[reconstruction manifest](evidence/production-reset-guard-equivalence.json) supersede
the earlier unresolved body-hash comparison. From unchanged historical sources:

- Enrollment: all 59 LF characters changed to CRLF, with no other change,
  reproduces `2e995c04ca6865d8160d798ee9e5099f` exactly.
- Schedule: remove only the two-line legacy/import comment (109 bytes), retaining
  LF elsewhere, to reproduce `8bf0ff83d02322ec49fb6500f794a74e` exactly.
- Availability: unchanged body remains `ce495851f4dce1da05f507f4af587a61`.

PostgreSQL 17 tests install the candidates, verify its own prosrc hashes and compare
43 positive/negative/boundary cases across both variants. No executable difference
was found or needed to reproduce either reported hash. The live NULL-enrollment
return already exists; it is not introduced by this PR. The previously supplied
three trigger/configuration hashes still match the reference.

The two unapplied parity migrations now validate exact complete source strings
(canonical or the one reviewed live variant), strict function attributes/config,
owner/migration context and exact trigger definitions. They preserve approved
existing functions/triggers without CREATE OR REPLACE, ALTER, DROP/recreation or
ACL changes. Unknown source, overload, configuration, trigger or touched schema
shape aborts the transaction. Enrollment is a required historical prerequisite;
only both-absent availability/schedule pairs on the documented older schema path
may receive their original canonical definition.

The non-function DDL was reviewed independently: nine column definitions, enum
values, two rate/unit checks, one FK and two indexes now have structural assertions.
Missing intended objects may be added; conflicting definitions are never silently
accepted or rewritten. This is not proof that production's remaining parity DDL is
redundant. The subsequent full Query 02 reconciliation confirms reported definitions
and presence. Administrator Queries18/19 now close the scoped catalog/metadata review; reuse
these confirmed definitions in staging. Actual runtime and chosen migration
connection identities remain separate checks. Do not weaken the strict assertions.
The known body-hash mismatch itself no longer blocks preservation.

## Payroll classification and backfill safety

Query 07 counts audit **events** for invalid references and distinct
(payroll ID, expense ID) **pairs** for inconsistent links. Two and three are not
five independent problems. November 8 Query 14 classifies three audit events as
references to absent records and confirms zero current payroll / teacher-payroll
expense rows. No current posting inconsistency is reported in that snapshot.
This does not prove why historical records disappeared or authorize cleanup.
Obtain the financial owner's acknowledgement and retain all three audit events.

[Query 14](sql/production-reset-dashboard/14_payroll_classification.sql) distinguishes:

- Both referenced records absent: historical deletion **or unresolved bad
  reference**; absence cannot prove legitimate deletion.
- Old invalid reference on a payroll with one consistent current posting:
  unresolved audit context, distinguished from a broken current posting.
- Existing payroll missing expense, or expense missing payroll: current
  financial context needing investigation.
- Existing pair with status/amount/category/archive mismatch: live inconsistency.
- Consistent existing pair: no finding for that pair.

Results contain aggregate event/pair counts and flags, no names, IDs, amounts,
descriptions or audit payloads. Query 07's ambiguity checks remain mandatory;
one healthy posting does not waive conflicting references. Preserve all audits.

The previous integrity migration could backfill an unambiguous existing pair even
when its status, amount, category or archive state disagreed. The **unapplied**
migration now aborts transactionally on such live inconsistencies before backfill,
with CASE-guarded UUID casts. Malformed and absent historical references remain
unchanged; no posting is invented. Passing this guard does not waive missing
postings or ambiguous history: classify query 07/14 findings and approve any
separate remediation explicitly. No production repair was executed.

## Identifier retention and deleted history

November 8 confirms families, students, payments and receipts are **all empty**. [Query 15](sql/production-reset-dashboard/15_identifier_sources.sql)
returns explicit counts for families, students, payments and receipts, audit-only
high-water marks and creation-event coverage, without individual identifiers.

The migration reserves current codes with owners and recoverable audit codes
without owners, seeds per-kind/year counters, and retains both ledgers through
reset. Allocator/immutability triggers protect those **known** values. INTEGER
exhaustion and nonstandard formats require review.

For 2026, the supplied evidence implies minimum next receipt **15** and student
**6**, subject to higher unrecovered issuance. There is **no defensible family
minimum**. Family/Student creation audits in `actions/records.ts` can omit codes;
the old generators used maxima from surviving tables. Empty tables and no FAM
regex match cannot prove that FAM-2026-000001 was never issued.

Before rollout, reconcile older receipts, exports and backups privately for every
relevant year. Approve a reservation/floor manifest with ownership where recoverable.
If history cannot be recovered, do not silently start at 1 or claim guaranteed
non-reuse: obtain an explicitly reviewed disjoint namespace/range strategy and
test it. Counter floors alone do not reserve manually imported old values; the
issuance ledger/import rules must implement the chosen policy. Any backfill or
namespace change requires separate authorization and is not performed here.

## One canonical migration path

Confirmed Supabase records are `20260731171613`, `20260801163840` and
`20260801165129`. None names a repository migration. There is no Prisma ledger.
Dates, similar function names and object presence cannot prove that specific
repository files ran. Missing Prisma history is consistent with a different
migration mechanism; do not fabricate Prisma records to satisfy tooling. Both
committed trees have original-schema bootstrap gaps.

**Recommend Supabase as the single canonical deployment/history path**, subject
to provenance reconciliation. Query 16 returns only versions, statement counts,
hashes and known guard-name mentions; a mention does not prove application.
The reported 0/1/1 stored statement counts alone cannot explain all current objects;
a zero-statement record is not evidence that nothing happened. An administrator
must privately reconcile available migration contents, deployment artifacts and
current schema; record unrecoverable provenance honestly. Prepare an isolated release directory/history matching those
actual records and only the reviewed future delta; verify pending migrations and
restore testing before separate deployment approval. Do not push the entire
repository history, mark unrelated files applied, use Prisma migrate deploy
against invented history, or apply the mirrored copies twice.
[Supabase deployment/history documentation](https://supabase.com/docs/guides/deployment/database-migrations).

## Confirming database roles without credential disclosure

Use an existing authorized client bound to the **actual application's configured
connection**, and separately the intended canonical migration connection:

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SELECT current_user AS effective_database_role, session_user AS login_database_role;
ROLLBACK;
```

Share only the role names and which connection context produced them. Do not
paste URLs/passwords, dump environment variables, pull Vercel secrets, expose
Auth identities, create a diagnostic endpoint or deploy code for this check.
A Dashboard run identifies its selected SQL role, not Prisma's role. Application
roles such as SUPER_ADMIN are unrelated; pooler usernames can include routing
suffixes. If no authorized runtime-context connection is available, retain the
blocker rather than guess.

Query 10 now verifies the supplied postgres roles, with BYPASSRLS, against the
existing objects. It does not attest either connection context or privileges on
the five not-yet-created tables. Confirm the actual Vercel runtime role and the
selected migration connection; rerun 10 only if the confirmed roles differ or
permissions changed. Query 17 reviews client/default ACLs without impersonation.
Verify ownership for ALTER/replacement/revokes,
schema usage/create, allocator EXECUTE, protected-table access, generation-guard
SELECT/FOR SHARE privileges and RLS visibility. Table grants alone do not bypass
RLS. Do not grant DELETE on protected users/audits simply because a report lists
the privilege. No grants or role changes are authorized by this review.

## PostgreSQL 17 and release requirements

Actual validation uses PostgreSQL **17.6**. The migrations use supported catalogs,
transactional DDL, FK/unique constraints, JSONB and guarded UUID casts. Tests cover
rollback on misleading registration indexes, receipt ownership conflicts and
inconsistent payroll postings, refusal to replace unknown guard bodies, preserved
orphan audits, and financial/academic resets with the 22 exact live FK variants.
No historical migration is rewritten or production FK changed to match Prisma.

The scoped guard attributes and non-function parity DDL review is closed by
Queries18/19. Before approval: sign off the preserved historical payroll findings;
approve and implement the proven identifier reservation or namespace policy;
reconcile the three migration records; verify actual roles; and validate the
corrected ACL/state model on an isolated PostgreSQL 17 staging restore with
representative schema, load, lock timeouts and backup/restore procedures. Keep schema deployments separate from resets.
Green CI and the FK correction alone do not make PR90 merge-ready.

## Exact comparisons

Validation of the previous November 7 correction passed (not the new review tests): Prisma generation, TypeScript,
404 unit tests, all existing migration fixtures plus 27 Dashboard/reconciliation
checks before and after fixture migration, 18 reset integration tests, and the
production build. Database validation used PostgreSQL 17.6 on fresh owned loopback
clusters. The build retains the previously documented ESLint compatibility warning
and expected static-read errors against an intentionally unavailable dummy DB.
That earlier correction changed the still-unapplied teacher-parity pair. The
consolidated follow-up changes only release tooling, isolated tests and documents;
both migration pairs and all historical migrations remain unchanged. Current
validation results are in the [release rehearsal evidence](evidence/production-reset-release-rehearsal.json)
and the draft PR, separate from those historical test counts.

<!-- Generated metadata tables follow; no personal or financial records. -->

All 22 update differences are **CASCADE (expected) → NO ACTION (live)**.

| Relationship | Unchanged ON DELETE | Reset-deletion assessment |
| --- | --- | --- |
| public.audit_logs.created_by_id → public.users.id | SET NULL | Users protected; referenced IDs never changed. |
| public.enrollments.season_id → public.seasons.id | RESTRICT | Balance updates do not change IDs; academic dependencies deleted or blocked. |
| public.enrollments.student_id → public.students.id | CASCADE | Balance updates do not change IDs; academic dependencies deleted or blocked. |
| public.enrollments.teacher_id → public.teachers.id | SET NULL | Balance updates do not change IDs; academic dependencies deleted or blocked. |
| public.expenses.created_by_id → public.users.id | SET NULL | Users protected; referenced IDs never changed. |
| public.payment_items.enrollment_id → public.enrollments.id | RESTRICT | Children deleted first with explicit Financial Data only. |
| public.payment_items.payment_id → public.payments.id | CASCADE | Children deleted first with explicit Financial Data only. |
| public.payments.created_by_id → public.users.id | SET NULL | Users protected; referenced IDs never changed. |
| public.payments.family_id → public.families.id | RESTRICT | Retained payments block family deletion; explicit financial scope deletes first. |
| public.receipts.payment_id → public.payments.id | CASCADE | Children deleted first with explicit Financial Data only. |
| public.schedule_patterns.enrollment_id → public.enrollments.id | RESTRICT | Dependent schedules removed before parents, or retained enrollment/payroll dependencies block. |
| public.schedule_patterns.room_id → public.rooms.id | SET NULL | Rooms protected in PR1; no room ID update/deletion. |
| public.schedule_patterns.teacher_id → public.teachers.id | RESTRICT | Dependent schedules removed before parents, or retained enrollment/payroll dependencies block. |
| public.schedule_sessions.enrollment_id → public.enrollments.id | SET NULL | Dependent schedules removed before parents, or retained enrollment/payroll dependencies block. |
| public.schedule_sessions.room_id → public.rooms.id | SET NULL | Rooms protected in PR1; no room ID update/deletion. |
| public.schedule_sessions.schedule_pattern_id → public.schedule_patterns.id | SET NULL | Dependent schedules removed before parents, or retained enrollment/payroll dependencies block. |
| public.schedule_sessions.season_id → public.seasons.id | SET NULL | Dependent schedules removed before parents, or retained enrollment/payroll dependencies block. |
| public.schedule_sessions.student_id → public.students.id | RESTRICT | Dependent schedules removed before parents, or retained enrollment/payroll dependencies block. |
| public.schedule_sessions.teacher_id → public.teachers.id | RESTRICT | Dependent schedules removed before parents, or retained enrollment/payroll dependencies block. |
| public.students.family_id → public.families.id | RESTRICT | Operational dependencies and students removed before families. |
| public.teacher_availability.season_id → public.seasons.id | SET NULL | Seasonal rows deleted before seasons; no conversion to global availability. |
| public.teacher_availability.teacher_id → public.teachers.id | CASCADE | Availability deleted before teachers; delete cascade unchanged. |

| Teacher function | Live body MD5 | Repository body MD5 | Result |
| --- | --- | --- | --- |
| validate_enrollment_teacher_availability | 2e995c04ca6865d8160d798ee9e5099f | e85ba87b42cfa5e5b60c2d3aaa0ccfc1 | Exact CRLF variant reproduced; preserved |
| validate_schedule_teacher_availability | 8bf0ff83d02322ec49fb6500f794a74e | e9d829cecb69aedc692d7b1a5fdaaf07 | Exact comment-only variant reproduced; preserved |
| validate_teacher_availability_scope | ce495851f4dce1da05f507f4af587a61 | ce495851f4dce1da05f507f4af587a61 | Matches |

<details>
<summary>All 45 live FK signatures (suffix: DELETE, UPDATE)</summary>

| Constraint | Live signature | Comparison with ef53ed5 |
| --- | --- | --- |
| audit_logs_created_by_id_fkey | public.audit_logs.created_by_id->public.users.id:na | Reviewed 22-set correction |
| cashier_shifts_closed_by_id_fkey | public.cashier_shifts.closed_by_id->public.users.id:nc | Exact original match |
| cashier_shifts_reopened_by_id_fkey | public.cashier_shifts.reopened_by_id->public.users.id:nc | Exact original match |
| cashier_shifts_user_id_fkey | public.cashier_shifts.user_id->public.users.id:rc | Exact original match |
| course_pricings_course_id_fkey | public.course_pricings.course_id->public.courses.id:cc | Exact original match |
| course_pricings_level_id_fkey | public.course_pricings.level_id->public.course_levels.id:cc | Exact original match |
| course_pricings_season_id_fkey | public.course_pricings.season_id->public.seasons.id:nc | Exact original match |
| enrollments_course_id_fkey | public.enrollments.course_id->public.courses.id:nc | Exact original match |
| enrollments_level_id_fkey | public.enrollments.level_id->public.course_levels.id:nc | Exact original match |
| enrollments_season_id_fkey | public.enrollments.season_id->public.seasons.id:ra | Reviewed 22-set correction |
| enrollments_student_id_fkey | public.enrollments.student_id->public.students.id:ca | Reviewed 22-set correction |
| enrollments_teacher_id_fkey | public.enrollments.teacher_id->public.teachers.id:na | Reviewed 22-set correction |
| expenses_created_by_id_fkey | public.expenses.created_by_id->public.users.id:na | Reviewed 22-set correction |
| expenses_shift_id_fkey | public.expenses.shift_id->public.cashier_shifts.id:nc | Exact original match |
| payment_items_enrollment_id_fkey | public.payment_items.enrollment_id->public.enrollments.id:ra | Reviewed 22-set correction |
| payment_items_payment_id_fkey | public.payment_items.payment_id->public.payments.id:ca | Reviewed 22-set correction |
| payments_created_by_id_fkey | public.payments.created_by_id->public.users.id:na | Reviewed 22-set correction |
| payments_family_id_fkey | public.payments.family_id->public.families.id:ra | Reviewed 22-set correction |
| payments_shift_id_fkey | public.payments.shift_id->public.cashier_shifts.id:nc | Exact original match |
| receipts_payment_id_fkey | public.receipts.payment_id->public.payments.id:ca | Reviewed 22-set correction |
| registration_attempts_created_by_id_fkey | public.registration_attempts.created_by_id->public.users.id:nc | Exact original match |
| registration_attempts_enrollment_id_fkey | public.registration_attempts.enrollment_id->public.enrollments.id:nc | Exact original match |
| registration_attempts_family_id_fkey | public.registration_attempts.family_id->public.families.id:rc | Exact original match |
| registration_attempts_payment_id_fkey | public.registration_attempts.payment_id->public.payments.id:nc | Exact original match |
| registration_attempts_primary_student_id_fkey | public.registration_attempts.primary_student_id->public.students.id:rc | Exact original match |
| schedule_patterns_enrollment_id_fkey | public.schedule_patterns.enrollment_id->public.enrollments.id:ra | Reviewed 22-set correction |
| schedule_patterns_room_id_fkey | public.schedule_patterns.room_id->public.rooms.id:na | Reviewed 22-set correction |
| schedule_patterns_teacher_id_fkey | public.schedule_patterns.teacher_id->public.teachers.id:ra | Reviewed 22-set correction |
| schedule_sessions_enrollment_id_fkey | public.schedule_sessions.enrollment_id->public.enrollments.id:na | Reviewed 22-set correction |
| schedule_sessions_room_id_fkey | public.schedule_sessions.room_id->public.rooms.id:na | Reviewed 22-set correction |
| schedule_sessions_schedule_pattern_id_fkey | public.schedule_sessions.schedule_pattern_id->public.schedule_patterns.id:na | Reviewed 22-set correction |
| schedule_sessions_season_id_fkey | public.schedule_sessions.season_id->public.seasons.id:na | Reviewed 22-set correction |
| schedule_sessions_student_id_fkey | public.schedule_sessions.student_id->public.students.id:ra | Reviewed 22-set correction |
| schedule_sessions_teacher_id_fkey | public.schedule_sessions.teacher_id->public.teachers.id:ra | Reviewed 22-set correction |
| students_family_id_fkey | public.students.family_id->public.families.id:ra | Reviewed 22-set correction |
| teacher_availability_course_id_fkey | public.teacher_availability.course_id->public.courses.id:rc | Exact original match |
| teacher_availability_season_id_fkey | public.teacher_availability.season_id->public.seasons.id:na | Reviewed 22-set correction |
| teacher_availability_teacher_id_fkey | public.teacher_availability.teacher_id->public.teachers.id:ca | Reviewed 22-set correction |
| teacher_courses_course_id_fkey | public.teacher_courses.course_id->public.courses.id:rc | Exact original match |
| teacher_courses_level_id_fkey | public.teacher_courses.level_id->public.course_levels.id:nc | Exact original match |
| teacher_courses_teacher_id_fkey | public.teacher_courses.teacher_id->public.teachers.id:cc | Exact original match |
| teacher_payroll_items_payroll_id_fkey | public.teacher_payroll_items.payroll_id->public.teacher_payrolls.id:cc | Exact original match |
| teacher_payroll_items_schedule_session_id_fkey | public.teacher_payroll_items.schedule_session_id->public.schedule_sessions.id:rc | Exact original match |
| teacher_payrolls_approved_by_id_fkey | public.teacher_payrolls.approved_by_id->public.users.id:nc | Exact original match |
| teacher_payrolls_teacher_id_fkey | public.teacher_payrolls.teacher_id->public.teachers.id:rc | Exact original match |

</details>
