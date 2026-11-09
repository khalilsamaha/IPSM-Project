# PR90 — final minimal Production release admission

**Prepared, not executed. Production NO-GO pending the decisions below.** The
exported-database recovery gate is **CLOSED** at `65d1bcb`; do not repeat restoration.
PR92 is code-accepted at `d66e7c0` and remains stacked/unmerged. No implementation
change, new staging requirement or repeated engineering test is needed here.

## GO / NO-GO table

| Gate | Status | Required action |
| --- | --- | --- |
| Four-schema archive recovery | **GO / CLOSED** | Retain the verified private artifact and [recovery evidence](PRODUCTION_RESET_PRODUCTION_RECOVERY.md). |
| Connection identity and recorded history | **GO for supplied evidence** | Administrator verified both Production profiles as effective/login `postgres`; recovered three history rows match. Check only current target drift immediately before release. |
| Reviewed SQL/application compatibility | **GO technically, under continuous maintenance** | Three hashes/mirrors still match; legacy issuance closes only at delta 3. Existing tests cover absent activation and direct legacy-insert rejection. No new test execution claimed. |
| Scoped in-place recovery admission | **NO-GO: owner decision** | Accept the explicitly limited recovery scope, point/data-loss boundary and dependency on the retained managed platform described below. |
| Historical financial limitation | **NO-GO: financial-owner decision** | Sign record B acknowledging the three preserved audit events, or require investigation. No accounting repair is proposed. |
| Maintenance and application release | **NO-GO: release-owner decision** | Name the operator/window, effective writer barrier, approved application SHA/artifact and recovery authority. Deployment/merge need separate authorization. |
| Immediate pre-release checks | **PENDING; required at the window** | Read-only target/history/package, changed-data coverage, role safety, Vercel metadata and writer-drain checks in section 3. No fresh live checks are claimed here. |
| New identifier issuance / normal registration and payment creation | **NO-GO** | Complete record A with substantiated non-use and issuance recovery coverage, then obtain separate activation approval. No activation is part of this package. |

An **inactive, maintenance-only installation** can be considered separately from
reopening business service, but the owner must explicitly accept the continuing
unavailability of new families, students, registrations and numbered payments.
This document does not silently waive an earlier admission requirement. If the
owner requires normal service immediately, defer the entire release until record A
and the later activation decision are complete.

## 1. Proposed in-place recovery boundary — owner acceptance required

Here **in-place** means recovery within the existing IPSM project
`rakzehtbpzseetldbohm`, retaining Supabase-managed PostgreSQL, roles, extensions,
Auth service/configuration/signing keys, Storage service/object bytes and network
configuration. It does not mean recreating a Supabase platform from this archive.

Recovery point: private `ipsm-production-2026-11-09T13-28-09-751Z.dump`, SHA-256
`c81a2e0c02b3cc89631d24fbde536e117c59757273f4d4e3866645a3fda47cfa`.
Its four schemas were restored and verified. The filename is not proof of an exact
database transaction timestamp. Establish the interval from export through the
maintenance freeze; do not silently discard subsequent writes or identifier delivery.

For failure of this **pre-activation** release:

1. Keep all application/import/job writers blocked. Preserve the failure state,
   which files committed, and private post-backup changes before recovery.
2. Prefer rollback of the failing file's transaction or a separately reviewed
   forward correction. The three files are not one atomic release. Do not deploy
   an old writer merely because one migration rolled back.
3. If database replacement is necessary, the DBA prepares an exact object-level
   recovery plan for the affected `public` objects and corresponding Supabase
   migration ledger from the verified archive. Restore data and ledger coherently;
   never edit the ledger alone to mark SQL unapplied. This is recovery of authentic
   history, not migration-history repair or historical-tree replay.
4. Leave managed `auth` and `storage` schemas/data/services intact when they are
   unaffected. Use their archived copies as recovery evidence, not instructions to
   overwrite live sessions or delete users. Recheck application `auth_id` links,
   protected audit content, object ownership/ACLs, constraints and source counts.
   A full four-schema restore over running managed services is **not** authorized.
5. Any replacement must use a reviewed FK-safe object plan, preserve grants/RLS/
   triggers, and stop on errors. There is no generic `DROP SCHEMA ... CASCADE`,
   `--no-owner`, trigger bypass or canned destructive rollback command in this
   package. The actual Production restore operator must have the needed privileges;
   local `supabase_admin` restore success does not grant that role in Production.
   If managed objects need recovery or privileges are insufficient, stop and use
   an authorized Supabase-supported recovery operation.
6. Keep maintenance closed after recovery. Restoring the pre-delta schema removes
   the new legacy-allocation guard; the operator barrier must continue to prevent
   the old application from issuing codes. Re-admit only a reviewed compatible
   database/application pair. No automatic rollback-to-old-app reopening.

This narrow strategy applies only while **no enabled IPSM attestation has ever
been installed for this release**, no activation ID is deployed and no new IPSM
identifiers have been issued. After activation, the existing identifier recovery
contract requires a fresh database/server identity and reconciliation of subsequent
issuance. Do not restore over an active attestation in the same running
database/postmaster or treat this scoped proposal as overriding that contract.

**Owner decision to record privately:** “I accept this existing-platform,
pre-activation recovery boundary; the stated recovery point and reviewed treatment
of subsequent writes; continued maintenance on failure; and escalation if retained
managed services fail. This is not full platform disaster recovery or authority
to lose unreviewed records.” Record owner/date, custody reference, permitted data-loss
boundary and authorized recovery operator. **Currently unsigned.**

## 2. Certifications — evidence supplied, conclusions still unsigned

Use the existing [private records A and B](PRODUCTION_RESET_EXTERNAL_SIGNOFFS.md),
updated with this backup's verified facts. Neither conclusion has been signed:

- **A — namespace and issuance recovery:** approve only after the custodian has
  accounted for deleted/imported/manual/external issuance and the interval after
  the backup. Current empty tables, legacy RCPT 14/STU 5, unknown FAM history and
  successful recovery do not establish non-use of `FAM/STU/RCPT-IPSM-YYYY-serial`.
  Record source/period/custodian, coverage gaps and private manifest hashes; any
  unresolved overlap or gap keeps issuance held. Format approval is already closed.
- **B — financial history:** 505 audits recovered byte-for-byte; three payroll
  events reference absent records, including two missing expense references;
  current payroll/payroll-expense populations in the backup are zero. Acknowledge
  the unknown reason/provenance, preserve the events and do not invent postings.
  This is a snapshot finding, not certification of current accounting completeness.

## 3. Minimum final read-only checks — immediately before release

Use only existing private connections and metadata access. SQL checks run in
READ ONLY transactions, with bounded statement/lock timeouts and `row_security=off`
so hidden rows are errors. Do not log credentials, query text from other sessions,
personal rows or audit payloads. Missing evidence/errors mean STOP.

| Check | Required result |
| --- | --- |
| Target/context | Exact IPSM project and intended database, PG17, effective/login `postgres` in both verified profiles; existing required ownership/privileges retained. Confirm context privately; return names/metadata only. |
| History/package | Existing Query16: exactly `20260731171613`, `20260801163840`, `20260801165129`, counts 0/1/1 and the established MD5s. Verify exact arrays privately, not versions alone. CLI2.78.1 canonical workspace list/dry-run must propose only the three deltas below. Never use `repair`, seed, `include-all` or the repository migration tree. |
| Change/backup interval | Compare relevant schema/guard/FK fingerprints and protected users/audits, identifier source populations and payroll exceptions with the admitted evidence. Counts alone are not equality: use private record fingerprints/change evidence. Reuse existing focused diagnostics only for changed areas. New financial/registration dependencies or unaccounted post-backup writes require review and a current recovery point; the completed restore rehearsal is not reopened. |
| Hold/role safety | Verify writer admission is closed and in-flight transactions drained, using session counts without SQL text. Confirm no client can assume the owner and no role/grant drift invalidates the tested ACL model. Before delta 1 future infrastructure should be absent; unexpected partial installation is STOP. |
| Vercel metadata | Correct IPSM project, current Production deployment/approved candidate SHA and rollback target recorded; no Preview DB/Auth targeting or branch overrides, no old credential-bearing snapshots reinstated. Verify activation key **name absent** for Production/project/deployment configuration, without retrieving values; account for historical snapshots separately. |
| Scheduled writers | Named operator confirms all three cron endpoints (`finalize-attendance`, `close-stale-shifts`, `close-stale-shifts-late`), imports, direct clients and old deployment URLs are covered by the hold. A closed browser tab is not a barrier. |

There is **no implemented global maintenance switch in this repository**. The
release owner must name an available, authorized ingress/job/client control that
covers these writers and verify it, or admission remains NO-GO. Do not assume an
invented environment flag or an unavailable Vercel feature exists. These are
operator pre-release checks, not checks executed in this preparation session.

## 4. Exact coordinated order — for later separate authorization

1. Accept scope/recovery and financial records; select maintenance-only admission
   or defer until full business-service admission is possible. Pin reviewed SQL
   and the compatible application artifact; identify who can authorize recovery.
2. Establish and verify the writer barrier **before delta 1**. Drain outstanding
   writes and record the final backup/change cutoff. Execute the read-only checks
   above. Keep activation absent. Any unexplained drift stops the sequence.
3. Through the reviewed Supabase2.78.1 canonical workspace, apply only:
   `20261107000000_teacher_guard_parity` →
   `20261107010000_reset_integrity` → `20261108000000_ipsm_identifiers`.
   Preserve the three historical records. Stop on the first error; retain the hold
   even if an earlier file committed. Do not serve writers between files.
4. Read-only database postchecks: exactly the three new reviewed transcripts added,
   preserved guard bytes/ACLs and protected records, valid registration/payroll FKs,
   eight infrastructure tables protected from clients including service_role,
   immutable identifier history and **zero activations/allocations/imports** at
   initial install. Inspect guard/allocator definitions; do not test by issuing a
   Production identifier or executing reset. Existing Query20 is applicable only
   after its tables exist. Unknown results stop rollout.
5. Only with separate deployment authority, promote the pinned compatible PR90
   application artifact, keeping the writer hold. PR92 may be included only if
   separately named in that release scope; its acceptance does not merge/deploy it.
   Check the actual deployment identity/configuration and perform read-only access
   checks. Keep old deployment URLs/jobs blocked. Do not fall back to a writable
   legacy deployment.
6. **End this release phase with issuance held.** Without record A and separate
   activation approval, do not reopen registration/new-family/new-student/numbered-
   payment workflows or claim normal business availability. The simplest safe
   admission is continued maintenance. A later activation/reopening is its own
   authorized operation, not an implicit final command of this plan.

## Compatibility verification and sealed SQL

Focused source review confirms: `lib/business-identifiers.ts` rejects missing/
invalid activation before allocation; family/student/receipt creation uses this
path. Delta 3 replaces the legacy allocator with an exception and enforces
same-transaction allocation/reviewed restoration for new non-null identifiers.
It seeds no enabled attestation. Existing values/read-only history remain usable.
Null identifiers are not a general maintenance barrier; all writers still require
the explicit operator hold. The hold is indispensable before delta 3 and after
any pre-delta recovery.

The existing regression coverage in `tests/business-identifiers.test.ts` and
`tests/ipsm-identifiers.postgres.test.ts` tests these boundaries. No implementation
or migration changed, so completed tests/restores were not repeated. Mirror and
SHA-256 checks alone were repeated for this package:

| Delta | SHA-256 |
| --- | --- |
| `20261107000000_teacher_guard_parity` | `1ae58a128b2a66f0d230cc871fc650153e540aeae1ed2c84dbd3fcceb3979ae6` |
| `20261107010000_reset_integrity` | `14c62b83fbb17bfbfa611b9ffd56deb5ecb1877c7564d28f0054f794e9260bc2` |
| `20261108000000_ipsm_identifiers` | `cc301a2de5947fa90b8309d025737b9bbf548faa809dfbcbb37ae68211c9f549` |

The three existing historical versions are **not** the three future deltas: do
not reapply them. This package performs no merge, deployment, migration, reset,
configuration/permission change or identifier activation.
