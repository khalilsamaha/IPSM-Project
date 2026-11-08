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

| Type / owner | Exact outstanding action | Consequence of deferral |
| --- | --- | --- |
| Connection evidence — DBA/deployment owner | Verify current_user/session_user in the actual Vercel Prisma and intended migration connection contexts; confirm owner/membership compatibility. Names/context only. | Owner-only protections remain; do not assume SQL Editor postgres or service_role is the app identity. |
| Historical non-use / recovery certification — business owner + DBA | Certify the approved IPSM grammar was never previously issued across manual/external/import channels. Review private reservation/recovery manifests and sign their coverage. | Implementation is complete, but no activation exists by default. Do not enable issuance without proof or repeat the completed format decision. |
| Authentic migration history — DBA/release owner | Query16 and the two nonempty stored SQL texts are supplied. Their MD5s reproduce from historical repository SQL using only comment/final-LF differences. Reconcile the zero-statement July 31 record, original deployment provenance and actual canonical CLI history/pending list in isolated staging. | Matching recorded statements does not reconstruct the database bootstrap or certify a deployable history. No history repair, fictitious no-op or tree replay. Future-delta package remains rehearsal-only. |
| Environment access/authorization — deployment owner | Provide/approve independently isolated Preview PostgreSQL17 and Supabase Auth; perform scoped configuration changes and verify deployed identities. | Shared Production/Preview entries remain confirmed. No mutation testing on the shared Preview. No resources purchased or credentials retrieved. |
| Financial acknowledgement — financial owner | Acknowledge three retained historical payroll audit orphans and the inability to reconstruct their context from available evidence. | Preserve all three; no invented postings, links or deletion. |
| Release authorization — release/security/DBA owners | Review the final three-delta package, actual role model, representative staging and platform recovery, including restart-triggered issuance holds. Separately authorize any production migration/configuration/deployment. | Local PG17 mechanics do not prove platform recovery, unknown history or production capacity. Keep draft and production NO-GO. |

## Query16 evidence now reconciled (2026-11-08T15:44:55.544114+00:00)

| Recorded version | Statements | Joined statements MD5 | Guard references |
| --- | ---: | --- | --- |
| 20260731171613 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | none |
| 20260801163840 | 1 | `d34257683e5172ad7b1ede576a4b2591` | schedule, availability |
| 20260801165129 | 1 | `6c4135265819300dd72a0fbc476f80c2` | enrollment |

The read-only Query16 report has four REVIEW_REQUIRED items and no BLOCKER.
The administrator subsequently supplied the stored SQL text for both nonempty
versions. Their history hashes are reproducible from repository migrations with
comment removal and a terminal-LF difference only; see the provenance worksheet.
The first recorded version has an empty statement array. Complete deployment
history, bootstrap DDL and CLI pending-list behavior remain unverified. Do not replay historical
migrations, fabricate applied ledgers or run history repair.

## Completed identifier engineering

The business-selected FAM/STU/RCPT-IPSM format is implemented. The
[implementation](PRODUCTION_RESET_IDENTIFIER_IMPLEMENTATION.md) covers immutable
owner reservations, BIGINT allocation, atomic family/student/payment creation,
registration retries, payment replay, exact-owner manifest restoration, legacy
receipt compatibility, display/CSV/sorting, reset retention and recovery.

The third additive mirrored migration is `20261108000000_ipsm_identifiers`.
Activation requires an explicitly selected latest enabled attestation tied to the
database and postmaster lifetime, with non-use/recovery evidence. No attestation
is seeded. A newer disabled record holds issuance; restored/restarted servers need
fresh recovery review. No generic local bypass or permissive RLS policy exists.

## External access findings in this cycle

IPSM-only connector calls for targeted history, migration listing and branch
discovery were denied. Administrator supplied original Query16 metadata on 2026-11-08T15:44:55.544114+00:00: mapped
counts 0/1/1, MD5s and stored SQL for the two nonempty records. Their source-text fingerprints match reviewed repository migrations; July 31 bootstrap/deployment history and safe CLI release packaging remain unresolved. Metadata-only Vercel inspection
still shows all five DB/Auth entries shared across Production/Preview. No existing
authorized runtime SQL session or isolated Auth resource was exposed to this work.
These are access/evidence limits, not negative assertions about all resources owned
by the administrator. No unrelated project was used.

Use [the exact staging procedure](PRODUCTION_RESET_STAGING_SETUP.md),
[release runbook](PRODUCTION_RESET_RELEASE_RUNBOOK.md), and
[provenance worksheet](evidence/production-reset-migration-provenance.json).
Supabase remains canonical; Prisma is for schema/client generation and mirror checks.
The offline bundle now contains three genuine ordered future deltas and no fake history.

## Three coordinated remaining workstreams

1. DBA/deployment: actual connection identities, zero-statement July 31/deployment provenance and a truthful Supabase CLI pending-list rehearsal (two nonempty SQL statements now mapped), and role ownership.
2. Business/financial: historical non-use/recovery certification and payroll acknowledgement.
3. Deployment/release: isolated Preview database/Auth, real platform rehearsal and explicit release authorization.

No further broad schema report or Query18/19 repetition is requested. No production
migration, reset, credential/environment change, merge, deployment or PR2 work occurred.
