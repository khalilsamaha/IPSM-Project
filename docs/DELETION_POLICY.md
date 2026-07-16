# Safe Deletion Policy

Deletion must preserve auditability and financial history. All permanent delete attempts are permission checked, should show friendly errors, and should create audit records for successful or useful blocked attempts.

## Module Rules

- **Expenses**: edit while active; archive and restore are allowed; permanent delete is admin-only, requires archive first, requires the exact confirmation `Permanently delete this expense? This action cannot be undone.`, and audits amount, category, date, creator, and deletion actor before deletion.
- **Rooms**: permanent delete only when unused; otherwise archive.
- **Seasons**: permanent delete only when unused by enrollments, schedules, prices, or payment items; otherwise close/archive.
- **Courses and levels**: permanent delete only when unused; otherwise archive.
- **Teachers**: archive normally. Permanent delete only when archived and there are no enrollments, schedule sessions, payroll references, availability rows, or course assignments.
- **Families**: permanent delete only when archived/inactive and there are no students or payments. Never cascade-delete financial history.
- **Enrollments**: normally end/archive. Permanent delete only when there are no payment items and no lessons.
- **Payments**: never normal delete. Use void/reversal only.
- **Receipts**: never independently delete financial history. Regenerate/reprint from the payment.
- **Lessons**: cancel/archive normally. Permanent delete only when archived and not tied to closed-shift dependencies.
