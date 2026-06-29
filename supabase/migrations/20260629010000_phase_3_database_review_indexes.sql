-- Phase 3 database review: reporting-oriented indexes for the existing Phase 2 schema.
-- These indexes do not add new product features; they improve common finance and roster queries.

create index if not exists enrollments_status_started_at_ended_at_idx
  on enrollments(status, started_at, ended_at);

create index if not exists invoices_issued_at_idx
  on invoices(issued_at);

create index if not exists invoices_due_at_idx
  on invoices(due_at);

create index if not exists payments_received_at_idx
  on payments(received_at);
