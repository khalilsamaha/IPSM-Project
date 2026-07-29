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

## Hotfix QA checklist

- Confirm unused season delete succeeds and used season delete is blocked with the archive/close message.
- Confirm archived course, level, and pricing records can be restored; used course/level deletes are blocked.
- Confirm `/students/[id]` and `/families/[id]` can edit existing details and list pages link to them.
- Confirm archived student permanent delete requires typing `DELETE`, does not delete the family, and only deletes orphan payments/receipts.
- Confirm independent-student registration with initial payment leaves `familyId` null and creates a `studentId` payment.
- Confirm later independent-student payments, receipts, and void/reversal update enrollment balances correctly.
- Confirm existing Family / Group payments and receipts still work.

## Hotfix QA: enrollment, teachers, schedule

- Verify an enrollment with no payments can be edited and duplicate season/course/level enrollment combinations are blocked.
- Verify an enrollment with payment items keeps paid amounts unchanged and recalculates remaining balance safely after fee/discount edits.
- Verify enrollment date edits are blocked when existing lessons would fall outside the new enrollment date range.
- Verify lesson booking filters enrollments by selected student, displays read-only season/teacher, blocks enrollments without teachers, derives teacher/season server-side, and blocks manipulated submissions outside season or enrollment dates.
- Verify teacher profile can save multiple course/instrument assignments and availability rules, and duplicate teacher-course-level assignments are blocked.
- Verify Register Student first lesson date min/max follows the intersection of season and enrollment dates and server validation blocks invalid first lesson dates.

## Lessons Schedule revamp QA

- Verify `/schedule` displays the title “Lessons Schedule,” the description, and the tabs Instrument View, Student Lessons, Season Schedule, and Book Lesson.
- In Instrument View, choose a season and instrument and confirm lessons are grouped by teacher with date, time, student, room, level, and status columns.
- In Student Lessons, search by student ID/name/family, select a student, and confirm all of that student’s lessons and action shortcuts appear.
- In Season Schedule, select a season and confirm lessons appear without requiring any other filter. Test Group by Date, Teacher, Room, and Instrument.
- In Book Lesson, select a student and confirm only that student’s enrollments are listed.
- Confirm the selected enrollment derives season and teacher, and users cannot manually choose a different season or teacher.
- Confirm an enrollment without a teacher shows the “no teacher assigned” message and disables booking.
- Confirm date limits match the overlap of season dates and enrollment dates.
- Attempt teacher, student, and room double-booking and confirm each is blocked with a friendly error.
- Edit an existing lesson and confirm the existing schedule record remains visible and editable.

## Phase 1 delivery QA checks

- Confirm `npx prisma migrate deploy` applies the family code migration in an environment with `DATABASE_URL` and `DIRECT_URL` set.
- Verify existing families receive unique `FAM-YYYY-000001` codes and new families receive the next code without reusing deleted or archived records.
- Search families/payments/reports by family code, family name, parent, student name, student code, phone, and email.
- Register a new family with multiple students and confirm only the primary student receives the initial enrollment while all students remain related to the family.
- Confirm new payments, registration initial payments, and expenses only offer Cash and Whish while historical methods display with readable labels.
- Check application tables use `dd/mm/yy`; receipts use `dd/mm/yyyy`; HTML date inputs remain `YYYY-MM-DD`.
- Filter `/payments`, use Today/Yesterday/This week/This month shortcuts, and verify posted totals exclude voided payments while voided total is separate.

## Phase 2 receipts and safe deletion

- [ ] Download `/api/receipts/[paymentId]?layout=a5` and confirm the PDF MediaBox is A5 (`420 × 595`).
- [ ] Print or preview a receipt with long family and student names; verify text wraps inside boxes.
- [ ] Create a payment with many allocations; verify continuation pages are generated and no allocation is omitted.
- [ ] Download `/api/receipts/[paymentId]?layout=a4-two-copies`; verify Customer Copy and School Copy share the same receipt number.
- [ ] Archive an expense, restore it, then archive again and permanently delete it as an admin using the exact confirmation phrase.
- [ ] Attempt permanent deletion of an active expense and verify it is blocked with a friendly error.
- [ ] Verify payments cannot be deleted and must use void/reversal.
- [ ] Verify used enrollments and used room/season/course/level records block permanent deletion and suggest archive/end instead.

## Shift management QA

- [ ] Reception can open only one shift at a time.
- [ ] Payments and expenses created during an open shift show on `/shifts/[id]`.
- [ ] Reception without an open shift sees “Open your shift before recording payments or expenses.”
- [ ] Closing report uses `dd/mm/yyyy` dates and is printable.
- [ ] Closed-shift payments cannot be voided and closed-shift expenses cannot be edited, archived, restored, or deleted.
- [ ] Admin reopen requires a reason and creates an audit log entry.
- [ ] Reclosing recalculates expected cash, declared cash, and difference.
- [ ] Legacy `shiftId = null` payments/expenses remain visible.


## Teacher payroll QA

- Verify completed lessons are payable by default.
- Verify scheduled and cancelled lessons are excluded.
- Verify missed lessons require policy/manual approval.
- Verify duplicate paid sessions are blocked.
- Verify historical rate snapshots do not change after teacher profile rate edits.
- Verify approved and paid payroll records are locked and lifecycle actions are audited.

## Temporary deletion visibility update (July 2026)

Delete access for eligible, dependency-safe records is temporarily visible to all authenticated application roles with `records:write` permission: RECEPTION, ADMIN, and SUPER_ADMIN. Financial safeguards, audit logging, dependency checks, and closed-shift protections remain required.

Expenses now show Delete from the active and archived expense lists. Users must type `DELETE` to confirm after reviewing the date, category, description, amount, payment method, creator, and shift status. Expenses tied to CLOSED shifts remain blocked; OPEN and REOPENED shift expenses may be deleted when all safety checks pass.

Payments and receipts must not expose a normal Delete action. Use the established Void, Reprint, or Regenerate workflows so financial history remains auditable.

Reports now show only filters relevant to the selected report type. Use Reset Filters to clear report filters, and confirm that family/student choices use readable codes and names instead of internal IDs.

## Attendance / monthly payroll

- [ ] Attendance defaults to today and filters by range, teacher, student, activity, status, source, and payroll state.
- [ ] Bulk complete/missed/cancel/revert reports updated, skipped, and blocked counts; cancel requires a reason.
- [ ] Draft, approved, and paid payroll items block attendance changes with a clear reason; audit events contain IDs/statuses only.
- [ ] Scheduled lessons block generation; completed and explicitly approved missed lessons calculate from the rate snapshot.
- [ ] Same/partial/contained overlap is blocked; adjacent periods and different teachers are permitted.
- [ ] Month/year/teacher/status filters, cards, rollup/grand totals, CSV, and print totals agree.
