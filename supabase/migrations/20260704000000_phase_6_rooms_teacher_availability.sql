-- Phase 6: rooms and teacher availability scheduling foundation.
do $$
begin
  create type "RoomStatus" as enum ('ACTIVE', 'ARCHIVED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type "TeacherAvailabilityStatus" as enum ('ACTIVE', 'ARCHIVED');
exception
  when duplicate_object then null;
end $$;

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  capacity integer,
  description text,
  status "RoomStatus" not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table schedule_sessions add column if not exists room_id uuid;
alter table schedule_sessions drop constraint if exists schedule_sessions_room_id_fkey;
alter table schedule_sessions add constraint schedule_sessions_room_id_fkey foreign key (room_id) references rooms(id) on delete set null;
create index if not exists rooms_status_idx on rooms(status);
create index if not exists schedule_sessions_room_id_session_date_idx on schedule_sessions(room_id, session_date);

create table if not exists teacher_availability (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time text not null,
  end_time text not null,
  season_id uuid references seasons(id) on delete set null,
  effective_from date,
  effective_to date,
  status "TeacherAvailabilityStatus" not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint teacher_availability_time_order check (end_time > start_time)
);
create index if not exists teacher_availability_teacher_id_day_of_week_status_idx on teacher_availability(teacher_id, day_of_week, status);
create index if not exists teacher_availability_season_id_idx on teacher_availability(season_id);
