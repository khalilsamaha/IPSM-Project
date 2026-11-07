# IPSM Dashboard preflight — PR 90

Files 01–11 are the initial **SQL Editor alternative** to
[`../production-reset-preflight.sql`](../production-reset-preflight.sql).
They collect evidence for review; they do not certify compatibility or authorize
a migration, reset, merge or deployment. The live IPSM schema remains unverified
until an authorized administrator supplies and reviewers assess these results.
Files **12–16** are the targeted follow-ups to the administrator's November 7
reports; see the [reconciliation matrix](../../PRODUCTION_RESET_RECONCILIATION.md).
The initial reports need not be repeated merely to collect these follow-ups.

## Administrator procedure

1. Open only the [IPSM SQL Editor](https://supabase.com/dashboard/project/rakzehtbpzseetldbohm/sql/new).
   Confirm the project reference **`rakzehtbpzseetldbohm`** in the Dashboard URL
   and that the intended database/branch is selected. A database called
   `postgres`, or a successful query, does **not** prove project identity.
   Do not substitute another project or copy connection strings into the editor.
2. Use an existing authorized administrator connection with catalog/history
   visibility and unfiltered access to the application tables. Do not change
   grants, RLS, roles, schema, deployment settings or environment variables.
   Do not use SQL Editor's impersonation controls to test application users.
3. Use the files from the reviewed PR 90 commit. In a new editor tab, paste the
   **entire contents of one file**, including `BEGIN`, all `SET LOCAL` statements
   and `ROLLBACK`. Clear text selections so Run executes the whole file. Run files
   01–10 in order, one file per execution. Do not paste the psql script, run only
   a highlighted SELECT, combine snippets, or use AI-generated corrections.
4. In **10 only**, replace `REPLACE_APP_ROLE` and `REPLACE_MIGRATION_ROLE` with
   the actual PostgreSQL role names used by Prisma and the migration process.
   These are database role names, not application SUPER_ADMIN/ADMIN roles or
   Supabase Auth identities. Use existing private administrative knowledge;
   do not retrieve passwords, URLs or secrets. Double an apostrophe inside a
   role name when entering a SQL string literal. If the names are unknown, leave
   the placeholders: the report explicitly returns `BLOCKER`. Never assume the
   SQL Editor's `current_user` is the application's role.
5. Run **11 only** if 01 shows **both** identifier tables and
   `expenses.payroll_id` already present. If all proposed objects/column are
   absent, record `11: NOT RUN — expected pre-PR90 absence`. This is not a passed
   post-installation check. Any partial installation or unexpected existing
   object is a blocker requiring reconciliation; do not create objects to make
   11 run. Its missing-table/column errors are blockers, never empty successes.
6. Each completed file must return **one row** with a `preflight_report` JSON
   value. Confirm the matching `query_id`, `completed: true`, `read_only: "on"`,
   `isolation: "repeatable read"`, and that `item_count` equals the number of
   `items`. Save/export the entire JSON value, not a clipped cell or screenshot.
   A success banner with no report, a truncated export, invalid JSON, a missing
   query, a timeout or any error means **verification incomplete / BLOCKER**.
   Do not remove safety statements to obtain results. If a failed transaction
   remains open, `ROLLBACK;` alone closes it without changing data; keep the
   original failure marked as a blocker.
7. Stop dependent checks when a prerequisite fails. Other independent read-only
   sections may still be collected, but the failed section stays blocked. Do not
   apply migrations, grant access, disable RLS, run reset functions or repair
   records during this investigation. Arrange separate review for remediation.

Each file has its own read-only repeatable-read transaction, a **45-second
statement timeout** and **3-second lock timeout**, ending with ROLLBACK. There is
no snapshot spanning all eleven files. Collect them close together, record their
timestamps and any concurrent schema/data changes, and repeat affected sections
if the evidence changes before review. Do not run during a schema deployment.
The timeout is below the Dashboard's documented one-minute query ceiling; do not
increase it or remove it to force a large scan through. An aborted scan is an
evidence gap requiring an approved alternative. [Supabase timeout documentation](https://supabase.com/kb/troubleshooting/avoiding-timeouts-in-long-running-queries-6nmbdN).

`SET LOCAL row_security = off` **does not disable or bypass RLS**: PostgreSQL
rejects queries that would otherwise return policy-filtered results. This
prevents a low-privilege inspector from reporting false zero counts.
[PostgreSQL RLS documentation](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).
The reports intentionally have one result-producing SELECT so the SQL Editor's
last nonempty result is unambiguous even though ROLLBACK follows it.
[Supabase query implementation](https://github.com/supabase/postgres-meta/blob/master/src/lib/db.ts).

## Query map and interpretation

| File | Evidence and blocking conditions |
| --- | --- |
| [01_inventory.sql](01_inventory.sql) | Inspector/server context; all expected core tables; both migration-history locations; all public tables, views, sequences and foreign tables, including objects outside the reset inventory; RLS flags/ownership; proposed-object and payroll-column collisions. Missing core/history tables block verification. New PR90 objects are normally absent before installation; existing ones must be reconciled with history. |
| [02_schema.sql](02_schema.sql) | Catalog columns/types/nullability/default hashes; enums; all public constraints and incoming cross-schema FKs, ordered child/parent columns, FK actions; unique/partial/expression indexes, validity and hashes. Invalid/unvalidated objects block approval. Compare definitions privately with the reviewed migrations. |
| [03_triggers_functions_rls.sql](03_triggers_functions_rls.sql) | Trigger targets, enabled states, type bits, argument counts and definition hashes; function identity, owner, security mode/body/configuration hashes; expected guard presence; RLS policy roles/commands and expression hashes. Missing legacy guards, disabled guards, unknown triggers or differing definitions require review. No trigger arguments, function bodies/configuration values or policy expressions are disclosed. |
| [04_prisma_history.sql](04_prisma_history.sql) | Migration names, checksums, timestamps, applied steps and whether logs exist. Empty/missing history, inaccessible history or unfinished/unrolled-back migrations block review. No logs are returned. |
| [05_supabase_history.sql](05_supabase_history.sql) | Version identifiers only. Empty/missing/inaccessible history is a blocker to reconcile, even if only one migration mechanism was used. No stored SQL statements or arbitrary history payloads are returned. |
| [06_registration_scheduling.sql](06_registration_scheduling.sql) | Duplicate registration enrollment/payment/submission groups, duplicate all-level teacher assignments, invalid rates, availability scope violations, lessons outside eligible availability; exact structure of same-named registration uniqueness indexes. Counts include archived/cancelled history. Any finding blocks approval; missing uniqueness indexes require the proposed correction, not an ad hoc fix. |
| [07_payroll.sql](07_payroll.sql) | Counts of invalid audit references, ambiguous payroll/expense links, missing/unpaid/mismatched/archived postings and unrecoverable paid payroll/expenses. No IDs, names, amounts or audit payloads are returned. All findings require separate financial reconciliation. |
| [08_receipts_balances.sql](08_receipts_balances.sql) | Receipt ownership conflicts, mismatched payment/receipt numbers, orphan receipts, inconsistent original enrollment charges and balances, including voided/archived history. Counts only; any finding blocks approval. |
| [09_identifiers.sql](09_identifiers.sql) | Duplicate/null family/student codes; missing/nonstandard code counts; recovered FAM/STU/RCPT high-water marks by kind/year from current rows and historical audit metadata, next minimum and INTEGER exhaustion. No individual business identifiers or owner IDs are returned. Compare privately with older receipts/backups; deleted history is unknowable from these queries. |
| [10_role_permissions.sql](10_role_permissions.sql) | Explicit runtime/migration roles; required Supabase role existence; effective schema/table/function privileges, ownership inheritance, RLS bypass flags and migration-role default ACLs. Unknown roles block verification. Missing required grants/ownership or possible RLS filtering of reset tables block approval; SELECT grants alone do not prove full visibility. Never grant DELETE on protected users/audit logs merely to satisfy a report. |
| [11_existing_reset_objects.sql](11_existing_reset_objects.sql) | Conditional existing-installation diagnostics: counter kind/year/value, malformed/exhausted counters, reservation counts and historical-only counts, existing durable payroll links. Counter keys outside documented formats are counted, not disclosed. Presence never authorizes replaying either migration. Compare counters with 09; reconcile partial installs first. |
| [12_foreign_key_reconciliation.sql](12_foreign_key_reconciliation.sql) | Exact comparison against the original 46-signature baseline, including the 22 explicitly reviewed live NO ACTION variants. Reports each original mismatch, new drift, validation/deferral properties and the expected absent payroll FK. No FK changes or wildcard acceptance. |
| [13_teacher_guard_parity.sql](13_teacher_guard_parity.sql) | Exact repository body hashes, function attributes/configuration, trigger columns/events and hashes. Supplied availability body matches; schedule and enrollment bodies differ. No function bodies are disclosed or executed. |
| [14_payroll_classification.sql](14_payroll_classification.sql) | Explains the 2 invalid-event / 3 inconsistent-pair findings without adding overlapping counts. Distinguishes absent historical/unresolved pairs, old invalid audit references with a consistent current posting, and live financial mismatches. Counts/flags only; no automatic cleanup. |
| [15_identifier_sources.sql](15_identifier_sources.sql) | Explicit current row/code counts for all four identifier source tables, including empty ones, plus audit-only recoverable maxima and create-event coverage. No family floor or empty-source conclusion is assumed. |
| [16_migration_provenance.sql](16_migration_provenance.sql) | Checks the exact three reported Supabase versions, statement counts/hashes and known guard mentions. No statements/credentials are returned. Missing history columns or denied access remain blockers; hashes do not invent provenance. |

For this reconciliation, run 12–16 as complete independent files, with the same
project, transaction, timeout and result-completeness checks above. Rerun 10 only
after confirming actual runtime/migration database roles using the existing
connection-context procedure in the reconciliation document. Share each full
JSON report and any sanitized errors. Do not run 11 on the confirmed pre-PR90
schema or apply migrations to make it runnable.

FK action codes: `a` NO ACTION, `r` RESTRICT, `c` CASCADE, `n` SET NULL,
`d` SET DEFAULT. Hash equality is evidence of matching text, not proof of safe
behavior. Different PostgreSQL versions can render equivalent definitions
differently. Review custom functions/triggers, search paths, expressions, RLS
semantics and migration collisions privately; share only the assessment and
hashes, never secret-bearing definitions. Both migration trees are mirrors: use
one canonical application path only after separately authorized approval.

`NO_FINDINGS` applies only to the named aggregate check. `REVIEW_REQUIRED` is
deliberate; no report claims the entire database is compatible. A `BLOCKER`, SQL
error, unknown layout/version, missing role, insufficient visibility or omitted
result must remain in the review record. No exception handler converts failures
to zero counts. Neither SQL nor isolated tests can establish complete historical
identifier recovery or safety of arbitrary custom trigger programs.

## What to share for review

Share privately with the PR reviewer:

- Confirmation of project reference and selected branch/database, the PR commit
  used, run times, and the two **role names only** (or `unknown`).
- Complete `preflight_report` JSON for every completed query, named `01.json`
  through `11.json`, retaining `item_count`, timestamps, statuses and all items.
- A checklist of all eleven query IDs with `completed`, `blocked` or the explicit
  query-11 pre-installation exception. Include errors' query ID, SQLSTATE if
  available, and a sanitized message; redact any incidental personal/secret
  values from errors. Do not share SQL Editor connection details or screenshots
  of unrelated panels.
- Notes about missing history, unknown roles, truncation/timeouts, concurrent
  changes, differing hashes and privately reviewed custom object semantics.

Do **not** share credentials, connection strings, Auth/session data, account
rows, family/student/teacher records, receipt documents, full financial audit
JSON, migration log text, webhook arguments, function source/configuration
values, or raw constraint/index expressions containing literals.

The companion tests execute these exact files against the owned PostgreSQL
fixture, before and after its existing migration tests, and check redaction,
missing objects, placeholder roles, permission denial and RLS filtering. They do
not contact the Dashboard or live IPSM database. Successful local/CI validation
therefore demonstrates SQL compatibility with that fixture, not a completed
live-schema review.
