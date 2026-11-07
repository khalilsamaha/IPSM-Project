# Production Reset database review and validation

Baseline verified through GitHub: `a6abe1e5d1a83e5e6cb24053aa5f6bd3f32c6051`.
Live inspection of IPSM `rakzehtbpzseetldbohm` was denied by the Supabase connector.
No other project was accessed. Repository evidence is not a live-schema attestation.

## Additive migrations

- `20261107000000_teacher_guard_parity` mirrors the existing Supabase-only teacher
  guard migration into both trees. Its idempotent definitions bring the Prisma
  path up to the same availability/scheduling guards and null-level assignment index.
- `20261107010000_reset_integrity` adds missing registration-link unique indexes,
  the payroll-expense FK and unique index, protected reset previews/state,
  registration tombstones, durable identifier counters/reservations, and writer guards.

No applied migration is rewritten. Duplicate registration links intentionally
fail unique-index creation; resolve them by a reviewed data-reconciliation plan,
not automatic deletion. The payroll backfill uses only unambiguous audit links.
RLS is enabled on new infrastructure tables with no public client policy. The
server database role needs access; ordinary Supabase clients must not write them.
Existing RLS policies, roles, authentication and Storage are not changed.

## Known historical gaps

Neither migration tree creates the original `schedule_sessions` table; the early
Supabase reporting migration also expects an enrollment archive column added
later. Neither tree alone is a complete from-empty production history. Do not
pretend that replaying all historical files reconstructs production.

`tests/migrations/reset-baseline.sql` is a test-only baseline generated from the
verified pre-change Prisma schema. `reset-bootstrap.sql` restores the SQL-only
checks and expression/partial indexes and simulates the missing registration
indexes. The runner then applies the real corrective and enrollment-guard SQL.
This establishes a reproducible reset test schema; it is **not** a new production
baseline migration or proof that an inaccessible live database is identical.

Before production rollout, inspect only the IPSM project: table/column inventory,
FK actions (including external schemas), SQL-only checks/indexes, trigger bodies,
RLS/server privileges and both migration histories. Review duplicate registration
links, legacy payroll audit links and identifier high-water marks. Never disable
constraints/triggers to make reset succeed.

## Disposable testing

`npm run test:migration` owns a fresh local cluster under `/tmp/ipsm-reset-tests.*`
and a database named `ipsm_reset_integrity_test`. It starts on loopback, runs the
existing migration fixtures, creates the documented reset baseline, applies the
corrective migrations, runs SQL assertions and the PostgreSQL executor suite,
then stops its cluster. It ignores ambient DATABASE_URL and refuses substitution
with an existing database. Logs are retained in its temporary directory.

The executor integration suite tests cash/Whish/void balances, closed snapshots,
transactional audit failure, competing resets, old concurrent writers, identifier
retention and registration tombstones. Unit tests exercise all 64 existing preset
combinations, executor effects, protected records and server-action authorization.

The initial sandbox-only attempt could not start PostgreSQL or the Prisma
child generator. Validation was subsequently repeated in the primary Kali
checkout with approved subprocess/socket access: normal `npm run prisma:generate`
passed, and `npm run test:migration` passed against a fresh PostgreSQL 18 cluster,
including all 15 connection-based executor tests. No existing database was used.

The migration suite also tests rejection and complete DDL rollback for a misleading
nonunique registration index and conflicting receipt ownership. A successful
legacy upgrade retains the payroll posting amount/payment method, backfills its
unambiguous audit link and seeds receipt counters from historical audit metadata.

The review added coverage for pattern-only lessons, unexpected cascading FKs
between known tables, changed FK actions, partial/settled/fully discounted
balances, and receipt repair/immutability. The full unit suite has 328 passing
tests; PostgreSQL tests are intentionally gated out of the ordinary unit command
and run by the disposable migration runner.

TypeScript checking and the production build also passed. The build reported
ESLint patch compatibility and Supabase Edge-runtime warnings; its successful
exit is not a clean standalone lint result. Next.js's automatic SWC lockfile
edits were discarded, and no dependency versions or lockfile changes are included.

Both new migrations are transactional. Changes made during this review are only
to these new, unpublished migrations; historical files on `origin/main` remain
byte-for-byte unchanged. Deployment still requires real IPSM schema/privilege
verification and migration review. In particular, duplicate registration links,
conflicting receipt owners, ambiguous payroll history, unrecoverable historical
identifier high-water marks and full-table lock/scan costs require attention.
