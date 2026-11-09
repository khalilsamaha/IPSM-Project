# PR90 — canonical Supabase workspace for the existing database

> Current operational evidence (2026-11-08): the owner has accepted the
> existing-database-only provenance scope and supplied conditional migration
> authority. Five shared Vercel variables now target Production only; all 28
> approved old Preview snapshots have been removed. Real local Supabase Auth/browser, scoped
> logical recovery and full physical PostgreSQL recovery have passed. Production roles, recoverable platform backup,
> hosted isolation and business certifications remain pending. See the
> [operational rehearsal](PRODUCTION_RESET_OPERATIONAL_REHEARSAL.md), including
> the removed unintended diagnostic deployment and production-backup evidence limit.
> Earlier access/authorization statements below describe their historical stage.

**Production NO-GO; draft PR90.** The recorded-history packaging problem can be
resolved without inventing bootstrap SQL or altering the production ledger. This
workspace is an incremental release against the independently reviewed existing
schema. It cannot reconstruct that schema on an empty database.

## What the zero-statement entry proves

Administrator evidence records `20260731171613` with `statements = ARRAY[]::text[]`,
count zero and empty-text MD5 `d41d8cd98f00b204e9800998ecf8427e`. It proves that the
ledger entry exists with an empty transcript. It does **not** establish whether
someone executed an empty migration, imported a ledger, performed a manual bootstrap,
or used a particular deployment tool. Its original purpose remains unknown. We
attribute no schema objects to this version and do not create substitute bootstrap
DDL, a fictitious original name, or a Prisma ledger.

The installed and reviewed **Supabase CLI 2.78.1** exports each stored array as
`strings.Join(statements, ";\n") + ";\n"`. Consequently, the authentic empty-array
export is exactly the two bytes `;` and LF. This representation is produced by
`migration fetch` itself; it is an archive of the empty transcript, not a claim
that a no-op was historically executed. See the
[tagged fetch implementation](https://github.com/supabase/cli/blob/v2.78.1/internal/migration/fetch/fetch.go).

CLI pending detection matches version prefixes. An already-recorded empty version
is skipped just like the two nonempty versions. It neither needs history repair
nor requires historical SQL execution. CLI matching alone does not check SQL
content, so our verifier separately checks the recorded arrays, file SHA-256s,
future mirrors and exact six-file set. The CLI-created `.temp/cli-latest` version
cache is the only allowed extra metadata; linked project refs and connection
metadata remain rejected. See
[tagged pending detection](https://github.com/supabase/cli/blob/v2.78.1/pkg/migration/apply.go)
and [list implementation](https://github.com/supabase/cli/blob/v2.78.1/internal/migration/list/list.go).

## Exact package and boundaries

Build into a new directory (offline; no connection or credentials):

```bash
node --import tsx tools/production-reset/canonical-workspace.ts /tmp/ipsm-pr90-canonical-review
```

It produces the existing future-delta artifact plus:

- `workspace/supabase/config.toml`: unlinked release project; migrations enabled,
  seed disabled, PostgreSQL17; no keys, roles, seed files, vault settings or secrets.
- `workspace/supabase/migrations/`: precisely the following six SQL files.
- `workspace-manifest.json`: source-verified SHA-256s, CLI version, evidence limits.
- `recorded-history.json`: the reviewed statement arrays and fingerprint metadata.
  The two nonempty arrays are serialized from the **already approved** repository
  transformations, with their known MD5 and character-count assertions. This does
  not reopen their completed semantic/body comparison.

| Version | Content / treatment |
| --- | --- |
| 20260731171613 | Exact empty-array export; already recorded, never bootstrap it. |
| 20260801163840 | One stored statement, MD5 `d34257683e5172ad7b1ede576a4b2591`; already recorded. |
| 20260801165129 | One stored statement, MD5 `6c4135265819300dd72a0fbc476f80c2`; already recorded. |
| 20261107000000 | Pending teacher guard parity; approved live guards preserved. |
| 20261107010000 | Pending reset integrity and security. |
| 20261108000000 | Pending IPSM identifier infrastructure; no activation seeded. |

History filenames use `_recorded_history.sql` as an explicitly descriptive local
suffix. Original `name` fields were not supplied and remain unknown; the suffix
does not assert them. CLI matches timestamps, not names. A fresh private fetch may
retain actual names; do not silently change this sealed artifact—review and rebuild
its manifest if filenames change. Empty array is not interchangeable with SQL NULL.
No historical or future repository migration file was rewritten.

`verifyCanonicalWorkspace()` rejects changed SQL even when an artifact manifest is
also edited, unexpected migration/config files, changed recorded arrays and mirror
drift. `verifyRecordedRemoteHistory()` requires the exact known ordered prefix and
array content; absent/extra/changed versions block. After partial application,
future transcript review is explicitly required, not inferred from version presence.
The builder and verifier are offline; they are not production connection wrappers.

## Real CLI / PostgreSQL17 rehearsal

With the reviewed CLI installed, run:

```bash
PG_BIN=/usr/lib/postgresql/17/bin IPSM_TEST_SUPABASE_CLI=1 npm run test:migration
```

This starts a fresh marked loopback cluster, verifies the server identity, and
clones the sanitized pre-delta fixture into a separate disposable database. Only
that fixture receives synthetic copies of the three recorded history rows. This
is test setup, not production history repair. The history reader is a separate
SELECT-only role with default read-only transactions. The migration role is the
existing synthetic non-superuser schema owner. No CLI link, remote service,
production token, `repair`, `include-all`, seed, or repository-tree replay is used.

The real CLI test verifies fetch bytes (including `;\n`), list matching, exact dry-run
order, missing/extra-version rejection, content drift detection beyond CLI matching,
application of only three deltas, preservation of old ledger rows and guard bodies,
and a second push with no application. A lost future ledger row produces a DDL
error rather than silently reapplying or repairing history. The ordinary hosted
suite always runs offline workspace tests; real-CLI testing is explicitly opted
in and fails if CLI2.78.1 is absent/different. No mocked CLI success is claimed.

## Remaining authorization and evidence

The local workspace may be certified for the tested **existing-database** mechanics.
It cannot certify current production connection identity, current ledger state,
complete bootstrap lineage or authorization to release. Release owners must:

1. Preserve the scope already accepted by the owner: preserve the recorded empty transcript, leave its
   original purpose unknown, and release only against the independently verified
   existing schema. If policy instead requires complete original bootstrap
   provenance, obtain the original deployment artifacts/operator attestation; the
   empty record cannot supply that evidence. Do not repair history to manufacture it.
2. Through an existing authorized IPSM connection, refresh the three version/count/
   MD5 results immediately before release (Query16 suffices). Privately verify exact
   arrays and package checksums, then inspect `migration list` and `db push --dry-run`
   using the isolated release workspace and reviewed CLI. Require exactly the three
   future versions in order. Do not accept suggested `repair`/`include-all` remedies.
   CLI2.78.1 dry-run only reads the pending list: [tagged implementation](https://github.com/supabase/cli/blob/v2.78.1/internal/db/push/push.go).
3. Close the independent role, Preview/Auth isolation, identifier non-use/recovery,
   financial acknowledgement and platform backup/restore gates. Conditional authority
   covers the three reviewed deltas only after safeguards pass. Application deployment
   remains separately controlled. No production migration was executed.

Use an existing secure direct connection mechanism; do not use a linked CLI login
flow that creates temporary database roles. The isolated fixture alone sets
PGSSLMODE=disable; retain production TLS requirements. Never paste credentials into reports,
commits, logs or shell history. No new broad schema report or teacher-body comparison
is required. No fresh-install, `db reset`, or historical-tree replay is supported by
this incomplete historical transcript.

## Recorded validation

[Canonical workspace evidence](evidence/production-reset-canonical-workspace.json)
contains all six SQL SHA-256s, tool identity, log hashes and limits. Final local
checks passed: Prisma5.22 generation, TypeScript, 436 unit tests, all 207 disposable
PG17 tests (including seven real-CLI tests), migration/redaction fixtures and build.
The 40 Dashboard tests run both before and after the foundation delta. Hosted CI
runs 436 unit tests and the existing 200 database tests; real-CLI tests require
the explicit flag and pinned installed binary and are not claimed as hosted.
The build retains its pre-existing nonfatal ESLint compatibility warning.
Changing the CLI version or package bytes requires a new reviewed rehearsal.
