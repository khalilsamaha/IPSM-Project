# Administration enhancements — development only

The initial Production migration attempt was blocked by direct IPv6 connectivity.
R1 subsequently corrected and locally validated the name CHECK. On 2026-11-12,
the owner manually executed the corrected expense-category SQL in the intended Supabase
SQL Editor and reported successful core postchecks: eight active unique defaults,
RLS enabled, no client policies or unintended privileges, the reviewed CHECK and
unique index, and one manually registered migration-history version. This was **not**
a Supabase CLI push; the history entry has NULL statement metadata. A complete
pre/post Production data comparison and independent project-identity verification
were not obtained. Do not replay or blindly repair the version. See the
[execution report](EXPENSE_CATEGORIES_PRODUCTION_MIGRATION.md) for the evidence
and original failure history.

## Payments

`/payments/new` reveals all eligible family enrollments when Manual is selected,
with per-student/activity/level/season context, live allocated/unallocated totals,
per-enrollment limits and blocking validation. Automatic preview uses the same
oldest-first helper as the authoritative service. Switching modes preserves entered
manual values locally but does not submit them in automatic mode. The request UUID,
server allocation service, receipt creation, audit and payment idempotency remain
unchanged. Authoritative save rechecks current balances and shift requirements.

## Expense categories and migration review

The single additive delta `20261112000000_expense_categories` is mirrored in
`prisma/migrations` and `supabase/migrations`. Supabase remains the canonical
future migration mechanism; do not run both copies. The reviewed SQL was manually
applied to Production by the owner through the Supabase SQL Editor, and migration
history was manually registered once. Do not reapply the migration. No historical
expense records or migration files were intentionally rewritten. Before any later
migration, reconcile the ledger with the canonical workspace.

One catalogue table, a case-insensitive unique-name index and a name CHECK are
added. Defaults: Rent, Electricity, Cellphone, Ogero / Internet, Water, Maintenance,
Office Supplies, Other. There are no added expense columns/FKs/backfills. Existing
`expenses.category` remains the immutable-on-catalogue-change reporting snapshot.
Renaming affects future selections only. Archive removes a choice from new entries;
restore makes it available again. No category deletion operation is exposed. All
fourteen reset groups preserve the catalogue, which has no reset dependency.

SUPER_ADMIN/ADMIN may create/rename/archive/restore. Every management call checks
an active, unarchived database profile and audits before/after in the same transaction.
RECEPTION can select active choices, but forged management calls are denied. The
selector's top `+ New category` control and management page are administrator-only.
Legacy or archived labels can be retained while editing their existing expense;
clients cannot use that historical option to introduce a new arbitrary label.
Other is the permanent fallback and requires a descriptive note (8+ characters,
not merely “Other”/“Miscellaneous”). No historical expense is retroactively altered.
Payroll-linked and legacy Teacher Payroll postings are protected from ordinary
expense edit/archive/restore/delete, and that reserved category cannot be created
or selected manually. Use the established payroll workflow.

Creation/selection/archive races are serialized with row locks; expense save and
audit are transactional. RLS is enabled with no client policies; all creator-default
ACL grants on the new table are revoked, including inherited grants and PG17
MAINTAIN. Existing owner-backed Prisma access is required; a different backend role
requires separate reviewed permission provisioning. Global ACLs and unrelated
objects are untouched. The migration is transactional and rejects duplicate application.
After catalogue use begins, rolling back code does not justify dropping history.

## Branding and receipts

The official supplied IPSM JPG remains byte-for-byte unchanged. The login, sidebar, browser favicon, shortcut icon and Apple icon all use the entire original logo (fingerprint, IPSM wordmark and full institute name), without cropping or replacing any of its elements. The separate fingerprint-only favicon candidate was rejected and removed; no recreated artwork or generated favicon is committed. The checksum is protected
by a regression test. See [receipt boundary and future template handoff](RECEIPT_TEMPLATE_HANDOFF.md).

## Delivery boundary

Feature branch `agent/administration-enhancements` permits its own Vercel Git
Preview deployments through `vercel.json`; this does not change the Production
deployment target. The owner reviewed and approved the Preview UI. PR #94 remains
open and Draft pending separate merge approval. No Production application deployment,
Production Reset, or identifier activation change is authorized by this document.
Tests use owned disposable PostgreSQL and local synthetic Supabase Auth/data.

## Local validation (2026-11-12)

Prisma client generation and TypeScript pass. All 483 unit tests pass. The existing
migration/security runner passed on an owned PostgreSQL 17 cluster, followed by
15 focused category/payment integration tests (including both multi-student modes,
receipt/audit idempotency, inactive/archived/Reception denials, rollback, historical
labels, case-insensitive duplicates and all eight PG17 ACL privileges).

Real local Supabase PostgreSQL 17.6/Auth tests used only synthetic users and records,
an internal Docker network and loopback access. SUPER_ADMIN inline creation, ADMIN
rename/archive, Reception selection and forged management denial passed. Manual
family payment posted two allocations, one receipt and audit; A5/A4 PDF generation
passed. Other without a descriptive note was rejected server-side. The login logo
loaded without a session and retained its exact SHA-256. Chromium screenshots at
1440px and 390px widths verified rendered controls, totals, original branding,
no horizontal overflow and no relevant console/framework errors. Browser plugin
was unavailable; the existing local Playwright installation was used instead.
Screenshots remain local review artifacts, not committed business records.
A focused keyboard regression check verified that Enter in inline category creation
creates/selects only the category and leaves a valid surrounding expense unsaved,
with its entered values intact.

The production-mode build passes. Local installed tooling emits an existing ESLint
patch compatibility warning; dependencies and lockfile are unchanged. Hosted CI
performs the clean-lockfile generation/typecheck/unit/migration/build verification.
The PostgreSQL fixtures are deliberately skipped in ordinary unit runs and executed
separately by `npm run test:migration`; skipped unit discovery is not a DB-test pass.
