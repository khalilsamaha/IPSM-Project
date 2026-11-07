# Production Reset — integrity release (PR 1)

Production Reset at `/settings/production-reset` requires an active, non-archived
SUPER_ADMIN. Preview and execution each verify the profile in PostgreSQL; the
server action also validates the authenticated session. ADMIN, RECEPTION,
inactive and unauthenticated callers cannot preview or execute a reset.

This release keeps six categories. Every selected category includes all dates
and statuses, including archived, cancelled, voided and historical records.
There is no automatic demo-data detection.

| Category | Deletes | Dependencies / survivors |
| --- | --- | --- |
| Operational Data | Enrollments, registration attempts, lessons/attendance, recurring patterns | Does **not** imply Financial Data. Allocations or payroll history block unless Financial Data is explicit. |
| Financial Data | Payments, allocations, receipts, expenses, shifts (including closed/auto-closed snapshots), payroll and payroll items | Surviving enrollment charges/discounts are unchanged; paid becomes zero and remaining becomes the unchanged final fee. Invalid original charges block. Registration payment links are cleared; academic completion and idempotency are preserved. |
| Schedule Data | Lessons/attendance and patterns | Retained enrollment dependencies block; explicitly include enrollments. Payroll/postings block unless Financial Data is selected. |
| Students / Families | Students, families and dependent enrollments, registrations, lessons and patterns | Family payments and enrollment allocations require Financial Data. |
| Teachers | Teachers, assignments, all availability, lessons and patterns | Retained teacher-linked enrollments block, including archived records. Payroll/postings require Financial Data. No implicit teacher unassignment. |
| Seasons | Seasons, enrollments, registrations, recurring patterns, season-, enrollment- or pattern-linked lessons, seasonal pricing and availability | Global prices/availability and standalone lessons without a season, enrollment or pattern survive. Financial dependencies require Financial Data. |

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

Preview/execution acquire a short, ordered PostgreSQL write barrier across the
observed application tables before taking their serializable snapshot. Normal
reads remain possible; competing writers wait. Lock wait is limited to five
seconds and the transaction to sixty seconds. Competing resets serialize.
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

Family, student and receipt allocation now uses protected, atomic yearly counters.
The migration reserves identifiers from existing rows, receipts and recoverable
audit metadata. Retention triggers also reserve explicitly imported identifiers,
advance counters and reject reuse by a different record. Issued identifiers are
immutable, including clearing a payment number or transferring a receipt to another
payment. Repair of a missing payment number reuses its existing receipt number.
Counter gaps after failed creation are acceptable; reuse is not.
Existing mismatched receipt identifiers require reviewed reconciliation; automated repair may no longer rename an already issued identifier.
Identifiers existing only in previously exported/deleted material cannot be
recovered automatically: review historical high-water marks before migration.

## Always protected

- Application users, all roles/statuses and SUPER_ADMIN identities.
- Supabase Auth users and sessions; no Auth administration API is called.
- Existing audit logs; each successful reset adds a transactional audit entry.
- Issued identifiers, counters, registration tombstones and reset history.
- Database schema/migrations, roles/permissions, RLS, functions/triggers/indexes.
- Supabase configuration/secrets, Storage objects and production backups.
- In PR 1: courses, levels, global pricing, rooms, closures and operational settings.

Operational defaults remain attendance auto-finalization enabled, a 15-minute
grace period and payable missed lessons disabled. PR 1 does not change settings.

## Staged expansion (PR 2 — not available in this release)

PR 2 is gated on PR 1 review and validation. Its eight intended independent
controls are Courses / Instruments, Course Levels, Global Course Pricing, Rooms,
School Closures, Operational Settings (restore defaults), Teacher Availability,
and Teacher Course Assignments. None is accepted by PR 1 server validation.
Configuration resets must preserve historical enrollments or block. Removing
closures must not claim to regenerate skipped lessons. Settings restoration must
audit previous/restored values. No user/account or audit-log deletion is planned.

## Migration, validation and recovery

See `docs/PRODUCTION_RESET_DATABASE.md`. Apply only reviewed additive migrations;
this implementation task does not authorize production migration or execution.
Confirm backup/restore procedures in a disposable environment before use.
Rollback protects failed operations; a committed reset requires restoration from
an independently retained backup, not an application undo button.

Run `npm run prisma:generate`, `npm run typecheck`, `npm test`,
`npm run test:migration`, and `npm run build`. The migration runner creates its own
local disposable cluster and never uses an ambient production DATABASE_URL.
Do not use the Production Reset UI/action as a validation shortcut.
