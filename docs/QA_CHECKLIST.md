# Final MVP QA Checklist

Use this checklist before promoting the IPSM MVP to production. Run it against a seeded preview Supabase project first, then repeat smoke checks in production after release.

## Test accounts and roles

- [ ] Create or identify one `ADMIN` staff account in Supabase Auth with `app_metadata.role = "ADMIN"`.
- [ ] Create or identify one `RECEPTION` staff account in Supabase Auth with `app_metadata.role = "RECEPTION"`.
- [ ] Confirm missing/unknown role metadata defaults to Reception-level access and does not expose admin-only actions.

## Global route protection and console QA

- [ ] Logged-out users visiting `/`, `/dashboard`, `/families`, `/students`, `/teachers`, `/seasons`, `/enrollments`, `/schedule`, `/payments`, `/expenses`, `/reports`, or `/users` are redirected to `/login`.
- [ ] Public routes are limited to `/login` and `/forgot-password`.
- [ ] Logged-in users visiting `/login` or `/forgot-password` are redirected to `/dashboard`.
- [ ] Page refresh preserves the authenticated session on protected routes.
- [ ] Browser console has no critical errors during navigation, filtering, create, archive, export, receipt download, or void flows.
- [ ] Network tab shows private data requests returning `401`, `403`, or redirects when unauthenticated.

## Dashboard

- [ ] Dashboard loads for Admin and Reception.
- [ ] Metric cards match seeded data totals for active students, active enrollments, outstanding balances, recent payments, and upcoming sessions.
- [ ] Empty states appear when no upcoming sessions, payments, or outstanding balances exist.
- [ ] Responsive layout remains readable on mobile, tablet, and desktop widths.

## Families

- [ ] Family create form requires a name and validates invalid email values.
- [ ] Search filters by family name, email, or phone without console errors.
- [ ] Archive action prompts for confirmation and removes the family from active workflows.
- [ ] Student count column matches related student records.

## Students

- [ ] Student create form requires family, first name, and last name.
- [ ] Date of birth, email, phone, and status fields save correctly.
- [ ] Search filters by first name, last name, or family name.
- [ ] Archive action prompts for confirmation and hides inactive records from active workflow selectors.

## Teachers

- [ ] Teacher create form requires full name and validates email and hourly rate field types.
- [ ] Hourly rate displays as currency after save.
- [ ] Search filters by teacher name, email, or phone.
- [ ] Archive action prompts for confirmation and removes archived teachers from active enrollment/schedule selectors.

## Seasons

- [ ] Season create form requires name, start date, and end date.
- [ ] Planned, Active, Closed, and Archived statuses display with consistent badges.
- [ ] Search filters by season name.
- [ ] Archive action prompts for confirmation and removes archived seasons from active workflow selectors.

## Enrollments

- [ ] Enrollment create form requires student, season, course, and fee.
- [ ] Optional teacher assignment saves and displays correctly.
- [ ] Final fee and remaining balance reflect fee minus discount.
- [ ] Duplicate student/season/course combinations are rejected by the database constraint.
- [ ] Ending an enrollment prompts for confirmation and removes it from active billing workflows.

## Schedule

- [ ] List, calendar, teacher availability, and student views load without console errors.
- [ ] Schedule create/edit form requires student, teacher, date, start time, and end time.
- [ ] End time before or equal to start time is rejected with a clear error.
- [ ] Teacher double-booking for overlapping active sessions on the same date is rejected.
- [ ] Student double-booking for overlapping active sessions on the same date is rejected.
- [ ] Cancel and archive actions prompt for confirmation.
- [ ] Teacher availability view highlights gaps and conflicts correctly.

## Payments, receipts, and voiding

- [ ] Payment list filters by family, season, method, and date range.
- [ ] Create payment requires a selected family.
- [ ] Allocation rows only allow positive amounts up to each enrollment's remaining balance.
- [ ] Total payment amount equals the sum of validated allocations.
- [ ] Successful payment creation redirects to payment detail with success feedback.
- [ ] Receipt number is generated and visible on the detail page.
- [ ] Receipt PDF endpoint downloads a PDF and writes an audit log entry.
- [ ] Validation errors return user-facing messages instead of unhandled exceptions.
- [ ] Admin sees the void action on non-voided payments.
- [ ] Reception cannot see or perform payment void actions.
- [ ] Voiding prompts for confirmation, marks the payment as void, writes audit metadata, and reverses enrollment paid/remaining balances.
- [ ] Voided payments are visually marked and cannot be voided twice.

## Expenses

- [ ] Expense create form requires category, date, amount, description, and payment method.
- [ ] Expense list filters by date range, category, payment method, and archived toggle.
- [ ] Expense edit form loads existing values and persists changes.
- [ ] Archive action prompts for confirmation and changes the status badge to Archived.
- [ ] Amounts display with expense-specific formatting.

## Reports

- [ ] Revenue report loads with date, family, method, receipt, seasons, courses, and allocation total columns; voided payments are excluded.
- [ ] Expenses report loads with date, category, description, method, amount, and status columns; archived expenses are excluded unless explicitly included.
- [ ] Profit/loss report cards match filtered revenue minus filtered expenses.
- [ ] Outstanding report loads with family, Student ID, student, season, course, level, teacher, and remaining columns.
- [ ] Season closing report requires a selected season and shows payments, outstanding, previous-season unpaid balances, expenses, profit/loss, course summary, teacher summary, and unpaid students.
- [ ] Course enrollment report groups enrollments by season/course/level and uses related course names with legacy course-name fallback.
- [ ] Teacher schedule / availability report shows teacher availability blocks, scheduled sessions, completed sessions, and rooms.
- [ ] Room utilization report shows room capacity, scheduled sessions, completed/cancelled counts, and teachers.
- [ ] Filters for season, date range, course, level, teacher, room, family, student, Student ID, and payment status apply consistently to applicable on-screen reports and CSV exports.
- [ ] CSV export endpoints require authentication and `reports:read` permission.

## Users and RBAC

- [ ] Admin can access `/users` and view staff profiles, roles, and status.
- [ ] Reception cannot access `/users`.
- [ ] Admin and Reception can access Dashboard, Families, Students, Teachers, Seasons, Enrollments, Schedule, Payments, Expenses, and Reports.
- [ ] Admin-only payment voiding is controlled by `finance:delete` permission.
- [ ] Report exports are controlled by `reports:read` permission.

## Supabase schema alignment

- [ ] Prisma schema and Supabase migrations include the same MVP entities: users, families, students, teachers, seasons, enrollments, payments, payment items, expenses, audit logs, and schedule sessions.
- [ ] Migration order is applied from oldest to newest in `supabase/migrations/`.
- [ ] Foreign keys prevent orphaned records where required.
- [ ] Unique enrollment constraint prevents duplicate student/season/course records.
- [ ] Receipt numbers remain unique when present.

## Deployment readiness

- [ ] `.env` and `.env.local` are ignored by Git and not tracked.
- [ ] No Supabase service-role keys, database passwords, access tokens, or Vercel tokens are committed.
- [ ] Required production environment variables are present in Vercel.
- [ ] Supabase storage buckets are configured if receipt/export archival is enabled by the deployment.
- [ ] Supabase Auth redirect URLs include the production Vercel domain.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] `npm run build` passes; known non-critical framework/dependency warnings are documented before release.

## Phase 10 Final Stabilization QA

### Route and authorization audit
- Confirm `/dashboard`, `/register-student`, `/families`, `/students`, `/teachers`, `/enrollments`, `/schedule`, `/payments`, `/expenses`, and `/reports` require authentication and load for Admin and Reception.
- Confirm `/users`, `/settings`, `/seasons`, `/rooms`, `/teacher-availability`, `/admin/courses`, `/admin/course-levels`, `/admin/course-pricing`, and `/admin/diagnostics` require Admin access and show the friendly Not Authorized state to Reception users instead of throwing or crashing.
- Confirm unauthenticated users redirect to `/login`.

### Data integrity diagnostics
Admins should review `/admin/diagnostics` before production closeout. The page covers payments missing receipt numbers, payments without payment items, payment total/allocation mismatches, negative enrollment balances, sessions missing rooms, duplicate student codes, and duplicate course pricing combinations.

### Layout readiness
- Verify there is no body-level horizontal scroll on desktop or mobile widths.
- Verify the sidebar remains full height on desktop and does not cut off the sign-out control.
- Verify crowded tables scroll inside the DataTable container rather than expanding the body.
