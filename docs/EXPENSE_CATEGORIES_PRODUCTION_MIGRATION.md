# PR94 expense-category migration — blocked, not applied

On 2026-11-12 the owner authorized **only** the tracked
`20261112000000_expense_categories` Production migration and necessary verification.
The attempt stopped before any database write because the approved direct PostgreSQL
connection returned **Network is unreachable** from the executing environment.
No pooler or alternate project was substituted. No automatic retry or repair occurred.

[Sanitized evidence](evidence/expense-categories-production-migration-20261112.json)
records the exact results. Starting PR head
`94a3122fb6fc13a9c60158d8aa9c3fe6525e2824` was verified open/draft with successful
[CI](https://github.com/khalilsamaha/IPSM-Project/actions/runs/43186039608).
The local branch was fast-forwarded without discarding or rewriting any commits.

| Check | Result |
| --- | --- |
| Complete original logo for browser/shortcut/Apple icons and login/sidebar | PASS; original SHA-256 unchanged; fingerprint-only PNG and file-based overrides absent |
| Prisma/Supabase migration copies | PASS; byte-identical, SHA-256 `69bc7afdc9ecc543fb8cbbccbd444d721f5f4406255abf44ce1ccddbf4eccd87` |
| Additive SQL scope | PASS; new catalogue only; no existing-expense backfill/FK, destructive operation or global ACL change |
| Name CHECK semantics | REVIEW REQUIRED; see below |
| Supabase CLI | PASS; installed 2.78.1; supported dry-run/push flags inspected |
| Actual current Production database identity, roles and capability | NOT VERIFIED; direct connection failed |
| Current migration history, table absence and expense/data baseline | NOT EXECUTED; no database session established |
| Canonical current-history alignment / one-pending dry run | NOT EXECUTED |
| Migration application | NOT EXECUTED; no migration was applied |
| Post-migration defaults, constraints, RLS, ACLs, history and data preservation | SKIPPED; no migration, and no fresh database baseline available |
| Existing public login service | PASS; unauthenticated GET returned HTTP 200 with IPSM sign-in form at 09:02:20 UTC |
| Authenticated business workflows | NOT TESTED; no login, registration, payment or reset submission |

## Additional SQL review finding

The reviewed CHECK uses `name = btrim(name)` and a positive length. PostgreSQL's
one-argument `btrim` trims ordinary spaces. Consequently a tab-only or newline-only
name satisfies the nonempty/trim conditions. The reserved-name comparison normalizes
whitespace but does not trim the normalized result, so a tab-wrapped `Teacher Payroll`
can also pass. The application normalizes input, but that does not establish the
requested database-level rejection of invalid names.

This is a static SQL-review finding. A synthetic, read-only expression probe was
prepared but **did not execute** because the direct connection failed. No migration
or business logic was changed to address it under this migration-only authorization.
A reviewed correction should explicitly reject leading/trailing whitespace and
whitespace-only values, and trim the normalized reserved-name comparison. Test tabs,
newlines, spaces, mixed case, length boundaries and valid names on disposable PostgreSQL;
review both mirrored files and the revised checksum before authorizing that artifact.

## Resume conditions

1. Restore reachability to the approved IPSM direct endpoint from the executing
   environment. Verify the exact project/database/server, roles and capability;
   collect a fresh read-only migration/schema/data/ACL baseline. No credentials
   should be pasted into chat or committed.
2. Resolve the CHECK review above. Do not silently apply changed SQL under the old
   reviewed fingerprint or claim unexecuted validation passed.
3. Align the existing canonical workspace with the actual recorded history. Its
   old six-file workspace is available but was not certified against today's target.
   Require exactly one pending reviewed migration in the supported CLI dry run;
   then apply once and complete the requested critical postchecks.

Production data, activation, grants, deployed application and Vercel settings were
not changed by this attempt. No new backup/database/infrastructure was created.
The full-logo commit and all feature changes are preserved. PR94 remains draft;
merging and application deployment still require separate owner approval.
