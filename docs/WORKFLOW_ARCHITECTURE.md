# Workflow Architecture

## Student without family

Students may now be created without a Family / Group. Use this for an independent student when no household payer record is needed yet. Existing family-based students continue to work unchanged.

## Family / Group and payer usage

Payments remain family-based in this phase to preserve existing payment, receipt, and void/reversal behavior. When an independent student needs a payment, the guided registration flow can create a lightweight Family / Group payer record and attach the student before reusing the existing payment allocation service.

This intentionally avoids changing receipt or reversal logic during the UX refactor. A future phase can introduce a first-class payer table if broader payment ownership is required.

## Register Student workflow

The **Register Student** workflow adds a guided path for Admin and Reception users:

1. Choose one explicit registration type: `independent_student`, `new_family_group`, `existing_family_group`, or `existing_student`.
2. Add student details only for new-student paths. Existing or new Family / Group registrations can add multiple students in one submission; existing-student registration only selects the student and does not edit the profile.
3. For multiple students, choose the primary student who receives the enrollment, optional Initial Payment allocation, and optional Book First Lesson in this phase.
4. Select season, course, teacher, Amount Due, and discount.
5. Create the enrollment for the primary student.
6. Optionally record an Initial Payment with existing allocation/receipt rules.
7. Optionally Book First Lesson with existing schedule validation.
8. Review a clear pre-submit summary covering registration type, students, Family / Group, season, course, teacher, amount due, initial payment, balance estimate, and first lesson details.
9. Finish with a success summary and receipt link when a payment was created.

The Students page is now a records/list page for searching, filtering active/archived/all students, archiving, and restoring. It points creation work to **Register Student**. Standalone family, enrollment, payment, and schedule pages remain available for record maintenance and specialized operations.

## Payment workflow

Existing family payment rules are preserved. Independent students can be registered without a Family / Group, but payment collection requires a payer Family / Group record. The registration workflow creates one automatically only when needed for an Initial Payment, avoiding fake family records for unpaid independent registrations.

## Booking workflow

The schedule page now emphasizes full operational visibility through **General**, **Teacher**, **Room**, **Course / Instrument**, **Student**, and compact **Week Grid** views. The default General View uses filters and compact rows instead of relying on an overcrowded calendar grid, while grouped views expose teacher capacity, room occupancy, course/instrument demand, and a selected student's timetable.

The Book Lesson workflow is ordered as season → student → enrollment/course → teacher → teacher availability → date/time → available room → confirmation. ScheduleSession remains the source of lesson records, existing sessions remain usable even without a room or enrollment, and payment logic is not part of this workflow.

Booking validation now blocks teacher, student, and room overlaps; sessions outside the selected season dates; sessions outside linked enrollment dates; and sessions outside active teacher availability windows. Friendly validation copy is intentionally operational: “Teacher is not available.”, “Teacher already has a session.”, “Student already has another session.”, “Room is already booked.”, “Session is outside season dates.”, and “Session is outside enrollment dates.”

## Phase 1 Academic Foundation Workflow

Phase 1 adds academic configuration without changing the finance architecture:

1. Admin configures Courses, Course Levels, and Course Pricing.
2. Reception and Admin use those active Courses and Levels in Register Student.
3. Register Student stores optional `courseId` and `levelId` on Enrollment and copies `Course.name` into the legacy `courseName` field for backward-compatible display, search, and reports.
4. Course Pricing suggests the enrollment fee for the selected Course + Level + Season. If there is no season-specific price, a global Course + Level price may be used.
5. Payments, receipt generation, payment allocation, voids, and reversals remain family-based and unchanged in this phase.
6. Scheduling is not redesigned in this phase; existing lesson booking validation remains the source of truth.

The Enrollments page remains a records page. Register Student is still the primary creation workflow.

## Phase 2: student/family registration architecture

Phase 2 keeps the existing family-based payment allocation, receipt generation, void/reversal, auth/RBAC, and schedule architecture intact. The upgrade focuses on student identity, family detail capture, and a clearer registration workflow.

### Student ID

- `Student.studentCode` stores a unique generated ID such as `STU-2026-000001`.
- New student creation calls the shared student creation helper so IDs are generated consistently.
- The database migration backfills existing students in created order and adds a unique index.
- Search and display surfaces include Student ID where it helps staff identify a student: student list, registration summary/selectors, enrollments, payments, schedule, dashboard, and outstanding reports.

### Family / Group

Family records remain the payer/grouping entity for payments. Phase 2 extends the Family model with optional parent, address, and emergency contact fields. All fields are nullable so existing family records and independent students remain valid.

### Register Student flow

The registration workflow branches into four explicit paths:

1. New independent student: create one student without `familyId`, then create enrollment.
2. New family/group: create family/group parent details, create one or more students, then enroll the selected primary student.
3. Existing family/group: select family/group, create one or more students, then enroll the selected primary student.
4. Existing student: select an existing student and create a new enrollment only.

For multi-student family/group registrations, Phase 2 creates all entered student profiles but creates exactly one enrollment for the selected primary student. Additional students can be enrolled in a follow-up registration.

### Boundaries intentionally unchanged

- Payment allocation remains family-based.
- Receipt generation is unchanged.
- Void/reversal behavior is unchanged.
- Auth/RBAC is unchanged.
- Schedule storage and double-booking validation are unchanged.

## Phase 3 Enrollment Dates, Multiple Courses, and Suggested Pricing

Enrollment remains the season billing record for a student. Phase 3 adds explicit `enrollmentStartDate` and `enrollmentEndDate` fields so a season enrollment can represent full-season or mid-season participation without changing payment allocation, receipt generation, or void/reversal behavior.

The registration workflow defaults enrollment dates from the selected season. Staff can set a custom mid-season start or earlier end date, and server-side validation rejects date ranges outside the season with staff-friendly messages. Existing enrollment rows are backfilled from their season dates during migration.

Multiple courses are modeled as multiple Enrollment records for the same student and season. The uniqueness guard is now the same student + season + course + level combination, which prevents accidental duplicate registrations while allowing combinations such as Piano Level 1, Solfège Beginner, and Music Theory Level 1 in the same season. The legacy `courseName` snapshot remains for compatibility and reporting.

CoursePricing drives suggested fees in Register Student. Once season, course, level, and dates are selected, the UI presents the full-season configured price plus a prorated suggestion. The documented initial proration formula is: `full season price × active enrollment days / season days`, rounded to cents. The suggestion does not override the existing discount/manual adjustment workflow.

## Phase 4 payment visibility upgrade

Phase 4 improves payment discovery and balance review without changing the underlying payment architecture. `Payment.familyId` remains required, `PaymentItem` continues to allocate money to enrollment rows, and existing allocation, receipt, void, and reversal services remain the source of truth.

Payment creation now begins with a searchable Family / Group selector whose option metadata includes family name, parent names, phone/email contacts, student names, and Student IDs. Once a payer is selected, the workflow shows all unpaid enrollment balances for that family by student, season, course, level, amount due, paid amount, and remaining amount. It also summarizes outstanding balances by season so previous unpaid seasons stay visible before the payment is created.

Independent students remain supported through the existing safe behavior: payment collection requires assigning or creating a Family / Group payer record before a family-based payment can be created. The UI explicitly states this instead of implying independent students can be paid without a payer.

The Payments index adds operational filters for Family / Group, Student, Student ID, receipt number, season, payment method, status, and date range. Table columns now emphasize receipt number, payer group, covered students and seasons, allocation count/amount, total, status, and receipt actions while preserving admin-only void access.

Family and Student profile/list surfaces expose current-season balance, previous unpaid balance, and total outstanding so staff can understand balances before entering the payment workflow.

## Phase 5: Season lifecycle architecture

Season status now drives workflow access without deleting historical records. `PLANNED` and `ACTIVE` seasons remain selectable for registration and lesson booking. `CLOSED` seasons stay visible in lists and reports, but server-side validation blocks normal creation of new enrollments and new schedule sessions for that season. Payments and payment allocation are intentionally unchanged so previous unpaid balances from closed seasons remain payable and existing receipts/reversals remain valid.

Season lifecycle transitions are Admin-only actions on the Seasons page: activate, close, archive, and reopen. Closing a season does not mutate existing enrollments, sessions, payments, or expenses; it only changes the season status and writes an audit log.

The season closing report is generated from current normalized records: enrollments provide student/family/course/outstanding totals, non-voided payment items provide received revenue for the season, expenses are date-filtered to the season range, and schedule sessions provide completed/cancelled/missed and teacher summaries. CSV export uses the same report source as the page.

## Phase 6 Scheduling Foundation

Phase 6 adds two lightweight scheduling resources without replacing the existing lesson calendar workflow:

- `Room` stores active or archived teaching spaces with optional capacity and description.
- `ScheduleSession.roomId` is nullable so all existing lessons remain valid after migration.
- Room conflict validation runs alongside the existing teacher and student conflict validation. Only blocking lesson statuses (`SCHEDULED`, `COMPLETED`, `MISSED`) with `archivedAt = null` prevent overlaps; `CANCELLED` or archived sessions are ignored.
- `TeacherAvailability` stores recurring day-of-week availability windows, optional season scoping, optional effective dates, status, and notes.
- Availability helpers calculate total available hours, booked hours, and remaining hours for simple admin/reception planning views.

This phase intentionally keeps the schedule UI familiar: rooms are an optional booking selector, availability is a separate management/reference view, and the calendar is not fully redesigned.

## Phase 10 production readiness flow

Before production handoff, Admin should run Data Integrity Diagnostics from Settings and resolve non-zero findings. Reception workflows continue to use friendly validation messages for registration, enrollment, payment allocation, and schedule conflicts so raw validation errors are not exposed during normal operation.

## Hotfix architecture notes

Payments now support exactly one payer: either `familyId` for Family / Group payments or `studentId` for independent-student payments. Payment allocations remain enrollment-based, so receipt generation, allocation reporting, and void/reversal logic continue to operate through `PaymentItem -> Enrollment`.

Safe delete flows are server-action guarded. Season, course, level, and pricing deletes run dependency checks and redirect with friendly errors. Archived student deletion runs in a transaction, removes schedule sessions, payment items, orphan receipts/payments, enrollments, then the student, and writes an audit log with counts.

## Hotfix: enrollment-teacher-schedule flow

Lesson booking is enrollment-driven. Schedule creation loads the selected enrollment server-side, verifies it belongs to the submitted student, derives `seasonId` and `teacherId` from the enrollment, blocks enrollments without teachers, and validates lesson dates against both season and enrollment ranges before existing double-booking and availability checks run.

Enrollment edits preserve finance history. Existing payment items are not modified; paid cents remain intact and remaining cents are recalculated as `max(0, finalFeeCents - paidCents)`. Enrollment date edits are blocked when any existing scheduled lesson would fall outside the new range.

Teacher profile management centralizes teacher details, `TeacherCourse` course/level assignments, availability rules, and schedule summary so booking can continue to use teacher availability without requiring users to jump between separate screens.

## Lessons Schedule workflow architecture

The Schedule module keeps `/schedule` as the route but organizes daily scheduling into Instrument View, Student Lessons, Season Schedule, and Book Lesson.

- **Instrument View** reads schedule sessions through enrollment course data and groups matching lessons by teacher so multiple teachers can teach the same instrument without hiding student, time, room, level, or status details.
- **Student Lessons** starts from student search and then shows all lesson records for the selected student with related enrollment, teacher, room, and season context.
- **Season Schedule** starts from the active/current season and fetches all season lessons without requiring additional filters. Simple grouping toggles change only presentation, not the underlying schedule records.
- **Book Lesson** is enrollment-driven. After student selection, the enrollment list is filtered to that student. The server derives student, season, teacher, instrument/course, and level from the enrollment and validates dates, teacher availability, and teacher/student/room conflicts before writing.

Teacher assignment belongs on the enrollment because that is where the school confirms who is responsible for the student’s lessons during the season. Blocking enrollment-without-teacher bookings prevents accidental lessons with incomplete operating and payroll context.

## Phase 1 delivery architecture notes

- Family codes are stored on `Family.familyCode` (`family_code`) with a unique constraint. New codes are generated transactionally with an advisory lock and yearly sequence format `FAM-YYYY-000001`; existing rows are backfilled by migration in creation order.
- Student activities remain enrollment-scoped. Registration creates students and one enrollment for the selected primary/existing student, so a student can hold multiple activities through multiple enrollments.
- New transaction payment methods are centralized in `lib/payment-methods.ts` and limited to `cash` and `whish`; display helpers continue to label historical methods.
- Date display helpers are centralized in `lib/records/format.ts`: tables use `formatDate` (`dd/mm/yy`) and receipts/formal documents use `formatFormalDate` (`dd/mm/yyyy`). HTML date inputs continue to use ISO values.
- Payments summary cards and daily breakdown are computed from the current filters and exclude voided payments from posted/net totals.


## Teacher payroll workflow

Payroll generation flows from teacher/period selection to payable lesson review, draft creation with rate snapshots, approval, payment, and audited cancellation. The system queries only unpaid payable lessons and persists payroll items to protect historical rates and prevent duplicate payment.
