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

During implementation, the sandbox denied TCP and Unix sockets, preventing the
connection-based runner. PostgreSQL 18 single-user mode successfully applied the
baseline/corrective migrations and ran `reset-integrity.sql`; this verifies SQL
syntax and those assertions, **not** multi-connection isolation or Prisma/Postgres
execution. Those integration checks remain a review/rollout gate until run in CI
or another disposable environment supporting sockets.

The local `prisma:generate` command exited successfully, but the sandbox blocked
its generator child process. The installed Prisma generator was invoked directly
through its JSON-RPC interface to regenerate the client used for type checking
and build validation. CI must also verify the normal generation command. No
generated client or dependency changes are committed.
