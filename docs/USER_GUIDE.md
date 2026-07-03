# IPSM Music School Management System – End User Guide

## Overview

The IPSM Music School Management System is an internal web application for managing daily music school operations. It is designed for administration users such as Admin and Reception staff.

The system helps manage families, students, teachers, seasons, enrollments, lessons, payments, expenses, reports, and user access.

---

## User Roles

### Admin

Admin users have full access to the application, including operational modules, finance, reports, and user management.

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
2. Choose **New independent student**, **New family / group**, **Existing family / group**, or **Existing student, new enrollment**.
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

The Lessons / Calendar section is used to manage scheduled lessons.

It allows you to view:

- Weekly lesson calendar
- Teacher schedule
- Student schedule
- Booked sessions
- Available time slots
- Cancelled, completed, missed, and scheduled sessions

### Add a Session

1. Open Lessons / Calendar.
2. Select Add Session.
3. Choose student, enrollment, teacher, season, date, start time, and end time.
4. Add notes if needed.
5. Save the session.

The system should prevent teacher and student double-booking.

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
- Outstanding balance report
- Expense report
- Profit and loss report
- Teacher activity or salary report when available

Use reports weekly or monthly to review revenue, unpaid balances, expenses, and profitability.

---

## Users

The Users section is available to Admin users.

Admins can manage application access and user roles.

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
- Keep user access limited to the correct role.
- Sign out when using a shared computer.

---

## Troubleshooting

### Cannot log in

Check that the email is correct, the account is active, and the user exists in the system.

### Cannot access Users

Only Admin users can access User Management.

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

- **New independent student**: creates one student without a Family / Group unless payment compatibility requires a payer record.
- **New family / group with one or more students**: creates the Family / Group, creates one or more students under it, and enrolls the selected primary student.
- **Existing family / group, add student**: selects an existing Family / Group, creates one or more new students under it, and enrolls the selected primary student.
- **Existing student, new enrollment**: selects an existing student and creates a new season/course enrollment without editing the student profile.

The workflow creates one enrollment for the selected primary student, can collect an Initial Payment, and can Book First Lesson.

Students do not require a Family / Group unless the school wants a household payer record or multiple students should be grouped together. Payments still use Family / Group as the payer in this phase, so the guided workflow can create a lightweight payer group for an independent student only when collecting an initial payment. Initial payments continue through existing allocation and receipt behavior. First Lesson booking continues through existing schedule validation, including double-booking checks.

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

An independent student is a student record with no Family / Group attached. Use **Register Student → New independent student** to create one student, continue to enrollment, optionally take an initial payment, and optionally book a first lesson. Because payments remain family-based in this phase, the system may create a lightweight payer Family / Group only when an initial payment is required.

### Family / Group and parent details

A Family / Group can represent a household, sibling group, company group, or other payer/student grouping. Family records now include father details, mother details, address, and emergency contact details. These fields are optional so existing families remain valid.

### Register Student workflow

Register Student supports four clear paths:

1. **New independent student** — creates one student without a Family / Group and then creates the enrollment for that student.
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

Independent students without a Family / Group are not hidden or silently paid under the wrong payer. Because payment records still require a family payer, assign or create a Family / Group payer before collecting payment for an independent student. The payment form displays this behavior so front-desk staff know why an independent student may not appear in the payer selector.

The Payments page now supports filters for Family / Group, Student name, Student ID, receipt number, season, payment method, status, and date range. The payment table includes receipt number, Family / Group, student(s), season(s), payment date, method, allocation count/amount, total, status, and actions to view, download the receipt, prepare an email receipt, and access admin-only voiding through the payment detail screen.

Family and Student list pages include balance summaries where applicable: current season balance, previous unpaid balance, and total outstanding.
