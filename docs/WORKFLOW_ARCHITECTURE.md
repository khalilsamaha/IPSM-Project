# Workflow Architecture

## Student without family

Students may now be created without a Family / Group. Use this for an independent student when no household payer record is needed yet. Existing family-based students continue to work unchanged.

## Family / Group and payer usage

Payments remain family-based in this phase to preserve existing payment, receipt, and void/reversal behavior. When an independent student needs a payment, the guided registration flow can create a lightweight Family / Group payer record and attach the student before reusing the existing payment allocation service.

This intentionally avoids changing receipt or reversal logic during the UX refactor. A future phase can introduce a first-class payer table if broader payment ownership is required.

## Register Student workflow

The **Register Student** workflow adds a guided path for Admin and Reception users:

1. Create or select a student.
2. Optionally select or create a Family / Group.
3. Select season and course.
4. Assign a teacher.
5. Set Amount Due and discount.
6. Create the enrollment.
7. Optionally record an initial payment with existing allocation/receipt rules.
8. Optionally book the first lesson with existing schedule validation.
9. Finish with a summary and receipt link when a payment was created.

Standalone student, family, enrollment, payment, and schedule pages remain available.

## Payment workflow

Existing family payment rules are preserved. Independent students can be registered without a family, but payment collection requires a payer Family / Group record. The registration workflow creates one automatically when needed for an initial payment.

## Booking workflow

The schedule page now emphasizes **Book Lesson** language and separates day, week, teacher, student, and list views. Booking continues to use the same ScheduleSession validation, including teacher/student double-booking prevention and season date checks.
