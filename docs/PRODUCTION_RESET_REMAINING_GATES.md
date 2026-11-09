# PR90 — final consolidated gates

**Current status — released 2026-11-09:** PR90 and PR92 are merged; all fourteen
reset groups, the three reviewed migrations and approved identifier activation
are live at `c5de2a062db5f38e15f09aeb51cc1b5d9af2075d`. Public access is restored.
See [completed release evidence](https://github.com/khalilsamaha/IPSM-Project/blob/b73fd1666d6f2c9e87e3a5781325ff247dec346c/docs/PRODUCTION_RESET_FINAL_DELIVERY.md) and the
[current identifier recovery runbook](IDENTIFIER_RECOVERY_RUNBOOK.md).
No new backup, reactivation, migration or deployment is authorized by this update.

## Historical pre-release checkpoints (superseded)

The pending/NO-GO decisions below record their original pre-release stages; they
are not current operational status or instructions to repeat the release.

> **Latest final-delivery evidence:** [coordinated fourteen-group release](PRODUCTION_RESET_FINAL_DELIVERY.md).
> Both actual Production connection profiles, exact remote history/three-delta
> dry-run, unchanged backup fingerprints and zero retained IPSM namespace matches
> are verified read-only. The owner's business declaration is recorded. Recovery
> stays CLOSED; financial acknowledgement and final coordinated approval remain.
> Earlier maintenance-only admission is no longer the requested outcome.

> **Final admission package:** [scope, decision table and coordinated release order](PRODUCTION_RESET_RELEASE_ADMISSION.md).
> Exported-database recovery is CLOSED; no repeat restoration is requested. The
> remaining recovery decision is acceptance of a scoped pre-activation in-place
> strategy retaining managed services (private record C), not proof of a new full
> platform backup. Records A/B remain unsigned; all release actions remain held.

## Current release checklist — 2026-11-09

This section incorporates the actual Production archive recovery verified at
2026-11-09T14:05:19Z and supersedes older access/backup and hosted-staging status
below and in historical reports. **Production NO-GO.** Hosted staging is explicitly waived; the recovery
target is isolated local PostgreSQL/Supabase, with Production used read-only.

- [x] **PR #92 code accepted** at `d66e7c0a92571dd2648568a603ac19c2856caef6`:
  owner confirmed final review, 118 focused tests passed, no defects. Keep unmerged;
  no implementation changes are required. This acceptance is not release approval.
- [x] PR #90's exact three future SQL files and mirrored copies still match the
  reviewed hashes. Canonical six-file workspace verified offline again.
- [x] Production variable-name metadata shows no `IPSM_IDENTIFIER_ACTIVATION_ID`;
  Preview lists none of the five Production DB/Auth keys. No values retrieved.
  This metadata does not prove the runtime SQL role or database attestation state;
  subsequent administrator connection evidence is recorded separately below.
- [x] Administrator independently verified the Production runtime and intended
  migration profiles through Kali Prisma: effective/login roles both `postgres`.
  This closes the reported profile-identity check, not a new agent/Vercel probe
  or complete cluster role/membership backup verification.
- [x] **Actual four-schema Production archive restored locally.** SHA-256, full
  readability, 63/63 table contents, sequence state, schema/ACLs, Auth, audit and
  migration history pass. One explicit local-only public-schema USAGE baseline
  adjustment was required. Original artifact unchanged; target stopped. See the
  [actual recovery report](PRODUCTION_RESET_PRODUCTION_RECOVERY.md).
- [x] Backup history contains exactly the established three versions and matching
  0/1/1 statement counts/MD5s; administrator reports current live profiles/history
  independently matched. No future delta is installed in the backup. Recheck
  target drift and exact pending SQL immediately before any later authorized apply.
- [ ] **Full recovery coverage remains unproven:** this archive excludes global
  roles/memberships/settings, extension-managed schemas and external platform
  configuration/assets. Document recoverable custody of those dependencies or
  explicitly approve a scoped in-place recovery retaining the existing platform.
  Do not relabel this four-schema PASS as a full physical/platform restore.
- [ ] Confirm the maintenance/writer hold and application compatibility sequence.
  The third delta rejects ordinary legacy allocation. Do not apply it while the old
  application continues creating families, students or numbered payments/receipts.
  Applying inactive infrastructure does not authorize reopening issuance.
- [ ] Before **separate identifier activation/reopening**, substantiate historical
  IPSM namespace non-use and complete recovery coverage using the existing unsigned
  certification form. Keep activation absent/disabled in the meantime.
- [ ] Obtain the financial owner's acknowledgement of the three preserved historical
  payroll audit events; do not invent transactions or erase evidence.

**Recovery verification stops here.** The remaining recovery decision is the
coverage/custody of excluded platform dependencies or approval of the explicitly
scoped in-place recovery plan. Historical identifier certification, financial
acknowledgement and maintenance compatibility remain separate gates. Do not
repeat the completed archive restoration or earlier broad diagnostics. No
migration, deployment, activation, reset or merge follows from this report.

Expected pending sequence (must match the actual target before any future apply):

1. `20261107000000_teacher_guard_parity`
2. `20261107010000_reset_integrity`
3. `20261108000000_ipsm_identifiers`

Earlier metadata and SQL hashes: [prior evidence](evidence/production-reset-final-release-check.json).
Actual archive restoration: [new recovery evidence](evidence/production-reset-production-recovery.json).
Backup coverage must explicitly include managed Auth/custom schema objects and
external Storage handling; a database dump does not contain Storage object bytes.
See [Supabase backup coverage](https://supabase.com/docs/guides/platform/backups)
and [CLI backup/restore coverage](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
Do not disable integrity checks or alter Production permissions to make a restore pass.

> Historical external-gate refresh (superseded for profile identity and actual
> archive restoration by the current checklist): exact-IPSM SQL access remained denied; CLI returns no branch
> records and no verified backup. Preview metadata remains empty. No completed local
> tests or cleanup were repeated. Use the [administrator handoff](PRODUCTION_RESET_EXTERNAL_HANDOFF.md)
> and [unsigned certification records](PRODUCTION_RESET_EXTERNAL_SIGNOFFS.md).

> Current operational evidence (2026-11-08): the owner has accepted the
> existing-database-only provenance scope and supplied conditional migration
> authority. Five shared Vercel variables now target Production only; all 28
> approved old Preview snapshots have been removed. Real local Supabase Auth/browser, scoped
> logical recovery and full physical PostgreSQL recovery have passed. Production roles, recoverable platform backup,
> hosted isolation and business certifications remain pending. See the
> [operational rehearsal](PRODUCTION_RESET_OPERATIONAL_REHEARSAL.md), including
> the removed unintended diagnostic deployment and production-backup evidence limit.
> Earlier access/authorization statements below describe their historical stage.

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
| Connection evidence — closed for reported profiles | Administrator reports both Production profiles independently verified through Kali Prisma as effective/login postgres. | Not independent agent verification of deployed Vercel context or a backup of the full role graph. Keep owner-only protections. |
| Historical non-use / recovery certification — business owner + DBA | Certify the approved IPSM grammar was never previously issued across manual/external/import channels. Review private reservation/recovery manifests and sign their coverage. | Implementation is complete, but no activation exists by default. Do not enable issuance without proof or repeat the completed format decision. |
| Existing-database history — DBA/release owner | Recorded arrays and isolated canonical CLI mechanics are reconciled. Scope accepted by the owner. Verify fresh target history/checksums and exactly three pending deltas. | Original July31 recording/bootstrap purpose remains unknown. If full original lineage is mandatory, supply trusted original artifacts; never repair or invent history. |
| Recovery coverage — DBA/release owner | Actual four-schema Production archive restore passes. Document excluded platform/role dependencies or approve scoped in-place recovery with those dependencies retained. | Full platform recovery remains uncertified; no further synthetic rehearsal substitutes for missing coverage. |
| Financial acknowledgement — financial owner | Acknowledge three retained historical payroll audit orphans and the inability to reconstruct their context from available evidence. | Preserve all three; no invented postings, links or deletion. |
| Release authorization — release/security/DBA owners | Review the final three-delta package, actual role model, isolated local recovery of Production and maintenance compatibility, including restart-triggered issuance holds. Conditional migration authority is already supplied; satisfy every safeguard. Production application deployment remains separately controlled. | Local PG17 mechanics do not prove platform recovery, unknown history or production capacity. Keep draft and production NO-GO. |

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
history and bootstrap DDL remain unknown. Canonical existing-database CLI behavior
is independently tested in isolation; current production pending state is not. Do not replay historical
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
counts 0/1/1, MD5s and stored SQL for the two nonempty records. Their source-text fingerprints match reviewed repository migrations; July31 bootstrap/deployment purpose remains unknown; canonical workspace mechanics are now tested in isolation. Initial metadata-only Vercel inspection
showed all five DB/Auth entries shared across Production/Preview; the current operational follow-up removed Preview targeting. No authorized production runtime SQL session or hosted staging Auth resource was exposed. A dedicated local Supabase/Auth stack has now been tested.
These are access/evidence limits, not negative assertions about all resources owned
by the administrator. No unrelated project was used.

Use [the exact staging procedure](PRODUCTION_RESET_STAGING_SETUP.md),
[release runbook](PRODUCTION_RESET_RELEASE_RUNBOOK.md), and
[provenance worksheet](evidence/production-reset-migration-provenance.json).
Supabase remains canonical; Prisma is for schema/client generation and mirror checks.
The offline bundle now contains three genuine ordered future deltas and no fake history.

## Three coordinated remaining workstreams

1. DBA/deployment: actual connection identities, fresh target ledger/pending-list verification and role ownership. Existing-database-only scope is accepted.
2. Business/financial: historical non-use/recovery certification and payroll acknowledgement.
3. Deployment/release: isolated local restoration of Production and maintenance compatibility; conditional migration authority is supplied, application deployment is separate.

No further broad schema report or Query18/19 repetition is requested. No IPSM production
migration, reset, credential/environment change, merge, application deployment or PR2 work occurred. Preview targeting changed; the separate unintended diagnostic deployment was removed as documented.

## Canonical workspace follow-up

The actual empty history entry now has a supported export representation, tested
with Supabase CLI2.78.1. It is not a fabricated bootstrap migration. The
[canonical workspace](PRODUCTION_RESET_CANONICAL_WORKSPACE.md) contains exactly
three recorded transcripts and three future deltas, with independent SQL checksum
checks. This closes isolated packaging mechanics only. Original bootstrap purpose
remains unknown;
the owner has accepted this explicit existing-database scope; fresh target
verification and the other safeguards are still required. Do not request the two nonempty SQL bodies again.
