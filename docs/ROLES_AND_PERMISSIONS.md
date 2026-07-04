# Roles and Permissions

IPSM supports exactly two application roles: **ADMIN** and **RECEPTION**.

## Role definitions

- **ADMIN** has full access to every module, including user management, settings, reports, voiding payments, and admin-only financial metadata repair tools.
- **RECEPTION** has daily operational access for families, students, teachers, enrollments, schedules, payments, receipts, and expenses. Reception cannot manage users, access settings, void payments, hard-delete records, or run admin-only repair tools.

## Permissions matrix

| Module / Action | ADMIN | RECEPTION |
| --- | --- | --- |
| Dashboard | Yes | Yes |
| Families create/edit/archive/restore | Yes | Yes |
| Students create/edit/archive/restore | Yes | Yes |
| Teachers create/edit/archive/restore | Yes | Yes |
| Seasons create/edit/archive/restore | Yes | Yes |
| Enrollments create/edit/archive/restore | Yes | Yes |
| Schedule sessions create/edit/cancel/archive/restore | Yes | Yes |
| Payments and receipts create/download/email | Yes | Yes |
| Void payments | Yes | No |
| Expenses create/edit/archive/restore | Yes | Yes |
| Reports | Yes | Yes, while `reports:read` remains enabled |
| User management | Yes | No |
| Settings | Yes | No |
| Financial metadata repair tools | Yes | No |
| Hard delete operational records | No standard UI action | No |

## Route rules

All application pages and API routes require authentication. `/users` and `/settings` are admin-only and must show a safe Not Authorized state or redirect instead of throwing a server error when opened by Reception.

## Receipt repair diagnostics

Admins can use the repair action exposed beside payments with missing receipt numbers. For production audits, identify inconsistent financial metadata with:

```sql
select p.id, p.receipt_number from payments p where p.receipt_number is null;
select r.id, r.payment_id from receipts r where r.receipt_number is null;
select p.id from payments p left join receipts r on r.payment_id = p.id where r.id is null;
select p.id from payments p left join payment_items i on i.payment_id = p.id group by p.id having count(i.id) = 0;
```

## Phase 1 Academic Configuration Permissions

- **Admin**
  - Can create, edit, and archive Courses.
  - Can create, edit, and archive Course Levels.
  - Can create, edit, and archive Course Pricing records.
  - Can use configured Course/Level/Pricing values during registration.

- **Reception**
  - Can view and use active Courses, Course Levels, and configured Pricing during Register Student.
  - Cannot manage Courses, Course Levels, or Course Pricing.
  - Continues to use existing registration and records workflows.

Finance permissions are unchanged: family-based payments, receipt generation, allocation, void, and reversal behavior are not modified by Phase 1.

## Phase 5 season lifecycle permissions

- **Admin** can create seasons, activate/open seasons, close seasons, archive seasons, reopen closed seasons, and view/export season closing reports.
- **Reception** can view season statuses and closing reports but cannot activate, close, archive, or reopen seasons.
- Closed seasons remain visible to both roles. Reception can still take payments against outstanding balances from closed seasons, but normal registration and lesson booking workflows block new enrollments and sessions for closed seasons.

## Phase 6 Scheduling Permissions

- **Admin** can manage rooms and teacher availability, including creating, editing, and archiving availability rules.
- **Reception** can view rooms, choose an active room when booking a lesson, and view teacher availability for booking support.
- Existing booking permissions still apply: schedule session creation and updates continue to use the records workflow permissions, while teacher availability maintenance is restricted to Admin.
