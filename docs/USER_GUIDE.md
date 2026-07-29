# IPSM Music School Management System – End User Guide

## Overview

The IPSM Music School Management System is an internal web application for managing daily music school operations. It is designed for administration users such as Admin and Reception staff.

The system helps manage families, students, teachers, seasons, enrollments, lessons, payments, expenses, reports, and user access.

---

## User Roles

### Admin

Super Admin users have the highest system-owner access. Admin users have operational administrator access to modules, finance, reports, and normal user management, but they do not manage the protected system-owner account.

### Reception

Reception users handle daily front-desk operations such as families, students, enrollments, lessons, payments, receipts, expenses, and reports where allowed.

---

## Dashboard

The Dashboard is the main starting point.

It shows a quick snapshot of:

- Total revenue
- Total expenses
- Net profit
- Outstanding balance
- Active students
- Upcoming lessons
- Recent payments

Use the Dashboard every day to understand what is happening at the school and to access common actions quickly.

---

## Families

The Families section stores parent or household information.

A family can have one or more students.

Recommended workflow:

1. Use **Register Student** when creating a new student registration.
2. Choose **New family**, **New family / group**, **Existing family / group**, or **Existing student, new enrollment**.
3. Add one or more students when the registration belongs to a Family / Group, or select the existing student when only a new enrollment is needed.
4. Create the primary student enrollment, optional Initial Payment, and optional Book First Lesson in the guided flow.
5. Record later payments against the Family / Group when applicable.

---

## Students

The Students section stores student information and is mainly a records/list page.

Students may be independent or attached to a Family / Group. Family / Group is optional and is mainly used for multiple students or shared payer/contact details.

Use this section to:

- Search students
- View active, archived, or all students
- Archive inactive students
- Restore archived students

Use **Register Student** as the main entry point for creating students and enrollments. Keep this page for viewing, searching, archiving, and restoring records; do not use it as the primary creation workflow.

---

## Teachers

The Teachers section stores teacher information and hourly rates.

Use this section to:

- Add teachers
- Update contact details
- Set hourly rate
- Archive inactive teachers

Teachers should be created before enrollments and schedule sessions are created.

---

## Seasons

Seasons represent school periods such as Summer or Winter.

Students are charged by season.

Use this section to:

- Create a new season
- Set start and end dates
- Mark seasons as planned, active, closed, or archived

Create the season before enrolling students.

---

## Enrollments

An enrollment connects a student to a season, course, and teacher.

Example:

- Student: Emma Smith
- Season: Summer 2026
- Course: Piano
- Teacher: Jane Cooper
- Fee: 300
- Discount: 50
- Final fee: 250

Important fields:

- Fee: Original amount
- Discount: Reduction applied
- Final fee: Amount to be paid
- Paid amount: Amount already received
- Remaining amount: Amount still due

Always review the final fee before recording payments.

---

## Lessons / Calendar

The Lessons / Calendar section is used to manage scheduled lessons with operational visibility across the whole school. Existing sessions remain visible even when older records do not have a room or linked enrollment.

Each lesson card or row shows the student, teacher, enrollment, season, course/instrument, level, room, date, start/end time, status, and notes when available. If the session is linked to an enrollment, the course/instrument and level come from that enrollment first.

Available schedule views:

- **General View**: compact all-session list with filters for season, date, teacher, room, course/instrument, student, and status.
- **Teacher View**: selected teacher week, availability windows, booked sessions, remaining free slots, and visible double-booking warnings.
- **Room View**: sessions grouped by room with occupancy counts and free room slots.
- **Course / Instrument View**: sessions grouped by course or instrument so staff can review demand by program.
- **Student View**: the selected student's upcoming schedule.
- **Week Grid**: a compact calendar grid for smaller weekly checks; use grouped/list views when many sessions would overcrowd a calendar.

### Book Lesson

1. Select the season.
2. Select the student.
3. Select the enrollment/course.
4. Select the teacher.
5. Review teacher availability.
6. Select the date and start/end time.
7. Select an available room.
8. Confirm booking.

Schedule validation prevents teacher double-booking, student double-booking, room double-booking, booking outside season dates, booking outside enrollment dates, and booking outside teacher availability. Staff see friendly messages such as “Teacher is not available.”, “Teacher already has a session.”, “Student already has another session.”, “Room is already booked.”, “Session is outside season dates.”, and “Session is outside enrollment dates.”

---

## Payments

The Payments section records money received from families.

Payments are family-based and can be allocated to one or more enrollments.

Recommended payment workflow:

1. Select the family.
2. Review the outstanding enrollments shown for that family.
3. Enter the amount to allocate to each enrollment.
4. Create the payment.
5. Download the receipt.

The system should prevent payments higher than the remaining balance.

If a payment was entered incorrectly, Admin users should void it instead of deleting it.

---

## Receipts

A receipt is generated after payment creation.

Receipts can be downloaded as PDF and shared manually by email, WhatsApp, or printed copy.

---

## Expenses

The Expenses section records money paid by the school.

Examples:

- Rent
- Electricity
- Maintenance
- Instruments
- Office supplies

Enter expenses regularly so financial reports remain accurate.

---

## Reports

Reports help the school understand financial and operational performance.

Common reports include:

- Revenue report
- Expense report
- Profit and loss report
- Outstanding balance report
- Season closing report
- Course enrollment report
- Teacher schedule / availability report
- Room utilization report

Reports can be filtered by season, date range, course, level, teacher, room, family, student, Student ID, payment status, payment method, and expense category where those filters apply. Revenue excludes voided payments and uses the matching payment allocations for the selected season/course/student filters. Expenses exclude archived expenses unless **Include archived expenses** is selected. Outstanding balances are grouped by family, student, season, and course, and season closing reports also show unpaid balances from previous seasons. Course columns use the course relation when available and fall back to the legacy course name for older records.

Use reports weekly or monthly to review revenue, unpaid balances, expenses, profitability, course enrollment, teacher scheduling, room usage, and season closing readiness. Use **Export CSV** on any report to download the filtered table without changing the on-screen filters.

---

## Users

The Users section is available to Super Admin and Admin users. Reception users cannot access user management.

Super Admin can see all accounts, including the protected system owner. Admins can manage normal application access and user roles, but the built-in `admin@ipsm.local` system-owner account is hidden and cannot be edited, deactivated, deleted, or modified by normal Admin users.

Recommended roles:

- Admin: full access
- Reception: daily operational access

Only trusted users should have Admin access.

---

## Search and Filters

Most pages include search and filters.

Use filters to narrow results by:

- Date
- Family
- Student
- Teacher
- Season
- Course
- Status
- Payment method

---

## Recommended Daily Workflow

### Morning

1. Open Dashboard.
2. Review today's lessons.
3. Check teacher and student schedules.
4. Confirm any cancelled or changed sessions.

### During the Day

1. Add new families and students.
2. Create enrollments.
3. Record payments immediately.
4. Download receipts.
5. Add or update schedule sessions.
6. Record expenses.

### End of Day

1. Review payments received.
2. Review outstanding balances.
3. Check expenses.
4. Review reports if needed.

---

## Best Practices

- Create families before students.
- Create seasons before enrollments.
- Create enrollments before payments.
- Review remaining balances before recording payments.
- Void incorrect payments instead of deleting them.
- Check teacher and student availability before adding sessions.
- Keep user access limited to the correct role. Treat Admin users as operational administrators and reserve Super Admin/system-owner access for the protected owner account.
- Sign out when using a shared computer.

---

## Troubleshooting

### Cannot log in

Check that the email is correct, the account is active, and the user exists in the system.

### Cannot access Users

Only Super Admin and Admin users can access User Management. Normal Admin users manage operational staff accounts only; the protected `admin@ipsm.local` system-owner account is visible only to Super Admin.

### Cannot create payment

Possible reasons:

- No amount was allocated
- Amount is higher than remaining balance
- Selected enrollment belongs to another family
- Student has no active enrollment with remaining balance

### Cannot create schedule session

Possible reasons:

- Teacher is already booked
- Student is already booked
- End time is before start time
- Selected enrollment or season is invalid

### Reports look incorrect

Check that payments, expenses, dates, fees, and discounts were entered correctly.

---

## Glossary

- Family: parent or household responsible for students
- Student: learner registered at the school
- Teacher: person teaching lessons
- Season: school period such as Summer or Winter
- Enrollment: registration of a student in a course for a season
- Payment: money received from a family
- Receipt: PDF proof of payment
- Expense: money paid by the school
- Schedule Session: scheduled lesson between a teacher and student

---

## Future Improvements

Potential future improvements include:

- Automated messaging
- Parent portal
- Teacher portal
- Online payments
- Attendance tracking
- Advanced payroll
- Multi-branch support
- Advanced analytics

## Guided registration and booking

Use **Register Student** for the preferred front-desk creation workflow. It supports four explicit registration types:

- **New family**: creates one student under a Family / Group unless payment compatibility requires a payer record.
- **New family / group with one or more students**: creates the Family / Group, creates one or more students under it, and enrolls the selected primary student.
- **Existing family / group, add student**: selects an existing Family / Group, creates one or more new students under it, and enrolls the selected primary student.
- **Existing student, new enrollment**: selects an existing student and creates a new season/course enrollment without editing the student profile.

The workflow creates one enrollment for the selected primary student, can collect an Initial Payment, and can Book First Lesson.

Students do not require a Family / Group unless the school wants a household payer record or multiple students should be grouped together. Payments still use Family / Group as the payer in this phase, so the guided workflow can create a lightweight payer group for an student with a family only when collecting an initial payment. Initial payments continue through existing allocation and receipt behavior. First Lesson booking continues through existing schedule validation, including double-booking checks.

Use **Lessons / Calendar** to book lessons from day, week, teacher, student, or list views. Filters are available for teacher, student, course, season, status, and date.

## Phase 1 Academic Foundation

The Register Student workflow now uses configured academic records instead of a free-text course entry:

- **Course Catalog:** Admin users maintain active and archived courses such as Piano, Guitar, Saxophone, Violin, Dance, Chess, Solfège, and Music Theory.
- **Course Levels:** Admin users maintain ordered levels such as Beginner, Level 1, Level 2, and Advanced.
- **Pricing Matrix:** Admin users configure prices by Course + Level, optionally scoped to a Season.
- **Registration:** Admin and Reception users select Season, Course, and Level from dropdowns. When a matching active price exists, the workflow offers the configured fee as the suggested enrollment amount.
- **Missing pricing:** If no matching price exists, the form displays: “No configured price found. Admin should configure pricing.” Users may continue with a manual fee only where the existing workflow permits manual fee entry.

Existing enrollments remain valid because the legacy `courseName` value is still stored and displayed whenever a related Course record is not available.

## Phase 2 student and family registration

### Student ID

Every student has a generated Student ID in the format `STU-YYYY-000001`. The ID is created automatically for new students and existing students are backfilled during the Phase 2 migration. Use this ID when searching Students, Enrollments, Schedule, Payments, and reports so staff can distinguish students with similar names.

### Independent student

An student with a family is a student record with no Family / Group attached. Use **Register Student → New family** to create one student, continue to enrollment, optionally take an initial payment, and optionally book a first lesson. Because payments remain family-based in this phase, the system may create a lightweight payer Family / Group only when an initial payment is required.

### Family / Group and parent details

A Family / Group can represent a household, sibling group, company group, or other payer/student grouping. Family records now include father details, mother details, address, and emergency contact details. These fields are optional so existing families remain valid.

### Register Student workflow

Register Student supports four clear paths:

1. **New family** — creates one student under a Family / Group and then creates the enrollment for that student.
2. **New family / group with one or more students** — creates the Family / Group with parent details, creates one or more students under it, and creates the enrollment for the selected primary student.
3. **Existing family / group, add student** — selects an existing Family / Group, creates one or more students under it, and creates the enrollment for the selected primary student.
4. **Existing student, new enrollment** — selects an existing student and creates a new enrollment without implying profile editing.

For family/group paths, the registration screen explains that only the selected primary student receives the enrollment in this phase. Other students are created under the Family / Group and can be enrolled next.

### Students page

The `/students` page remains a records and management list for search, filtering, archive, and restore. Use the **Register Student** button on that page for new registrations instead of using inline student creation.

## Phase 3 Enrollment Dates and Pricing

Enrollments now include an enrollment start date and enrollment end date. When Register Student is used, the dates default to the selected season start and end dates, and staff can move the start date later for a mid-season registration. The system validates that enrollment dates stay inside the selected season and shows a friendly error if they do not.

Students may take more than one course in the same season. Register each course as a separate enrollment; the duplicate guard blocks only the same student, season, course, and level combination while allowing different courses or levels.

When season, course, level, and enrollment dates are selected, Register Student shows the configured full-season Course Pricing amount and a suggested prorated amount. The first proration rule is intentionally simple: full price multiplied by active enrollment days divided by total season days, rounded to cents. Staff can still use the full price, the prorated suggestion, discounts, or manual amount adjustments supported by the existing workflow.

The Enrollments page is a management and reporting page. It displays student ID, student, family/group, season, course, level, teacher, start/end dates, amount due, paid, remaining balance, status, and actions to view the student, record payment, book a lesson, or end the enrollment.

## Phase 4 payment balance visibility

The Create Payment screen keeps payments family-based. Staff first search for the Family / Group payer with the searchable family selector, which includes family name, parent names, contact details, student names, and Student IDs in the option text. After selecting a family, the screen shows every open enrollment for that family before money is recorded.

For each enrollment, staff can review Student ID, student name, season, course, level, amount due, paid amount, and remaining balance. A season summary highlights unpaid balances across current and previous seasons, and the Total outstanding line shows the full selected-family balance before allocations are entered.

Students under a Family / Group are not hidden or silently paid under the wrong payer. Because payment records still require a family payer, assign or create a Family / Group payer before collecting payment for an student with a family. The payment form displays this behavior so front-desk staff know why an student with a family may not appear in the payer selector.

The Payments page now supports filters for Family / Group, Student name, Student ID, receipt number, season, payment method, status, and date range. The payment table includes receipt number, Family / Group, student(s), season(s), payment date, method, allocation count/amount, total, status, and actions to view, download the receipt, prepare an email receipt, and access admin-only voiding through the payment detail screen.

Family and Student list pages include balance summaries where applicable: current season balance, previous unpaid balance, and total outstanding.

## Phase 5: Season lifecycle and closing report

Admins manage the season lifecycle from **Seasons**. A season can be **Planned**, **Active**, **Closed**, or **Archived**. Planned seasons can be activated, active seasons can be closed, closed seasons can be reopened or archived, and archived seasons remain historical records rather than deleted data.

When a season is closed, staff can still view the season, enrollments, sessions, payments, balances, and reports. New registrations and new lesson bookings for that closed season are blocked during normal workflows. Payments toward outstanding balances from closed seasons remain allowed from the Payments workflow, so old balances can still be collected and receipts remain valid.

Use **View closing report** on the Seasons page to review the season summary: students, families, enrollments, course breakdown, payments received, outstanding balances, expenses, profit/loss, completed/cancelled/missed sessions, teacher summary, unpaid families, and unpaid students. The full page includes a CSV export link. The general **Reports** page also includes a **Season closing** report option; choose a season and export CSV if needed.

## Phase 6 Scheduling Foundation: Rooms and Teacher Availability

Rooms are managed from **Scheduling > Rooms** by Admin users. Admins can add active rooms such as Room 1, Piano Room, Dance Room, or Theory Room, optionally recording capacity and notes. Archived rooms are hidden from new booking choices but historical schedule sessions remain valid.

When booking or editing a lesson from **Lessons / Calendar**, the room field is optional. Existing sessions with no room continue to work. If a room is selected, the system prevents another active blocking session from using that room at an overlapping time and shows: “Room is already booked during this time.” Cancelled and archived sessions do not block room booking.

Teacher availability is managed from **Scheduling > Teacher Availability** by Admin users. Admins can add, edit, and archive availability windows by teacher, day of week, optional season, effective date range, and notes. Reception users use the schedule teacher view while booking, but do not receive direct access to the Teacher Availability configuration page.

## Sidebar navigation and admin configuration

The sidebar is organized by workflow area instead of placing every setup task under one **School Configuration** menu. Admin users see configuration links next to the area they affect:

- **Daily Operations**: Register Student, Payments, Lessons / Schedule, and Expenses.
- **People**: Families, Students, and Teachers.
- **Academic**: Seasons, Enrollments, and Courses & Pricing.
- **Scheduling**: Lessons / Schedule, Rooms, and Teacher Availability.
- **Finance**: Payments, Expenses, and Reports. Payment Methods and Expense Categories should appear here when dedicated metadata screens are implemented.
- **System / Admin**: Users, School Profile, Receipt Settings, and Advanced Settings.

Reception users see daily operational links, but do not see Users, Advanced Settings, course/pricing management, Rooms management, Teacher Availability management, Seasons management, or sensitive system configuration. If a Reception user manually enters an Admin configuration URL, the application redirects safely or displays a Not Authorized message instead of exposing the page.

## Phase 10 stabilization notes

The final stabilized workflow keeps daily Reception work on Dashboard, Register Student, Families, Students, Teachers, Enrollments, Schedule, Payments, Expenses, and Reports. Admin-only configuration is distributed to the matching sidebar categories: Academic for seasons and courses/pricing, Scheduling for rooms and teacher availability, Finance for reports and future finance metadata, and System / Admin for users, school profile, receipt settings, and advanced diagnostics.

## Hotfix: safe deletes, edit pages, and independent payments

- Students are students under a Family / Group assignment. They can now pay as the direct payer during registration or from **Payments → Create payment** by choosing **Family**; this does not create or attach a compatibility family.
- Family / Group payments continue to use the Family / Group payer and may allocate payments across the family’s students.
- Existing records can be edited from **Students → View/Edit** (`/students/[id]`) and **Families / Groups → View/Edit** (`/families/[id]`). Register Student remains the creation and registration workflow.
- Permanent deletes are intentionally restricted. Unused seasons can be deleted only when they have no enrollments, schedules, prices, or payments. Archived academic configuration records can be restored or deleted only when dependency checks allow it.
- Archived students show a deletion-impact preview and require typing `DELETE`; permanent deletion removes the student’s enrollments, sessions, payment allocations, and orphaned payment/receipt records only when those payments no longer have allocations for anyone else.

## Hotfix: enrollment-driven scheduling and teacher profiles

- Edit an enrollment from **Enrollments → Edit**. The edit page allows safe updates to season, course, level, teacher, dates, fee, discount, and status. Paid payment history is never rewritten; remaining balance is recalculated from final fee minus paid amount.
- Book lessons from an enrollment. Choose a student, then choose one of that student’s active enrollments. The season and teacher are read-only and come from the enrollment. If no teacher is assigned, edit the enrollment first.
- Manage teacher profiles from **Teachers → View/Edit**. The profile contains personal details, courses/instruments taught, availability rules, and a summary of booked and remaining hours.
- During Register Student, the optional first lesson date must fall inside both the selected season and the enrollment start/end dates. The first lesson uses the enrollment teacher.

## Lessons Schedule revamp

The `/schedule` tab is now a school-operations lesson schedule with four simple tabs:

- **Instrument View**: choose a season and instrument to see lessons for that instrument, grouped by teacher with student IDs, names, rooms, levels, enrollment status, and lesson status.
- **Student Lessons**: search a student by student ID, first name, last name, or family/group, then view all lessons, current teachers, instruments, and shortcuts to profile, enrollment, booking, and payments.
- **Season Schedule**: choose a season and immediately see the full schedule. It defaults to a date-grouped agenda and can also group by teacher, room, or instrument.
- **Book Lesson**: select a student, then select one of that student’s active enrollments. The lesson uses the enrollment as the source of truth for season, instrument, level, and teacher.

Lesson booking depends on enrollment because enrollment is the approved academic and billing record. A lesson cannot be booked from a mismatched season or a different teacher than the enrollment teacher. If an enrollment has no teacher assigned, the user must edit the enrollment and assign a teacher before booking lessons.

## Phase 1 delivery updates

### Family codes
Every family/group now has a permanent family code in the format `FAM-YYYY-000001`. The code is generated by the system, is not based on the family name, and should be used when searching for or confirming the correct payer/family.

### Family registration and profiles
Use **Families / Groups → Add Family** to create family records. Family email and family phone are optional. Family profiles show parents, contacts, emergency information, related students, balances, and payment history. The Register Student workflow is organized into clear steps for registration type, family/parent details, student details, enrollment, initial payment, and first lesson.

### Payment methods
New payments and expenses only offer **Cash** and **Whish**. Older historical methods such as card, check, ACH, bank transfer, or other remain readable in payment history and reports.

### Dates and daily totals
Application tables display dates as `dd/mm/yy`, for example `16/07/26`. Formal documents and receipts display dates as `dd/mm/yyyy`, for example `16/07/2026`. Payment daily totals exclude voided payments; voided totals are shown separately.

## Receipt printing and safe deletion

Payment detail pages download receipt PDFs from the receipt API. Use the default A5 layout for email-friendly one-receipt-per-page printing, or add `?layout=a4-two-copies` to print a Customer Copy and School Copy with the same receipt number on one A4 sheet.

Permanent deletion is intentionally limited. Financial records such as payments and receipts are not normally deleted; payments are voided/reversed and receipts are regenerated from the payment. Expenses must be archived before an admin can permanently delete them with the required confirmation phrase.

## Shift closing workflow

Use **Daily Operations → Shift** at the start of each receptionist day. Enter the business date, opening cash, and optional notes. Payments and expenses can only be recorded after the shift is open, and the system attaches them to that shift automatically.

At closing, review opening cash, posted cash payments, Whish payments, cash expenses, Whish expenses, expected closing cash, payment count, expense count, voided payments, and the transaction list. Enter declared cash and confirm the close action. Closed-shift transactions are locked and can no longer be changed by Reception.

Admins can reopen a closed shift only with a reason. The reopen is audited, corrections can be made according to permissions, and closing again recalculates the report totals. Historical transactions without a shift remain valid and are shown as **Legacy / No Shift**.


## Admin: Teacher Payroll

Admins can use `/payroll` to generate teacher payroll from payable lessons only. Select a teacher and period, review eligible completed lessons, manually approve missed lessons when appropriate, add adjustments, then generate a draft. Approve the draft before marking it paid. Reception users do not have payroll access.

## Temporary deletion visibility update (July 2026)

Delete access for eligible, dependency-safe records is temporarily visible to all authenticated application roles with `records:write` permission: RECEPTION, ADMIN, and SUPER_ADMIN. Financial safeguards, audit logging, dependency checks, and closed-shift protections remain required.

Expenses now show Delete from the active and archived expense lists. Users must type `DELETE` to confirm after reviewing the date, category, description, amount, payment method, creator, and shift status. Expenses tied to CLOSED shifts remain blocked; OPEN and REOPENED shift expenses may be deleted when all safety checks pass.

Payments and receipts must not expose a normal Delete action. Use the established Void, Reprint, or Regenerate workflows so financial history remains auditable.

Reports now show only filters relevant to the selected report type. Use Reset Filters to clear report filters, and confirm that family/student choices use readable codes and names instead of internal IDs.

## Daily attendance and monthly payroll

1. Under **Daily Operations**, open **Attendance** (today is selected by default).
2. Review the visible lessons, choose **Mark all scheduled as completed**, confirm, and then change only missed or cancelled exceptions. Cancellation requires a reason.
3. Resolve every Scheduled lesson before generating payroll. Payroll includes completed lessons; cancelled/scheduled lessons are unpaid; missed lessons require explicit pay approval.
4. Under **Payroll**, filter the business month to review totals and teacher rollups, export CSV, or print. Overlapping payroll periods are prohibited. Approved and paid payroll-linked attendance cannot be changed.
# Administration updates (PR 74)

Administrators can edit course/level prices as a matrix and manage multi-teacher assignments from the Administration area. Receipt pages provide a user-initiated **Share receipt** action with native PDF sharing where supported and an honest download-plus-WhatsApp fallback. School dates are entered as `dd/mm/yy`; the application stores an ISO date without browser-dependent parsing.

## Family payments and shift reconciliation
Family payments default to **Automatic distribution**: enter one amount and the server applies integer cents to non-archived outstanding enrollments by enrollment start date, creation date, then stable ID. The advanced manual option supports exceptional exact allocations; its rows must equal the amount received and cannot exceed a balance.

Closing a cashier shift separates Cash from Whish. Enter declared physical cash and explain every overage or shortage. Closing saves an authoritative reconciliation snapshot; reopening is restricted to administrators and does not erase earlier close/reopen audit history.

## Teacher operations
Elapsed scheduled lessons are assumed completed after the configured grace period. Attendance is the exception workspace: cancellation, missed attendance, and corrections require a reason and remain blocked by approved or paid payroll. Payroll creation uses a `YYYY-MM` month and never accepts a custom range. The current month can be previewed but only a completed month can be generated. Teacher Availability opens in a Monday-first calendar view; Reception can review it, while Admin and Super Admin manage recurring rules.
