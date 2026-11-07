# PR 90 review and administrator preflight

Review continued from `6031c8242ab5f6f52650b0d761aa1ace37c55a4d` on
2026-11-07. PR 90 remains draft. No production migration or reset is authorized.

## Preview isolation

Preview uses one PostgreSQL **REPEATABLE READ** transaction. Its first data read
establishes the MVCC snapshot; every subsequent count, row hash, dependency query
and financial summary sees that same committed state. Only the stored preview
request is written. Explicit **ACCESS SHARE** locks stabilize table identities
against DDL/TRUNCATE, without blocking ordinary INSERT/UPDATE/DELETE or a reset's
SHARE ROW EXCLUSIVE locks. This is a consistent as-of snapshot, not a promise
that no one has changed data by the time the preview reaches the browser.

Execution retains the ordered **SHARE ROW EXCLUSIVE** barrier and SERIALIZABLE
transaction, current SUPER_ADMIN check, one-use actor-bound request, expiration,
full fingerprint/policy comparison, writer generation guard, and transactional
audit insertion. A preview overlapping a write or another reset can become stale
and must be regenerated. No frontend value can authorize a different plan.

The focused PostgreSQL regression pauses a preview after an early table hash,
checks its granted public-table locks, commits a financial write from another
connection under a short lock timeout, then resumes the preview. Counts, money
and fingerprint equal the pre-write snapshot. Execution rejects that stale
preview. Existing concurrent-reset and stale-writer tests remain in place.

Full-table hashing still costs I/O and holds a snapshot until preview completes;
execution still blocks writes. Large-data timing, vacuum impact, lock contention
and hosting request limits must be checked in isolated staging before rollout.
The data fingerprint is not a complete schema/trigger-program fingerprint.
Execution checks incoming FK columns/actions, but cannot infer arbitrary custom
trigger side effects or RLS behavior. Review those objects and coordinate schema
changes separately; do not execute a reset during a schema deployment.

## Production schema compatibility remains unverified

The Supabase connector denied a read-only query to **only** IPSM project
`rakzehtbpzseetldbohm`. No other Supabase project was queried. Passing isolated
tests demonstrates compatibility with the repository-derived fixture, not the
unavailable production schema. All historical migrations remain unchanged.

| Migration | Compatibility conditions to verify |
| --- | --- |
| `20261107000000_teacher_guard_parity` | Required tables/enums exist with expected column types; rates and session units satisfy checks; no duplicate teacher/course assignment with NULL level; existing same-named indexes/FKs/checks match the intended definitions and are valid. Existing function bodies and trigger definitions must match the reviewed Supabase guards before replacement. `IF NOT EXISTS` alone does not prove parity. |
| `20261107010000_reset_integrity` | Registration references are unique; the new column/tables/functions/triggers do not collide with partial/manual installs; receipt numbers have one payment owner; family/student codes are non-null and unique; recovered counters fit INTEGER. Audit links used for payroll backfill must be one-to-one, point to existing rows and agree with the actual posting. |
| Both | The migration role owns or inherits ownership of altered objects, can create objects in public, and can replace/revoke the intended functions. Supabase roles used by REVOKE exist. The application connection can access new protected tables and execute the allocator; RLS must not hide rows from reset counts. |

The integrity migration is transactional and deliberately fails on duplicate
registration references or conflicting receipt owners. It does not automatically
resolve ambiguous payroll history, existing scope violations, unrecoverable
historical identifiers or custom schema drift. Its new tables enable RLS without
public client policies, and function EXECUTE is revoked from PUBLIC/anon/authenticated.
The owner role works in disposable tests; a separate runtime role needs a reviewed
privilege/RLS design. Table grants alone do not bypass RLS. The generation guard
also needs access to its state row, including the privilege needed for FOR SHARE.

Use **one** canonical migration mechanism. Prisma and Supabase copies are mirrors,
not two migrations to apply successively to the same database. Reconcile their
histories first. Neither old migration tree reconstructs the original schema from
empty, and these changes do not repair that historical limitation.

## Exact administrator SQL

For Supabase's web SQL Editor, use the new [numbered Dashboard preflight and
operator checklist](sql/production-reset-dashboard/README.md). Those files use
standard PostgreSQL only, return aggregate findings instead of personal records,
and explicitly distinguish blockers, expected pre-installation absence and
checks still requiring review. Do not paste the psql script below into Dashboard.

The executable [preflight SQL](sql/production-reset-preflight.sql) uses psql
conditionals to handle absent migration-history and reset-infrastructure tables.
An administrator must first verify the connection is IPSM
`rakzehtbpzseetldbohm`; `current_database() = 'postgres'` is not project identity.
Use your existing secure connection mechanism, not credentials in shared logs:

```sh
psql -X -v ON_ERROR_STOP=1 \
  -v app_role=ACTUAL_PRISMA_DATABASE_ROLE \
  -v migration_role=ACTUAL_MIGRATION_DATABASE_ROLE \
  -f docs/sql/production-reset-preflight.sql
```

The script opens a read-only repeatable-read transaction with timeouts and ends
with ROLLBACK. It contains no DDL, record mutations, allocator calls or reset calls.
It reads migration metadata, public schema/FKs/indexes/triggers, narrowly selected
business IDs/amounts, and role grants. It does not read Auth accounts, passwords,
connection settings, secret values, full audit payloads or arbitrary function
source. Argument-bearing trigger definitions are redacted because webhook
arguments can contain credentials. Defaults and function bodies are hashed for local comparison. It runs
successfully against the disposable schema both before and after the new migrations.

Review every result set; zero duplicate rows is only one prerequisite. Missing
core columns, denied catalog/history access, missing roles or query timeouts are
unresolved evidence gaps. Compare guard body hashes/definitions locally against
an isolated schema built from the reviewed migrations. Inspect custom trigger
behavior locally before deciding it is safe. Do not disable constraints, change
production data or apply migrations merely to make the preflight pass.

For payroll discrepancies, reconcile IDs, amounts, payment method, archived state
and historical audit links through a separately reviewed plan. For identifier
high-water marks, compare recovered maxima against exported receipts and older
backups; SQL cannot recover information that no longer exists in the database.

## Vercel Preview is not configured as isolated

Read-only Vercel CLI metadata inspection succeeded using the locally linked IPSM
project/team after the connector returned 404. The project has production branch
`main`, default build/install commands, and no custom migration/reset command.
The inspected deployment for `6031c82` is the feature-branch preview.

`DATABASE_URL`, `DIRECT_URL`, and `NEXT_PUBLIC_SUPABASE_URL` each have a **single
shared environment entry targeting both production and preview**. An explicit
query for `agent/production-reset-integrity` returned no branch-specific overrides.
Values were neither decrypted, printed nor saved. These settings do not provide
database isolation. The deployed connection itself was not opened or probed.

Production Reset now requires `VERCEL=1`, `VERCEL_ENV=production` and
`NODE_ENV=production`, including direct library/server-action calls. Ordinary
local development, Preview, Development and unknown runtimes fail closed.
Disposable integration tests use a separate, explicitly constructed client with
strict loopback URL validation and a runner-owned PostgreSQL cluster marker;
test flags alone cannot authorize an application client. This guard protects
this feature only: ordinary app pages
can still use the shared database. Do not use Preview for mutation testing until
separate database/Auth configuration is established and verified by an authorized
administrator. No environment variable or deployment configuration was changed
as part of this review, and no preview reset action was invoked.

## Conditions before approval

1. An authorized administrator runs the preflight on IPSM and reviews differences
   against both migration files; resolve all schema/data/privilege blockers through
   separate, explicitly approved changes.
2. Establish and verify Preview/staging database and Auth isolation before any
   mutation testing; keep reset disabled in non-production Vercel environments.
3. Validate migration ordering, role privileges, backup/restore and representative
   dataset performance in that isolated environment. Review the global SERIALIZABLE
   operational-transaction and writer-guard implications.
4. Retain passing normal hosted CI and local validation. Hosted CI at `4f15cdd`
   passed; the previous billing/tooling blockers are resolved. CI does not
   replace the live-schema preflight or administrator review.
5. Complete human review of PR 90. Keep it draft until accepted; production
   migration, reset, merge and deployment require separate authorization. PR 2
   stays unimplemented.

The earlier preview-safety follow-up at `7430d62` passed normal Prisma generation,
typecheck, 334 unit tests, 16 PostgreSQL integration tests, administrator SQL
before/after migrations, and synthetic-secret redaction. Its build completed successfully
with the existing ESLint patch warning and expected static-data read errors from
the deliberately unavailable local database endpoint. It does not establish
runtime behavior against the production or shared Preview database. No dependency,
lockfile or GitHub Actions workflow changes are included.

The Dashboard-preflight follow-up adds eleven psql-free read-only query files,
12 static SQL safety tests and 18 disposable PostgreSQL checks executed before
and after the fixture's existing migration tests. These cover secret redaction
in defaults, constraints, indexes, policies, triggers, functions and histories;
missing tables, unresolved roles, permission/RLS errors, unsupported SQL and
timeouts; duplicate registration references, conflicting receipt owners and
aggregate historical identifier recovery. Application code, migration files,
dependencies and CI workflow are unchanged by this documentation/test follow-up.
Live compatibility still requires the administrator's reports and review.
