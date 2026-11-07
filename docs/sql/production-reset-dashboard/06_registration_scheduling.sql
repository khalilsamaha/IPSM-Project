-- 06. IPSM project rakzehtbpzseetldbohm ONLY. Run this ENTIRE file in SQL Editor.
-- Read README.md first. Missing results, errors and timeouts are verification blockers.
-- Only schema metadata, hashes and aggregate diagnostics are returned.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
-- Does NOT bypass RLS: fail rather than return policy-filtered counts.
SET LOCAL row_security = off;

WITH
checks(section,affected) AS (
 SELECT 'duplicate_registration_enrollment_groups',count(*) FROM (
  SELECT enrollment_id FROM public.registration_attempts WHERE enrollment_id IS NOT NULL GROUP BY enrollment_id HAVING count(*)>1) q
 UNION ALL SELECT 'duplicate_registration_payment_groups',count(*) FROM (
  SELECT payment_id FROM public.registration_attempts WHERE payment_id IS NOT NULL GROUP BY payment_id HAVING count(*)>1) q
 UNION ALL SELECT 'duplicate_submission_groups',count(*) FROM (
  SELECT registration_submission_id FROM public.enrollments WHERE registration_submission_id IS NOT NULL GROUP BY registration_submission_id HAVING count(*)>1) q
 UNION ALL SELECT 'duplicate_course_wide_assignment_groups',count(*) FROM (
  SELECT teacher_id,course_id FROM public.teacher_courses WHERE level_id IS NULL GROUP BY teacher_id,course_id HAVING count(*)>1) q
 UNION ALL SELECT 'invalid_teacher_rates_or_units',count(*) FROM public.teachers
  WHERE hourly_rate_cents<0 OR session_rate_cents<0 OR session_unit_minutes<=0
 UNION ALL SELECT 'availability_scope_violations',count(*) FROM public.teacher_availability ta
  LEFT JOIN public.seasons s ON s.id=ta.season_id
  WHERE (ta.season_id IS NOT NULL AND (s.id IS NULL OR ta.effective_from IS NULL OR ta.effective_to IS NULL
    OR ta.effective_from<s.start_date OR ta.effective_to>s.end_date OR ta.effective_to<ta.effective_from))
   OR (ta.course_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.teacher_courses tc
    WHERE tc.teacher_id=ta.teacher_id AND tc.course_id=ta.course_id AND tc.status='ACTIVE' AND tc.archived_at IS NULL))
 UNION ALL SELECT 'lesson_availability_violations',count(*) FROM public.schedule_sessions ss
  LEFT JOIN public.enrollments e ON e.id=ss.enrollment_id
  WHERE ss.enrollment_id IS NOT NULL AND (e.id IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.teacher_availability ta WHERE ta.teacher_id=ss.teacher_id
   AND ta.day_of_week=extract(dow FROM ss.session_date)::integer AND ta.status='ACTIVE' AND ta.archived_at IS NULL
   AND (ta.season_id IS NULL OR ta.season_id=e.season_id) AND (ta.course_id IS NULL OR ta.course_id=e.course_id)
   AND (ta.effective_from IS NULL OR ta.effective_from<=ss.session_date)
   AND (ta.effective_to IS NULL OR ta.effective_to>=ss.session_date)
   AND ta.start_time<=ss.start_time AND ta.end_time>=ss.end_time))
),
findings AS (
 SELECT section,CASE WHEN affected>0 THEN 'BLOCKER' ELSE 'NO_FINDINGS' END AS status,jsonb_build_object('affected',affected) AS details FROM checks
 UNION ALL
 SELECT 'registration_unique_index',
  CASE WHEN idx.oid IS NULL THEN 'REVIEW_REQUIRED'
   WHEN (i.indisunique AND i.indisvalid AND i.indisready AND i.indnatts=1
     AND i.indpred IS NULL AND i.indexprs IS NULL AND a.attname=names.column_name
     AND i.indrelid=to_regclass('public.registration_attempts')) IS NOT TRUE THEN 'BLOCKER'
   ELSE 'REVIEW_REQUIRED' END,
  jsonb_build_object('column',names.column_name,'index_present',idx.oid IS NOT NULL,'index_name',idx.relname,
   'instruction','Absent is addressed by the proposed migration; an existing name must match column/uniqueness/validity exactly')
 FROM (VALUES ('enrollment_id'),('payment_id')) names(column_name)
 LEFT JOIN pg_catalog.pg_class idx ON idx.oid=to_regclass('public.registration_attempts_'||names.column_name||'_key')
 LEFT JOIN pg_catalog.pg_index i ON i.indexrelid=idx.oid
 LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
),
report AS (
  SELECT jsonb_build_object(
    'query_id', '06', 'completed', true,
    'observed_at', transaction_timestamp(),
    'read_only', current_setting('transaction_read_only'),
    'isolation', current_setting('transaction_isolation'),
    'status', CASE WHEN EXISTS (SELECT 1 FROM findings WHERE status='BLOCKER')
                   THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END,
    'item_count', (SELECT count(*) FROM findings),
    'items', coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY section, details::text) FROM findings f), '[]'::jsonb)
  ) AS preflight_report
)
SELECT preflight_report FROM report;
ROLLBACK;
