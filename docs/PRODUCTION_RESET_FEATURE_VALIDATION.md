# Fourteen-group reset feature validation

Feature branch: `agent/production-reset-eight-scopes`; stacked on PR #90 at
`f265a8339bc136e44da83faa186db7eeaef6ef59`. Implements issue #91. PR #90's
integrity branch, migrations, dependencies and CI workflow remain unchanged.

## Scope and behavior

All eight additional groups are implemented through the existing planner,
preview, transaction executor and SUPER_ADMIN page. See the fourteen-category
matrix in [Production Reset](PRODUCTION_RESET.md). New configuration selections
never imply enrollment or financial deletion. Known CASCADE/SET NULL FKs are
checked for retained references; unknown FKs continue to block. Eligibility
checks include recurring patterns and lessons whose season is inherited from
the enrollment. Historical and archived dependencies are protected too.

Operational Settings restores the three documented values on `school-default`,
records before/after values in the transactional audit and counts only changed
rows. An absent settings row already means defaults; repeated restoration is a
zero-update operation. Other settings IDs are preserved. Closures do not
regenerate lessons. Global pricing never silently includes seasonal prices.

The fourteen-option UI uses six labeled sections. It displays exact deletions,
updates, retained counts, settings before/after and blockers. The stored preview
policy is version 2; old previews require regeneration. Existing production-only
environment, active SUPER_ADMIN, confirmation, financial acknowledgement,
actor/expiry/one-use, stale detection and transactional rollback protections stay
in force. No second reset engine, migration or client RPC was introduced.

## Local verification — 2026-11-09

- `npm run prisma:generate`: passed with subprocess execution enabled.
- `npm run typecheck`: passed.
- `npm test`: **454 passed**. The planner checks every one of **16,383** nonempty
  fourteen-group combinations, and retains the original 64 six-group cases.
- `PG_BIN=/usr/lib/postgresql/17/bin IPSM_TEST_SUPABASE_CLI=1 npm run test:migration`:
  **240 distinct PostgreSQL tests passed** on PostgreSQL 17.6. Dashboard40 runs
  before and after migrations (280 total executions). Suites: original reset18,
  additional scopes32, security33, teacher parity70, release/recovery9,
  identifiers31, real Supabase CLI7, Dashboard40. Migration fixtures and
  synthetic-secret redaction assertions passed; all three migration mirrors
  remain byte-identical.
- `npm run build`: passed.
  The build uses unreachable loopback DB/Auth placeholders, never production.
  The existing nonfatal ESLint patch compatibility warning remains unchanged.
- Actual local Supabase PostgreSQL 17.6/Auth fixture: verified exact container,
  loopback port and private synthetic marker, then inspected all eight independent
  plans plus all fourteen together inside a **READ ONLY** repeatable-read
  transaction. Expected retained-dependency blockers were reported; all-fourteen
  plan was compatible. Auth user/session counts remained unchanged. No preview
  request was stored and no reset executed there. Returned the local stack to
  its stopped state, preserving volumes.

New PostgreSQL coverage includes standalone groups on empty/populated tables,
archived records, dependent pricing/assignments/availability/enrollments/rooms,
partial seasonal retention, all-fourteen execution, immutable identifiers,
settings audit/idempotence, stale/expired/reused previews, wrong confirmation,
overlapping resets and audit-failure rollback. Existing security, writer
concurrency, balance, payroll, shift and recovery cases remain enabled. Final
identifier-schema tests and release tests verify protected Auth/audit records
across all fourteen groups.

## Delivery boundary

Hosted CI is checked on the final feature commit and reported in the stacked
draft PR. Its existing runner uses PostgreSQL 16; the seven optional real-CLI
cases and PostgreSQL 17 verification above are local, not claimed as hosted.

No known functional defect remains from this validation. Conservative dependency
blockers are intentional: preserve configuration or explicitly select the
necessary records rather than silently detach history. A course with seasonal
pricing may require Seasons, with its documented broader scope.

This is implementation readiness, not production release authorization. Review
and release of the PR #90 foundation, production migration safeguards,
identifier certification/activation and application deployment remain separately
controlled. The owner waived a separate hosted staging project for feature
validation. No production access, reset, migration, activation, deployment or
merge was performed for this feature.
