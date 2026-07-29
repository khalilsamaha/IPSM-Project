# Database Architecture Review

This document reflects the MVP payment-first schema. The MVP intentionally does not include invoices: families make payments, payments are allocated to enrollment rows through payment items, and receipts are generated from payments.

## Current ERD

```mermaid
erDiagram
  users ||--o{ payments : creates
  users ||--o{ expenses : creates
  families ||--o{ students : has
  families ||--o{ payments : makes
  students ||--o{ enrollments : has
  seasons ||--o{ enrollments : groups
  teachers ||--o{ enrollments : teaches
  payments ||--o{ payment_items : allocates
  enrollments ||--o{ payment_items : receives
  payments ||--o| receipts : has

  payments {
    uuid id PK
    uuid family_id FK
    date payment_date
    text payment_method
    int total_amount_cents
    text notes
    uuid created_by_id FK
    text receipt_number UK
    timestamptz voided_at
    timestamptz created_at
    timestamptz updated_at
  }

  payment_items {
    uuid id PK
    uuid payment_id FK
    uuid enrollment_id FK
    int amount_cents
    timestamptz created_at
  }

  receipts {
    uuid id PK
    uuid payment_id FK
    text receipt_number UK
    text pdf_path
    timestamptz generated_at
    timestamptz sent_by_email_at
    timestamptz shared_by_whatsapp_at
    timestamptz created_at
  }

  expenses {
    uuid id PK
    uuid created_by_id FK
    text category
    text description
    int amount_cents
    date incurred_at
    date expense_date
    text payment_method
    timestamptz created_at
    timestamptz archived_at
  }
```

## MVP Billing Flow

The supported MVP flow is:

`Family -> Payment -> PaymentItem -> Enrollment -> Receipt`

A `Payment` belongs directly to a `Family` and records the payment date, method, total amount, receipt number, void timestamp, audit creator, notes, and timestamps. A `PaymentItem` allocates part of the family payment to a specific `Enrollment`, allowing one family payment to cover multiple students or multiple enrollment charges. A `Receipt` belongs to one payment and stores the generated PDF storage path in `pdf_path`.

## Invoice Decision

No `Invoice` model remains in the MVP schema. Invoices were removed because the current product scope only requires direct family payments allocated to enrollments and receipt generation. Adding invoices without invoice line items would duplicate enrollment balances and create stale balance risk. If future requirements need formal statements, aging, taxes, or invoice numbers, invoices should be reintroduced together with invoice line items and allocation rules rather than as a standalone total/balance table.

## Table Notes

### `families`
Household aggregate for students and payments. Families own many students and can make many payments.

### `enrollments`
Season-aware enrollment record with fee, discount, final fee, paid, and remaining amounts. Payment history is available through related `payment_items`.

### `payments`
Family-level cash receipt. `total_amount_cents` is the payment total, `payment_method` stores the tender type, `payment_date` drives cash receipt reports, `receipt_number` provides the business-facing receipt identifier, and `voided_at` preserves history without deleting financial records.

### `payment_items`
Allocation table between payments and enrollments. This supports one payment covering multiple enrollments and multiple payments against the same enrollment.

### `receipts`
Generated receipt metadata for a payment. Receipt files are referenced by `pdf_path` so storage implementation details are not exposed as public URLs.

### `expenses`
Expense ledger with category, description, amount, `expense_date`, `payment_method`, and `archived_at`. The legacy `incurred_at` column is retained for compatibility, but new reporting should prefer `expense_date`.

## Reporting Indexes

- `payments(family_id)` for family payment history.
- `payments(payment_date)` and `payments(payment_date, voided_at)` for cash receipt reports.
- `payment_items(payment_id)` and `payment_items(enrollment_id)` for allocation lookups.
- `enrollments(status)` and `enrollments(status, archived_at)` for receivables and roster reports.
- `expenses(expense_date)` and `expenses(expense_date, archived_at)` for expense reporting.

## Family-only migration and recurring schedules

The deployment migration first verifies referential integrity, creates one collision-safe `FAM-YYYY-NNNNNN` family for each legacy independent student, copies useful contact data, reassigns every direct payment without changing payment IDs or receipt numbers, and asserts allocation ownership. Only then does it apply `NOT NULL` and `ON DELETE RESTRICT` to student/payment family keys and remove `payments.student_id`.

```text
Family -> Students -> Enrollments -> SchedulePattern -> ScheduleSessions
       -> Payments -> PaymentItems -> Receipts
```

`school_closures` and `schedule_patterns` have RLS enabled and no anonymous policies. Application access remains authenticated and server-side.

## Teacher operations additions
`operational_settings` is an RLS-enabled singleton (`school-default`) holding auto-finalization, 0–240 minute grace, and payable-missed enablement. `schedule_sessions` has additive attendance provenance fields. `teacher_payrolls.payroll_month` stores the first date of each new calendar month and is unique with `teacher_id`; nullable legacy custom-period payrolls remain unchanged. Prisma and Supabase migration `20260729030000_teacher_operations` are identical.
# Retention and lesson-register queries

Person and family deletion uses serializable transactions and fresh dependency counts. Audit rows retain the deleted entity UUID without a foreign-key cascade. Financial, receipt, enrollment, attendance, lesson, and payroll rows are blockers, never cleanup targets. Teacher course and availability rows are the only permitted configuration cleanup.

The schedule register uses additive composite indexes for date/time and season/status plus date. Prisma and Supabase migration copies are kept in parity.
