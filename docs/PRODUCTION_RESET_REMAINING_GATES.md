# PR90 — final consolidated gates

**Production NO-GO; PR remains draft.** All independently executable repository
preparation is consolidated in the [release runbook](PRODUCTION_RESET_RELEASE_RUNBOOK.md).
This replaces the previous request to run Queries18/19: the administrator has now
completed both. Do not repeat resolved investigations.

## Closed evidence gates

| Gate | Evidence / exact limit |
| --- | --- |
| Schema presence and FK deletion compatibility | 25 tables; 45 FKs, with exactly 22 accepted ON UPDATE variants; no changed deletion actions. |
| Teacher function bodies | Prior exact-byte/hash equivalence and preservation tests; no new reconstruction needed. |
| Query02 definitions | Original 545-item report and 16-item extract checked against each other; enum, nine reported columns/defaults, two CHECKs, one FK, two indexes match. Pretty/default CHECK rendering difference explained with real PostgreSQL. |
| Remaining schema flags | Query18, PG17.6, 14/14 MATCH, zero blockers, 2026-11-08T06:28:58.231143+00:00. Close type identity/modifier, constraint inheritance and index-flag checks. |
| Guard metadata / candidate ownership | Query19, PG17.6, four REVIEW_REQUIRED items, zero blockers, 2026-11-08T06:32:02.008971+00:00. All three function/trigger attributes, configuration, ownership and metadata match. Functions/tables owned by postgres. |
| Existing teacher ACL review | Candidate postgres app/migration roles can execute; postgres/service_role EXECUTE; anon/authenticated effective EXECUTE false. Existing guards remain invoker and are preserved without replacing their ACLs. Not a grant of service_role access to new reset infrastructure. |
| Proposed infrastructure correction | Mirrored reset-integrity migration denies clients' effective rights and fails closed on missing/invisible state; no SECURITY DEFINER or permissive RLS. Existing security suites plus non-superuser owner release rehearsal pass in disposable PostgreSQL. |
| Release mechanics | Offline ordered/checksummed future-delta package; simulated current schema; expected mid-file rollback/repeat rejection; six reset scopes; protected records; known identifiers; lock/load; before/after backup restoration. These are synthetic results, not platform/history certification. |

Sources: [Query02 extract](evidence/production-reset-teacher-schema-query02.json),
[Query18/19 administrator summary](evidence/production-reset-final-admin-summary.json),
[prior guard review](PRODUCTION_RESET_GUARD_EQUIVALENCE.md). Raw 18/19 JSON was not
independently collected; the administrator's explicit results support these scoped
closures. None proves an actual Vercel connection identity. Refresh affected evidence
only if relevant schema/permissions change before a separately authorized release.

## Remaining NO-GO gates and smallest administrator actions

| Type / owner | Exact outstanding action | Recommendation and consequence of deferral |
| --- | --- | --- |
| Evidence — DBA/deployment owner | Report current_user/session_user through the actual deployed Prisma connection context and intended migration connection; confirm relevant ownership/memberships. Names/context only, no secrets. | Use existing secure clients. SQL Editor postgres is not runtime proof. Keep owner-only protections; a different runtime role requires a separately reviewed entitlement model. No release until verified. |
| Business decision + dependent engineering — business/financial owner | Choose complete historical reservations or approve the detailed IPSM2 namespace proposal, including non-use evidence across manual/import/external channels, after-commit delivery and post-backup recovery rules. | Favor a certified disjoint namespace if complete recovery cannot be proved. Do not implement the format before approval. Both strategies remain blocked if neither proof is available. The approved choice still requires focused implementation/tests before release. |
| Evidence / packaging — DBA/release owner | Supply retained original Query16 per-version rows and authentic recorded/deployment SQL; reconcile the three real versions without changing existing history. | Supabase is canonical. Only an offline future-delta rehearsal bundle is prepared; no fabricated history. Fetch authentic history privately with a supported tool if authorized. If accurate pending order cannot be established, no production migration. |
| Environment authorization — deployment owner | Approve and establish separate Preview/staging PostgreSQL **and Auth**, keys and side-effect isolation; verify non-production identity before mutation testing. | Current metadata confirms all five database/Auth variables shared across Production/Preview, no PR-branch override. Do not mutation-test that Preview or change its variables without approval. |
| Human acceptance — financial owner | Sign or decline the runbook acknowledgement of three preserved historical payroll audit orphans, zero current payroll/expense populations and unreconstructable historical context. | Preserve audits; do not invent financial postings. Acceptance cannot be inferred from green tests. |
| Release authorization — application/DBA/security owners | Accept the approved identifier implementation and truthful package; rehearse representative volume and platform/role/Auth/storage recovery with actual intended role model; approve maintenance/deployment explicitly. | Local PG17 recovery is complete for the synthetic schema. It does not certify production volume, external Auth/storage or post-backup issued identifiers. Keep draft until remaining evidence and approvals are satisfied. |

These are three coordinated administrator workstreams, not additional rounds of
broad reports: **(1)** identities + authentic history; **(2)** business/financial
decision; **(3)** isolated environment + release acceptance. No credential retrieval,
new endpoint, production migration, history repair, reset or deployment is authorized.

## Identifier outcome

The [complete proposal](PRODUCTION_RESET_IDENTIFIER_DECISION.md) covers allocation,
ledger immutability, legacy restore/import, receipts, parsing/export, concurrency,
reset persistence, overflow, rollback, backup gaps and acceptance tests. Proposed
new grammar is KIND-IPSM2-YYYY-number, subject to business approval **and proof of
non-overlap**; it is not enabled. Current sources are empty, RCPT/STU 2026 minimums
14/5 do not establish completeness, and FAM history remains unknown. No private
issuance backup/import manifest was found. Existing TEXT assignment means an
arbitrary prefix cannot be certified just from repository generators.

## Provenance outcome

The [worksheet](evidence/production-reset-migration-provenance.json) records all
three actual versions, unknown per-version count/hash/source/object attribution,
and candidate repository lineage/hashes. Search covered 298 reachable commits at
the research baseline; no original files named by those versions were found.
Counts 0/1/1 remain unmapped without original Query16 rows. The private SQL snippet
is one byte; available IPSM archive has only schema evidence. Connector denied the
targeted read-only history query. No other Supabase project was accessed.

`tools/production-reset/release-package.ts` builds/verifies only the genuine future
SQL delta and mirror hashes in a fresh output directory. Its status is explicitly
REHEARSAL_ONLY_PRODUCTION_BLOCKED; no history stub, production apply command or
independent Prisma migration path exists. See the runbook for the supported private
history-fetch/reconciliation route and staging validation; no repair was executed.

## What changed / stayed deferred

Added consolidated evidence, provenance research, identifier design, deployment
metadata, financial acknowledgement, release runbook, offline package verifier and
isolated release/recovery tests. Both proposed migration pairs, historical migrations,
application business logic, dependencies and CI workflow remain unchanged. Existing
six reset scopes only; no PR2 work. No production/environment/privilege changes.
