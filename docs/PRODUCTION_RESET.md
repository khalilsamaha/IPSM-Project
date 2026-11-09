# Production Reset — fourteen groups (live)

Identifier monitoring and administrator-controlled recovery: [runbook](IDENTIFIER_RECOVERY_RUNBOOK.md).

Production Reset at `/settings/production-reset` requires an active, non-archived
SUPER_ADMIN. Preview and execution each verify the profile in PostgreSQL; the
server action also validates the authenticated session. ADMIN, RECEPTION,
inactive and unauthenticated callers cannot preview or execute a reset. Normal
operations require `VERCEL=1`, `VERCEL_ENV=production` and `NODE_ENV=production`.
Local development, Preview, Development and unknown environments fail closed,
including direct preview/execution library calls, even for SUPER_ADMIN.

Only the disposable integration runner has a test pathway: a dedicated client
factory requires Vitest/test mode, matching loopback-only database URLs without
query overrides, the exact test database name and a fresh cluster marker verified
against the connected PostgreSQL server. The allowance belongs only to that
verified client; test flags cannot authorize the ordinary application client or
server actions. Active SUPER_ADMIN checks still apply inside both transactions.

This feature extends the six-category PR #90 foundation to fourteen categories. Every selected category includes all dates
and statuses, including archived, cancelled, voided and historical records.
There is no automatic demo-data detection.

| Category | Deletes | Dependencies / survivors |
| --- | --- | --- |
| Operational Data | Enrollments, registration attempts, lessons/attendance, recurring patterns | Does **not** imply Financial Data. Allocations or payroll history block unless Financial Data is explicit. |
| Financial Data | Payments, allocations, receipts, expenses, shifts (including closed/auto-closed snapshots), payroll and payroll items | Surviving enrollment charges/discounts are unchanged; paid becomes zero and remaining becomes the unchanged final fee. Invalid original charges block. Registration payment links are cleared; academic completion and idempotency are preserved. |
| Schedule Data | Lessons/attendance and patterns | Retained enrollment dependencies block; explicitly include enrollments. Payroll/postings block unless Financial Data is selected. |
| Students / Families | Students, families and dependent enrollments, registrations, lessons and patterns | Family payments and enrollment allocations require Financial Data. |
| Teachers | Teachers, assignments, all availability, lessons and patterns | Retained teacher-linked enrollments block, including archived records. Payroll/postings require Financial Data. No implicit teacher unassignment. |
| Seasons | Seasons, enrollments, registrations, recurring patterns, season-, enrollment- or pattern-linked lessons, seasonal pricing and availability | Global prices/availability and standalone lessons without a season, enrollment or pattern survive unless independently selected; retained dependencies still block. Financial dependencies require Financial Data. |
| Courses / Instruments | All course definitions, including archived | Retained pricing, assignments, availability and enrollments block. No automatic cascade or enrollment detachment. |
| Course Levels | All levels and ordering, including archived | Retained prices, assignments and enrollments block. |
| Global Course Pricing | Only prices with `season_id IS NULL`, including archived | Seasonal pricing survives unless Seasons is also selected. Retained enrollment `pricing_source_id` references block; historical snapshots are not rewritten. |
| Rooms | All rooms, including archived | Retained lessons/patterns referencing rooms block instead of silently clearing room assignments. |
| School Closures | All closures, including archived | Existing lessons, attendance and recurring patterns are unchanged. Removing a closure does not regenerate previously skipped lessons. |
| Operational Settings | **No deletions**; restore `school-default` values | Auto-finalization enabled, grace 15 minutes, payable missed lessons disabled. Preview/audit include previous/restored values; changed rows only count as updates. Missing row already means defaults (zero updates). Other settings IDs are preserved. |
| Teacher Availability | All global and seasonal availability, including archived | Retained teacher-linked enrollments or lessons that may rely on it block. Teachers and assignments survive. |
| Teacher Course Assignments | All teacher-course/level mappings, including archived | Retained availability, enrollments or lessons that may rely on eligibility block. Teachers survive. |

Every group is selectable independently. The preflight may block a selection;
it never adds unrelated academic or financial deletion just to make it work.
Eligibility checks intentionally preserve historical dependencies too, so a later
edit cannot unexpectedly fail a teacher guard. Standalone lessons have no course
relation; their teacher eligibility is preserved conservatively.

Selections that overlap are merged into one deletion per table: Teachers plus
Teacher Availability never deletes availability twice; Seasons plus Global Course
Pricing produces one all-pricing operation. The planner orders children before
parents. Incoming reviewed FKs are also checked for **retained referencing rows**,
including CASCADE and SET NULL relationships. Unknown FKs still fail closed.

For example, deleting a course with global and seasonal prices requires both
Global Course Pricing and Seasons (which includes enrollments and seasonal
prices). Any retained teacher assignment/availability also needs its own explicit
selection. If that broader scope is not wanted, preserve the course instead.
Removing rooms with lessons requires the appropriate explicit schedule/enrollment
scope, and financial history remains separately protected.

## Financial history

Retained charges are checked against the existing application calculation
`max(0, fee - discount)`, including fully discounted enrollments. Fees and
discounts are never rewritten to make a reset pass.

No academic selection silently deletes payments, payroll or posted expenses.
The conservative policy blocks academic resets while payroll or teacher-payroll
postings exist, rather than guessing which historical postings may be discarded.
Financial Data explicitly includes **all** expenses and shifts: closed history is
not rewritten, rebalanced, detached or partially retained. Both financial scope
and a separate financial-history acknowledgement are required. Cash, Whish and
other payment methods are displayed independently. Financial amounts exclude
voided payments and archived expenses, while deletion counts include them.

New payroll postings have a unique `expenses.payroll_id` FK. Concurrent attempts
to post the same payroll cannot create two expenses. The additive migration
backfills only unambiguous existing `mark_paid` / `payroll_shift_reconciled` audit links. Unmatched/ambiguous
legacy postings remain intact and block academic resets; descriptions are never
used to guess a teacher/payroll association. Existing audits preserve financial
context even when an explicitly approved financial reset removes source rows.

## Preview and confirmation

1. Select categories and generate a preview. Counts come from the actual database.
2. Read direct/dependent deletions, updates, financial effects, preserved records
   and blockers. Resolve blockers with explicit selections or preserve the records.
3. Check the review acknowledgement and type `RESET IPSM DATA` exactly. Financial
   Data requires its additional acknowledgement.
4. Execute the stored preview. It is actor-bound, one-use and expires in ten minutes.

The browser submits an opaque preview ID, never an executable deletion plan.
The server reloads the selection and recomputes both the data fingerprint and
policy effects. Same-count row edits invalidate a preview. Unsupported categories,
malformed inputs, expired previews, cross-user references and reused previews
are rejected. Blocked plans cannot execute. Incoming FKs must match reviewed child/parent columns and referential actions.
Unmodeled relationships, changed actions and unvalidated constraints block preflight,
including unexpected cascading links between otherwise known tables.

All affected records are counted once as deletions or updates. The audit entry,
preview consumption, identifier retention and registration tombstones are system
bookkeeping, outside the displayed domain-record totals. The success summary
reports actual affected row counts; a failure rolls the transaction back,
including its audit entry and preview consumption.

## Transactions and writers

Preview uses a repeatable-read MVCC snapshot and ACCESS SHARE table locks.
Counts and fingerprints describe one committed snapshot while normal writers
continue. The read locks prevent concurrent DDL/TRUNCATE from changing table
identities. Only the stored preview request is written.

Execution acquires the ordered PostgreSQL write barrier before taking its
serializable snapshot and recomputes the fingerprint and policy effects. It
rejects previews made stale by concurrent writes or resets. Normal reads remain
possible; competing writers wait during execution. Lock wait is limited to five
seconds and either transaction to sixty seconds. Competing resets serialize.
Application transactions use SERIALIZABLE isolation. An additional database
statement trigger rejects old transactions crossing a reset generation boundary.
Serialization/deadlock failures are surfaced for retry, never silently replayed.

This is a maintenance operation: coordinate normal staff activity and scheduled
jobs to reduce retries and lock contention. Large tables can exceed the preview
or transaction timeout. Fingerprints scan all observed rows; this conservative
implementation favors correctness over very large database throughput.

## Registration and business identifiers

Removed enrollment submission IDs and registration-attempt IDs are permanently
recorded in `reset_registration_submissions`. Database guards reject replay and
the registration action explains that the operator must start a new registration.
Financial-only reset retains enrollment/attempt identities and academic status.

New allocation uses `FAM-IPSM-YYYY-serial`, `STU-IPSM-YYYY-serial` and
`RCPT-IPSM-YYYY-serial`, with atomic BIGINT yearly counters and immutable owner
reservations. Production issuance remains blocked until historical non-use and
recovery coverage are certified and the latest enabled database attestation is
explicitly selected. No activation is seeded. Restores and server restarts require
fresh review before issuance resumes.

Existing identifiers remain unchanged. Payment and receipt share one reservation;
repair reuses an existing original number. Imports and restoration require a
reviewed exact-owner manifest; ordinary creation cannot supply a legacy or arbitrary
identifier. Counters, allocations, activation records, imports and reservations
survive every reset scope. Unpublished allocations roll back with their transaction;
committed numbers remain reserved even after their source records are deleted.

See [identifier implementation and recovery](PRODUCTION_RESET_IDENTIFIER_IMPLEMENTATION.md)
for allocation, legacy compatibility and the independent post-backup issuance
journal requirement. Current rows and recovered audit maxima cannot prove complete
historical issuance or historical non-use of the approved IPSM namespace.

## Always protected

- Application users, all roles/statuses and SUPER_ADMIN identities.
- Supabase Auth users and sessions; no Auth administration API is called.
- Existing audit logs; each successful reset adds a transactional audit entry.
- Issued identifiers, counters, registration tombstones and reset history.
- Database schema/migrations, roles/permissions, RLS, functions/triggers/indexes.
- Supabase configuration/secrets, Storage objects and production backups.

## Feature delivery boundary

The eight additional groups are implemented on `agent/production-reset-eight-scopes`,
stacked on `agent/production-reset-integrity` (PR #90). The integrity branch remains
unchanged. No new migration is needed: all eight categories use existing tables.
The feature neither activates identifier issuance nor changes any infrastructure
ACL, RLS, teacher guard or migration history. Release authorization remains separate.

The UI groups selections under Operational Records, Financial Records, Academic
Records, Academic Configuration, Scheduling Configuration and System Settings.
Preview shows exact retained table counts as well as direct/dependent deletions,
settings values, financial consequences and blockers. Existing six-category
previews cannot authorize the expanded policy; generate a fresh preview.

## Migration, validation and recovery

See `docs/PRODUCTION_RESET_DATABASE.md` and
[administrator preflight and approval conditions](PRODUCTION_RESET_PREFLIGHT.md). Apply only reviewed additive migrations;
this implementation task does not authorize production migration or execution.
Confirm backup/restore procedures in a disposable environment before use.
Rollback protects failed operations; a committed reset requires restoration from
an independently retained backup, not an application undo button.

Run `npm run prisma:generate`, `npm run typecheck`, `npm test`,
`npm run test:migration`, and `npm run build`. The migration runner creates its own
local disposable cluster and never uses an ambient production DATABASE_URL.
Do not use the Production Reset UI/action as a validation shortcut.
