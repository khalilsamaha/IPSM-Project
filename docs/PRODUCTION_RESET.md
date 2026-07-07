# Production Reset

Production Reset is a SUPER_ADMIN-only delivery-readiness tool at **Settings / System Administration / Production Reset** (`/settings/production-reset`). It removes selected demo or test data while preserving system configuration.

## Access and safety

- Only users with the `SUPER_ADMIN` role can open or execute the page.
- The page shows current counts for families, students, teachers, seasons, enrollments, schedule sessions, payments, payment items, receipts, and expenses before deletion.
- Execution requires choosing at least one data group and typing `RESET` exactly.
- The reset never calls Supabase Auth admin deletion APIs and does not delete Supabase Auth users.
- Every successful reset writes an `audit_logs` entry with action `production_reset`, selected scopes, preserved data classes, execution plan, and counts before deletion.

## Delete options

SUPER_ADMIN can choose any combination of:

- Operational data: enrollments and dependent schedule/financial records.
- Financial data: receipts, payment items, payments, and expenses.
- Schedule data: schedule sessions.
- Students/families: students and families plus dependent enrollments, schedule sessions, and payments.
- Teachers: teachers plus teacher availability, teacher-course links, and schedule sessions.
- Seasons: seasons plus enrollments, schedule sessions, and teacher availability.

## Preserved by default

The reset keeps users, roles, courses, course levels, course pricing, rooms, settings, and Supabase Auth users.

## Dependency order

Deletes are planned in child-to-parent order: receipts, payment items, payments, expenses, schedule sessions, enrollments, teacher availability, teacher-course links, teachers, students, families, then seasons as needed by the selected scopes.
