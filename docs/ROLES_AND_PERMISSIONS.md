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
- **Reception** can choose active rooms and use availability-aware booking from the Lessons / Calendar workflow, but Phase 8 removes direct access to Rooms and Teacher Availability configuration pages.
- Existing booking permissions still apply: schedule session creation and updates continue to use the records workflow permissions, while rooms and teacher availability maintenance are restricted to Admin.

## Phase 8 navigation and configuration permissions

Phase 8 configuration links are distributed to the sidebar category they belong to instead of being overloaded under one **School Configuration** menu.

- **Admin**
  - Can manage academic setup from **Academic**: Seasons, Enrollments, and Courses & Pricing.
  - Can manage scheduling setup from **Scheduling**: Lessons / Schedule, Rooms, and Teacher Availability.
  - Can manage finance review tools from **Finance**: Payments, Expenses, Reports, and future Payment Methods or Expense Categories pages when implemented.
  - Can manage sensitive system tools from **System / Admin**: Users, School Profile, Receipt Settings, and Advanced Settings.
  - Can open `/settings` for school-profile, receipt, and advanced admin placeholders.

- **Reception**
  - Sees daily operational workflows such as Dashboard, Register Student, Families, Students, Teachers, Enrollments, Lessons / Schedule, Payments, Expenses, receipts, and reports where enabled.
  - Cannot see Users, Advanced Settings, course/pricing management, Rooms management, Teacher Availability management, Seasons management, or sensitive system configuration in the sidebar.
  - Cannot manually open Admin configuration URLs; protected pages redirect safely or show a Not Authorized state instead of crashing.
  - Cannot activate, close, archive, restore, or otherwise perform season lifecycle actions.

Payment creation, receipt generation, payment allocation, voiding rules, and payment service logic are unchanged by this navigation hotfix.

## Phase 10 route access matrix

Admin-only pages: `/users`, `/settings`, `/seasons`, `/rooms`, `/teacher-availability`, `/admin/courses`, `/admin/course-levels`, `/admin/course-pricing`, and `/admin/diagnostics`.
Reception-accessible protected pages: `/dashboard`, `/register-student`, `/families`, `/students`, `/teachers`, `/enrollments`, `/schedule`, `/payments`, `/expenses`, and `/reports`.

Reception users who open an Admin-only page should see a friendly Not Authorized page, not a production exception or raw redirect loop.
