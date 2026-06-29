-- Season billing refactor: seasons, teachers, enrollment charges, payment allocation, and receipts.

do $$ begin create type "SeasonStatus" as enum ('PLANNED', 'ACTIVE', 'CLOSED', 'ARCHIVED'); exception when duplicate_object then null; end $$;
do $$ begin create type "TeacherStatus" as enum ('ACTIVE', 'INACTIVE', 'ARCHIVED'); exception when duplicate_object then null; end $$;
do $$ begin alter type "EnrollmentStatus" add value if not exists 'CANCELLED'; exception when undefined_object then null; end $$;

create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  status "SeasonStatus" not null default 'PLANNED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists seasons_status_start_date_end_date_idx on seasons(status, start_date, end_date);

create table if not exists teachers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text unique,
  hourly_rate_cents integer not null default 0,
  status "TeacherStatus" not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists teachers_status_idx on teachers(status);

alter table users add column if not exists archived_at timestamptz;
alter table families add column if not exists archived_at timestamptz;
alter table students add column if not exists archived_at timestamptz;
alter table invoices add column if not exists deleted_at timestamptz;
alter table payments add column if not exists deleted_at timestamptz;
alter table expenses add column if not exists deleted_at timestamptz;

alter table audit_logs add column if not exists created_by_id uuid references users(id) on delete set null;
create index if not exists audit_logs_created_by_id_idx on audit_logs(created_by_id);

alter table payments add column if not exists created_by_id uuid references users(id) on delete set null;
create index if not exists payments_created_by_id_idx on payments(created_by_id);

alter table expenses add column if not exists created_by_id uuid references users(id) on delete set null;
create index if not exists expenses_created_by_id_idx on expenses(created_by_id);

insert into seasons (id, name, start_date, end_date, status)
values ('70000000-0000-0000-0000-000000000001', 'Legacy Season', current_date, current_date, 'ACTIVE')
on conflict (id) do nothing;

alter table enrollments add column if not exists season_id uuid;
alter table enrollments add column if not exists teacher_id uuid;
alter table enrollments add column if not exists course_name text;
alter table enrollments add column if not exists fee_cents integer not null default 0;
alter table enrollments add column if not exists discount_cents integer not null default 0;
alter table enrollments add column if not exists final_fee_cents integer not null default 0;
alter table enrollments add column if not exists paid_cents integer not null default 0;
alter table enrollments add column if not exists remaining_cents integer not null default 0;
alter table enrollments add column if not exists archived_at timestamptz;

update enrollments
set
  season_id = coalesce(season_id, '70000000-0000-0000-0000-000000000001'::uuid),
  course_name = coalesce(course_name, instrument),
  fee_cents = case when fee_cents = 0 then coalesce(monthly_rate_cents, 0) else fee_cents end,
  final_fee_cents = case when final_fee_cents = 0 then greatest(coalesce(monthly_rate_cents, 0) - discount_cents, 0) else final_fee_cents end,
  remaining_cents = case when remaining_cents = 0 then greatest(coalesce(monthly_rate_cents, 0) - discount_cents - paid_cents, 0) else remaining_cents end;

alter table enrollments alter column season_id set not null;
alter table enrollments alter column course_name set not null;

alter table enrollments drop constraint if exists enrollments_season_id_fkey;
alter table enrollments add constraint enrollments_season_id_fkey foreign key (season_id) references seasons(id) on delete restrict;
alter table enrollments drop constraint if exists enrollments_teacher_id_fkey;
alter table enrollments add constraint enrollments_teacher_id_fkey foreign key (teacher_id) references teachers(id) on delete set null;

alter table enrollments drop column if exists monthly_rate_cents;
alter table enrollments drop column if exists instrument;
alter table enrollments drop column if exists instructor_name;
alter table enrollments drop column if exists weekly_minutes;
alter table enrollments drop column if exists started_at;
alter table enrollments drop column if exists ended_at;

create index if not exists families_status_idx on families(status);
create index if not exists students_status_idx on students(status);
create index if not exists enrollments_season_id_idx on enrollments(season_id);
create index if not exists enrollments_teacher_id_idx on enrollments(teacher_id);
create index if not exists enrollments_status_idx on enrollments(status);
create unique index if not exists enrollments_student_id_season_id_course_name_key on enrollments(student_id, season_id, course_name);

alter table payments alter column invoice_id drop not null;
alter table payments drop constraint if exists payments_invoice_id_fkey;
alter table payments add constraint payments_invoice_id_fkey foreign key (invoice_id) references invoices(id) on delete set null;

create table if not exists payment_items (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  enrollment_id uuid not null references enrollments(id) on delete restrict,
  amount_cents integer not null,
  created_at timestamptz not null default now(),
  unique (payment_id, enrollment_id)
);
create index if not exists payment_items_payment_id_idx on payment_items(payment_id);
create index if not exists payment_items_enrollment_id_idx on payment_items(enrollment_id);

create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references payments(id) on delete cascade,
  receipt_number text not null unique,
  pdf_url text,
  generated_at timestamptz not null default now(),
  sent_by_email_at timestamptz,
  shared_by_whatsapp_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists receipts_generated_at_idx on receipts(generated_at);

alter table seasons enable row level security;
alter table teachers enable row level security;
alter table payment_items enable row level security;
alter table receipts enable row level security;
