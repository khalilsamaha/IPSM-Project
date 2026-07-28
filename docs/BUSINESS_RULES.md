# Business Rules

## Families and Students

- A family may have one or more students.
- A student belongs to exactly one family.
- Inactive families or students should be hidden from day-to-day operational lists but preserved for historical reports.

## Enrollments

- A student may have multiple enrollments over time.
- Enrollment start and end dates define the active instruction window.
- Phase 3 must decide whether seasons are first-class records or inferred from enrollment dates.

## Teachers

- Current enrollments store instructor names as text snapshots.
- Teacher reassignment must not rewrite historical assignment records.
- Phase 3 should introduce teacher identity and assignment history if teacher reporting is required.

## Billing and Payments

- Payments are recorded directly against families.
- A family payment may represent charges for multiple students.
- Partial payments are allowed through one or more `PaymentItem` allocations against an enrollment.
- Multiple payments may be applied to the same enrollment.
- Receipts are generated from payments.

## Financial History

- Financial records should be voided or reversed rather than hard-deleted.
- Soft-deleted or inactive operational records must remain available to financial reporting.
- Payment totals and allocation totals should be validated so overpayment and stale balances are not silently introduced.

## Family-only operations (2026 overhaul)

Every student belongs to exactly one family; a family may contain only one student. Payments are family-level only and every payment, including an initial registration payment, requires the operator's open cashier shift. An enrollment is the academic and financial registration of one student for one activity and season—not a lesson. Lessons are booked under an enrollment or generated from an active weekly schedule pattern; closures and booking conflicts are skipped or rejected.

Completed lessons are payable by default. Scheduled and cancelled lessons are not payable; missed lessons require explicit approval. Used and financial records are archived, cancelled, or voided rather than hard-deleted. Courses and levels are global reusable records: global prices apply normally and an exact season override takes precedence.
