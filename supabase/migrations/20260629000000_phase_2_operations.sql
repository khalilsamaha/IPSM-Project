-- Phase 1 and 2 schema for IPSM Supabase/Postgres projects.
do $$ begin create type "Role" as enum ('ADMIN', 'RECEPTION'); exception when duplicate_object then null; end $$;
do $$ begin create type "UserStatus" as enum ('ACTIVE', 'INACTIVE'); exception when duplicate_object then null; end $$;
do $$ begin create type "FamilyStatus" as enum ('ACTIVE', 'INACTIVE'); exception when duplicate_object then null; end $$;
do $$ begin create type "StudentStatus" as enum ('ACTIVE', 'INACTIVE'); exception when duplicate_object then null; end $$;
do $$ begin create type "EnrollmentStatus" as enum ('ACTIVE', 'PAUSED', 'ENDED'); exception when duplicate_object then null; end $$;
do $$ begin create type "InvoiceStatus" as enum ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'VOID'); exception when duplicate_object then null; end $$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique,
  name text not null,
  email text not null unique,
  role "Role" not null default 'RECEPTION',
  status "UserStatus" not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_entity_entity_id_idx on audit_logs(entity, entity_id);

create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  status "FamilyStatus" not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  date_of_birth date,
  status "StudentStatus" not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists students_family_id_idx on students(family_id);

create table if not exists enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  instrument text not null,
  instructor_name text,
  weekly_minutes integer not null default 30,
  monthly_rate_cents integer not null default 0,
  status "EnrollmentStatus" not null default 'ACTIVE',
  started_at date not null default current_date,
  ended_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists enrollments_student_id_idx on enrollments(student_id);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete restrict,
  invoice_number text not null unique,
  status "InvoiceStatus" not null default 'DRAFT',
  total_cents integer not null default 0,
  balance_cents integer not null default 0,
  issued_at date not null default current_date,
  due_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invoices_family_id_idx on invoices(family_id);
create index if not exists invoices_status_idx on invoices(status);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount_cents integer not null,
  method text not null,
  received_at date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists payments_invoice_id_idx on payments(invoice_id);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text not null,
  amount_cents integer not null,
  incurred_at date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists expenses_incurred_at_idx on expenses(incurred_at);

alter table users enable row level security;
alter table audit_logs enable row level security;
alter table families enable row level security;
alter table students enable row level security;
alter table enrollments enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
