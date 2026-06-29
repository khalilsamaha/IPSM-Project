-- Reporting indexes that are safe for the MVP payment-first schema.
create index if not exists enrollments_status_archived_at_idx
  on enrollments(status, archived_at);

create index if not exists payments_payment_date_voided_at_idx
  on payments(payment_date, voided_at);

create index if not exists expenses_expense_date_archived_at_idx
  on expenses(expense_date, archived_at);
