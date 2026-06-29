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

- Invoices are issued to families.
- A family invoice may represent charges for multiple students.
- Partial payments are allowed.
- Multiple payments may be applied to the same invoice.
- Phase 3 requires invoice lines and payment allocations if reports must answer which student or enrollment each payment covered.

## Financial History

- Financial records should be voided or reversed rather than hard-deleted.
- Soft-deleted or inactive operational records must remain available to financial reporting.
- Payment and invoice totals should be validated so overpayment and stale balances are not silently introduced.
