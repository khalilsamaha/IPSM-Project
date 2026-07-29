# Teacher Payroll

Teacher payroll is generated from payable lessons, not from every booked lesson.

## Payable lesson policy

Default policy:

- `COMPLETED` lessons are payable.
- `SCHEDULED` lessons are not payable yet.
- `CANCELLED` lessons are not payable by default.
- `MISSED` lessons are only payable when the payroll policy enables missed pay or an admin manually approves a missed session during draft generation.

The policy lives in `lib/payroll/policy.ts` so future rules can add late-cancellation pay, course-specific rates, or fixed lesson rates without rewriting payroll pages.

## Workflow architecture

1. Admin opens `/payroll/new`.
2. Admin selects teacher and payroll period.
3. The system loads unpaid lessons in the period and excludes sessions already linked to payroll items.
4. Admin includes or excludes eligible items and can approve missed lessons.
5. Admin enters adjustments and generates a `DRAFT` payroll.
6. The teacher hourly rate is copied into `hourlyRateSnapshotCents` and each item stores `rateSnapshotCents`.
7. Approval locks payroll business meaning by storing approval user and time.
8. Marking paid stores paid date and keeps the record locked.
9. Cancellation is an explicit audited action; approved or paid payroll should never be silently edited.

## Lifecycle and permissions

- Reception: no payroll navigation or route access.
- Admin and Super Admin: generate drafts, approve payroll, mark payroll paid, and cancel non-paid payroll with audit.

Statuses:

- `DRAFT`: editable in principle and not final.
- `APPROVED`: locked, with `approvedById` and `approvedAt`.
- `PAID`: locked, with `paidAt`.
- `CANCELLED`: retained for audit/history.

## Historical rate protection

Payroll uses the teacher hourly rate at draft generation time. Later changes to the teacher profile rate do not alter existing payroll headers or payroll items.

## Duplicate protection

`TeacherPayrollItem.scheduleSessionId` is unique, preventing the same schedule session from being paid twice.

## QA checklist

- Completed lessons appear payable by default.
- Scheduled and cancelled lessons are excluded by default.
- Missed lessons require policy/manual approval.
- Generating payroll snapshots the teacher rate.
- Changing a teacher rate after generation does not change existing payroll.
- The same lesson cannot be selected into a second payroll.
- Approval records user/time.
- Paid payroll records paid date.
- Reception cannot access `/payroll`.
- Payroll totals equal lesson item amounts plus adjustments.

## Attendance-driven monthly operations

`ScheduleSession.status` is the attendance source of truth; no duplicate attendance record is maintained. Administrators open **Attendance** for today's lessons, mark all scheduled lessons completed, and then record missed/cancelled exceptions. Missed lessons are unpaid unless explicitly selected and approved during draft payroll generation.

Bulk attendance changes are transactional and audited. Draft-linked lessons must first be released by cancelling/recalculating the draft; approved and paid payroll items lock attendance history, and paid payrolls are immutable.

Payroll generation is blocked while unfinalized `SCHEDULED` lessons remain. A teacher cannot have overlapping DRAFT, APPROVED, or PAID periods. Generation serializes on the teacher record and rechecks overlap within a serializable transaction. The monthly payroll page provides status totals, teacher rollups, CSV export, and a print-friendly report.
