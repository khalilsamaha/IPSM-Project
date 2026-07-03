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

The schedule page now emphasizes **Book Lesson** language and separates day, week, teacher, student, and list views. Booking continues to use the same ScheduleSession validation, including teacher/student double-booking prevention and season date checks.

## Phase 1 Academic Foundation Workflow

Phase 1 adds academic configuration without changing the finance architecture:

1. Admin configures Courses, Course Levels, and Course Pricing.
2. Reception and Admin use those active Courses and Levels in Register Student.
3. Register Student stores optional `courseId` and `levelId` on Enrollment and copies `Course.name` into the legacy `courseName` field for backward-compatible display, search, and reports.
4. Course Pricing suggests the enrollment fee for the selected Course + Level + Season. If there is no season-specific price, a global Course + Level price may be used.
5. Payments, receipt generation, payment allocation, voids, and reversals remain family-based and unchanged in this phase.
6. Scheduling is not redesigned in this phase; existing lesson booking validation remains the source of truth.

The Enrollments page remains a records page. Register Student is still the primary creation workflow.
