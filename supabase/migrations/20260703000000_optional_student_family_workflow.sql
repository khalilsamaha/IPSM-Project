-- Workflow architecture refactor: allow independent students without forcing a household.
-- Existing family-based students, payments, receipts, and schedule sessions remain unchanged.
alter table if exists public.students
  alter column family_id drop not null;

alter table if exists public.students
  drop constraint if exists students_family_id_fkey;

alter table if exists public.students
  add constraint students_family_id_fkey
  foreign key (family_id) references public.families(id) on delete set null;
