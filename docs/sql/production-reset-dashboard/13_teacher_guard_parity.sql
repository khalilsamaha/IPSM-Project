-- 13. IPSM project rakzehtbpzseetldbohm ONLY. Run this ENTIRE file in SQL Editor.
-- Read README.md first. Missing results, errors and timeouts are verification blockers.
-- Only schema metadata, hashes and aggregate diagnostics are returned.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
-- Does NOT bypass RLS: fail rather than return policy-filtered counts.
SET LOCAL row_security = off;

WITH
-- prosrc MD5 values are computed from the reviewed repository function bodies.
expected(function_name,table_name,trigger_name,body_md5,update_columns) AS (VALUES
 ('validate_teacher_availability_scope','teacher_availability','teacher_availability_scope_guard','ce495851f4dce1da05f507f4af587a61',ARRAY['course_id','effective_from','effective_to','season_id','teacher_id']::text[]),
 ('validate_schedule_teacher_availability','schedule_sessions','schedule_teacher_availability_guard','e9d829cecb69aedc692d7b1a5fdaaf07',ARRAY['end_time','enrollment_id','session_date','start_time','teacher_id']::text[]),
 ('validate_enrollment_teacher_availability','enrollments','enrollment_teacher_availability_guard','e85ba87b42cfa5e5b60c2d3aaa0ccfc1',ARRAY['course_id','enrollment_end_date','enrollment_start_date','level_id','season_id','teacher_id']::text[])),
compared AS (
 SELECT e.*,p.oid IS NOT NULL AS function_exists,t.oid IS NOT NULL AS trigger_exists,
  md5(p.prosrc) AS live_body_md5,p.prosecdef,p.provolatile,p.prokind,
  pg_get_userbyid(p.proowner) AS owner,md5(p.proconfig::text) AS configuration_md5,
  p.prosrc IS NOT NULL AND md5(p.prosrc)=e.body_md5 AND p.prorettype='trigger'::regtype
   AND p.prokind='f' AND p.provolatile='v' AND NOT p.prosecdef AND l.lanname='plpgsql'
   AND p.proconfig=ARRAY['search_path=""']::text[] AS function_matches,
  t.tgenabled,t.tgtype,t.tgnargs,md5(pg_get_triggerdef(t.oid,true)) AS trigger_definition_md5,
  (SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(t.tgattr) k(num)
   JOIN pg_catalog.pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=k.num) AS live_update_columns,
  t.oid IS NOT NULL AND t.tgfoid=p.oid AND t.tgenabled='O' AND t.tgtype=23
   AND t.tgnargs=0 AND t.tgqual IS NULL AND NOT t.tgdeferrable AND NOT t.tginitdeferred
   AND (SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(t.tgattr) k(num)
    JOIN pg_catalog.pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=k.num)=e.update_columns AS trigger_matches
 FROM expected e
 LEFT JOIN pg_catalog.pg_proc p ON p.oid=to_regprocedure('public.'||e.function_name||'()')
 LEFT JOIN pg_catalog.pg_language l ON l.oid=p.prolang
 LEFT JOIN pg_catalog.pg_trigger t ON t.tgrelid=to_regclass('public.'||e.table_name)
   AND t.tgname=e.trigger_name AND NOT t.tgisinternal
),
findings AS (
 SELECT 'teacher_guard_parity' AS section,
  CASE WHEN function_matches IS TRUE AND trigger_matches IS TRUE THEN 'REVIEW_REQUIRED' ELSE 'BLOCKER' END AS status,
  to_jsonb(c)||jsonb_build_object('instruction',
   'Matching bodies/attributes/triggers establish only this guard parity. Review columns, indexes, constraints and grants separately. The PR90 parity migration replaces the first two guards; enrollment guard is unchanged.') AS details
 FROM compared c
),
report AS (
  SELECT jsonb_build_object(
    'query_id', '13', 'completed', true,
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
