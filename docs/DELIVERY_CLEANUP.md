# Delivery cleanup: removing demo seed data

This project is delivery-ready only when production behavior avoids creating fake operational records.
The default Prisma seed is `prisma/seed.ts` and is intentionally limited to protected system bootstrap behavior.
It must not create demo families, students, teachers, seasons, enrollments, schedule sessions, payments,
receipts, expenses, courses, course levels, or course pricing.

## Production seed vs. demo seed

- Production/default seed: `npm run prisma:seed` or Prisma's configured seed command runs `prisma/seed.ts`.
  - It does **not** seed demo operational records.
  - If `public.users.email = 'admin@ipsm.local'` already exists, it is kept active and upgraded/preserved as `SUPER_ADMIN`.
  - If that row does not exist, the seed creates it only when `IPSM_SEED_SUPER_ADMIN_AUTH_ID` is set to the real Supabase Auth user UUID that should own the protected admin profile.
- Demo-only seed: `npm run prisma:seed:demo` runs `prisma/seed.demo.ts`.
  - It intentionally creates sample families, students, teachers, a season, academic configuration, enrollments, sessions, payments, receipts, and expenses.
  - Run it only in local, preview, or disposable demo databases.
  - Do not run it against production.

Courses, levels, seasons, and pricing are not currently treated as safe global defaults because prices and offerings are operational business configuration. Add a separate configuration-only seed later if the business approves exact production defaults.

## Cleanup SQL used for removing demo records

Run the cleanup in a reviewed maintenance window and against the intended database only. The predicates below target the deterministic demo UUID ranges and well-known sample values from the old seed. They avoid blanket deletion of real users and avoid deleting Supabase Auth users.

```sql
begin;

-- Delete dependent demo financial records first.
delete from receipts
where payment_id in (
  select id from payments
  where id::text like '60000000-0000-0000-0000-%'
     or receipt_number like 'RCPT-2026-00000%'
);

delete from payment_items
where id::text like '50000000-0000-0000-0000-%'
   or payment_id in (
      select id from payments
      where id::text like '60000000-0000-0000-0000-%'
         or receipt_number like 'RCPT-2026-00000%'
   )
   or enrollment_id::text like '30000000-0000-0000-0000-%';

delete from payments
where id::text like '60000000-0000-0000-0000-%'
   or receipt_number like 'RCPT-2026-00000%';

-- Delete demo scheduling and enrollment records.
delete from schedule_sessions
where id::text like '90000000-0000-0000-0000-%'
   or enrollment_id::text like '30000000-0000-0000-0000-%'
   or notes = 'Seeded sample scheduled session';

delete from enrollments
where id::text like '30000000-0000-0000-0000-%';

-- Delete demo expenses.
delete from expenses
where id::text like '40000000-0000-0000-0000-%'
   or description in (
      'Studio supplies',
      'June studio rent',
      'Guest accompanist',
      'Summer recital flyers'
   );

-- Delete demo academic configuration that was created by the old demo seed.
delete from course_pricings
where course_id::text like 'a1000000-0000-0000-0000-%'
   or level_id::text like 'a2000000-0000-0000-0000-%'
   or season_id = '70000000-0000-0000-0000-000000000002';

delete from courses
where id::text like 'a1000000-0000-0000-0000-%'
  and name in ('Piano', 'Guitar', 'Saxophone', 'Violin', 'Dance', 'Chess', 'Solfège', 'Music Theory');

delete from course_levels
where id::text like 'a2000000-0000-0000-0000-%'
  and name in ('Beginner', 'Level 1', 'Level 2', 'Advanced');

delete from seasons
where id = '70000000-0000-0000-0000-000000000002'
  and name = 'Summer 2026';

-- Delete demo people after dependents are gone.
delete from students
where id::text like '20000000-0000-0000-0000-%'
   or student_code like 'STU-2026-0000%';

delete from teachers
where id::text like '80000000-0000-0000-0000-%'
   or email in ('grace.kim@example.com', 'daniel.brooks@example.com', 'elena.martinez@example.com');

delete from families
where id::text like '10000000-0000-0000-0000-%'
   or email in (
      'rivera@example.com',
      'chen@example.com',
      'patel@example.com',
      'johnson@example.com',
      'garcia@example.com'
   );

commit;
```

## Verification queries

Use these queries after cleanup and after any default seed run. They should return zero rows for demo records.

```sql
select 'families' as table_name, count(*) as demo_count from families
where id::text like '10000000-0000-0000-0000-%'
   or email in ('rivera@example.com', 'chen@example.com', 'patel@example.com', 'johnson@example.com', 'garcia@example.com')
union all
select 'students', count(*) from students
where id::text like '20000000-0000-0000-0000-%'
   or student_code like 'STU-2026-0000%'
union all
select 'teachers', count(*) from teachers
where id::text like '80000000-0000-0000-0000-%'
   or email in ('grace.kim@example.com', 'daniel.brooks@example.com', 'elena.martinez@example.com')
union all
select 'seasons', count(*) from seasons
where id = '70000000-0000-0000-0000-000000000002'
   or name = 'Summer 2026'
union all
select 'enrollments', count(*) from enrollments
where id::text like '30000000-0000-0000-0000-%'
union all
select 'schedule_sessions', count(*) from schedule_sessions
where id::text like '90000000-0000-0000-0000-%'
   or notes = 'Seeded sample scheduled session'
union all
select 'payments', count(*) from payments
where id::text like '60000000-0000-0000-0000-%'
   or receipt_number like 'RCPT-2026-00000%'
union all
select 'receipts', count(*) from receipts
where payment_id::text like '60000000-0000-0000-0000-%'
   or receipt_number like 'RCPT-2026-00000%'
union all
select 'expenses', count(*) from expenses
where id::text like '40000000-0000-0000-0000-%'
   or description in ('Studio supplies', 'June studio rent', 'Guest accompanist', 'Summer recital flyers')
union all
select 'courses', count(*) from courses
where id::text like 'a1000000-0000-0000-0000-%'
union all
select 'course_levels', count(*) from course_levels
where id::text like 'a2000000-0000-0000-0000-%'
union all
select 'course_pricings', count(*) from course_pricings
where course_id::text like 'a1000000-0000-0000-0000-%'
   or level_id::text like 'a2000000-0000-0000-0000-%'
   or season_id = '70000000-0000-0000-0000-000000000002';
```

## Supabase Auth safety reminder

Do **not** delete rows from Supabase `auth.users` as part of demo cleanup. The app's RBAC profiles live in `public.users`, and real operators may share email patterns that look local in non-production environments. Only delete `public.users` rows when they are explicitly confirmed to be demo/test users. The protected `admin@ipsm.local` profile must remain `SUPER_ADMIN` if it exists, and any newly created protected profile must use a real `auth.users.id` supplied through `IPSM_SEED_SUPER_ADMIN_AUTH_ID`.
