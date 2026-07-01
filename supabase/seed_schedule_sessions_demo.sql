-- Cleanup generated demo schedule sessions only (uncomment to remove):
-- delete from schedule_sessions
-- where notes like '[DEMO-SCHEDULE-SEED]%';

with
week_bounds as (
  select date_trunc('week', current_date)::date as current_week_monday
),
target_courses(course_name, current_week_day_offset, next_week_day_offset, current_start_time, current_end_time, next_start_time, next_end_time, current_status, next_status, current_note, next_note) as (
  values
    ('Piano', 0, 7, '09:00', '10:00', '14:00', '15:00', 'SCHEDULED', 'COMPLETED', 'Technique focus: scales, posture, and sight-reading.', 'Review completed repertoire and assign a new recital piece.'),
    ('Guitar', 1, 8, '11:00', '12:00', '16:00', '17:00', 'COMPLETED', 'SCHEDULED', 'Chord transitions and rhythm warmups went well.', 'Prepare strumming patterns for ensemble practice.'),
    ('Violin', 2, 9, '13:00', '14:00', '18:00', '19:00', 'CANCELLED', 'SCHEDULED', 'Cancelled by family; offer makeup slot next week.', 'Bow control, intonation drills, and duet reading.'),
    ('Voice', 3, 10, '15:00', '16:00', '08:00', '09:00', 'MISSED', 'SCHEDULED', 'Student missed session; call family to confirm next lesson.', 'Breathing exercises and song interpretation coaching.'),
    ('Drums', 4, 11, '17:00', '18:00', '19:00', '20:00', 'SCHEDULED', 'CANCELLED', 'Groove practice with metronome and fill development.', 'Teacher unavailable; cancelled demo session for calendar testing.')
),
ranked_enrollments as (
  select
    e.id as enrollment_id,
    e.student_id,
    e.teacher_id,
    e.season_id,
    e.course_name,
    s.first_name,
    s.last_name,
    t.full_name as teacher_name,
    row_number() over (
      partition by lower(e.course_name)
      order by
        case e.status when 'ACTIVE' then 0 when 'PAUSED' then 1 else 2 end,
        e.created_at,
        e.id
    ) as course_rank
  from enrollments e
  join students s on s.id = e.student_id
  join teachers t on t.id = e.teacher_id
  join seasons se on se.id = e.season_id
  where lower(e.course_name) in (select lower(course_name) from target_courses)
    and e.teacher_id is not null
    and e.season_id is not null
    and coalesce(s.archived_at, null) is null
    and coalesce(t.archived_at, null) is null
    and coalesce(se.archived_at, null) is null
),
selected_enrollments as (
  select *
  from ranked_enrollments
  where course_rank = 1
),
demo_sessions as (
  select
    ('91000000-0000-0000-0000-' || lpad((row_number() over (order by tc.course_name, series.week_index))::text, 12, '0'))::uuid as id,
    se.student_id,
    se.teacher_id,
    se.enrollment_id,
    se.season_id,
    (tc.course_name || ' lesson — ' || se.first_name || ' ' || se.last_name) as title,
    (wb.current_week_monday + case when series.week_index = 1 then tc.current_week_day_offset else tc.next_week_day_offset end)::date as session_date,
    case when series.week_index = 1 then tc.current_start_time else tc.next_start_time end as start_time,
    case when series.week_index = 1 then tc.current_end_time else tc.next_end_time end as end_time,
    (case when series.week_index = 1 then tc.current_status else tc.next_status end)::"ScheduleSessionStatus" as status,
    ('[DEMO-SCHEDULE-SEED] ' || case when series.week_index = 1 then tc.current_note else tc.next_note end || ' Teacher: ' || se.teacher_name || '.') as notes
  from target_courses tc
  join selected_enrollments se on lower(se.course_name) = lower(tc.course_name)
  cross join week_bounds wb
  cross join (values (1), (2)) as series(week_index)
),
non_conflicting_demo_sessions as (
  select ds.*
  from demo_sessions ds
  where not exists (
    select 1
    from schedule_sessions existing
    where existing.id <> ds.id
      and existing.archived_at is null
      and existing.session_date = ds.session_date
      and existing.status in ('SCHEDULED', 'COMPLETED', 'MISSED')
      and ds.status in ('SCHEDULED', 'COMPLETED', 'MISSED')
      and (existing.teacher_id = ds.teacher_id or existing.student_id = ds.student_id)
      and existing.start_time < ds.end_time
      and existing.end_time > ds.start_time
  )
)
insert into schedule_sessions (
  id,
  student_id,
  teacher_id,
  enrollment_id,
  season_id,
  title,
  session_date,
  start_time,
  end_time,
  status,
  notes,
  created_at,
  updated_at
)
select
  id,
  student_id,
  teacher_id,
  enrollment_id,
  season_id,
  title,
  session_date,
  start_time,
  end_time,
  status,
  notes,
  now(),
  now()
from non_conflicting_demo_sessions
on conflict (id) do update set
  student_id = excluded.student_id,
  teacher_id = excluded.teacher_id,
  enrollment_id = excluded.enrollment_id,
  season_id = excluded.season_id,
  title = excluded.title,
  session_date = excluded.session_date,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now(),
  archived_at = null;
