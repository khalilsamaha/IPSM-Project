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
