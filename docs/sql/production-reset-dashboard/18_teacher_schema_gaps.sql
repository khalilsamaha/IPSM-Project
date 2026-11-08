-- 18. IPSM project rakzehtbpzseetldbohm ONLY. Run this ENTIRE file in SQL Editor.
-- Targeted metadata gaps only; no application records, bodies or expression literals.
-- Missing/error/timeout results are blockers. This does not authorize migrations.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
SET LOCAL row_security = off;
-- Same rendering context as teacher_guard_parity, independent of Dashboard defaults.
SET LOCAL search_path = pg_catalog, public;

-- Query 02 already proves enum labels, displayed types/defaults/nullability,
-- CHECK/FK definitions and index definitions/key counts. Do not collect them again.
WITH
expected_columns(table_name,column_name,type_name) AS (VALUES
 ('teachers','hourly_rate_cents','integer'),
 ('teachers','compensation_basis','public."TeacherCompensationBasis"'),
 ('teachers','session_rate_cents','integer'),
 ('teachers','session_unit_minutes','integer'),
 ('teacher_availability','course_id','uuid'),
 ('teacher_payrolls','compensation_basis_snapshot','public."TeacherCompensationBasis"'),
 ('teacher_payrolls','rate_unit_minutes_snapshot','integer'),
 ('teacher_payroll_items','compensation_basis_snapshot','public."TeacherCompensationBasis"'),
 ('teacher_payroll_items','rate_unit_minutes_snapshot','integer')
),
columns_compared AS (
 SELECT e.table_name,e.column_name,a.attnum IS NOT NULL AS present,
  a.atttypid=to_regtype(e.type_name) AND a.atttypmod=-1 AS type_identity_and_modifier_match,
  pg_get_userbyid(c.relowner) AS table_owner,
  n.nspname AS type_schema,pg_get_userbyid(t.typowner) AS type_owner
 FROM expected_columns e LEFT JOIN pg_catalog.pg_class c ON c.oid=to_regclass('public.'||e.table_name)
 LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attname=e.column_name AND a.attnum>0 AND NOT a.attisdropped
 LEFT JOIN pg_catalog.pg_type t ON t.oid=a.atttypid
 LEFT JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
),
constraints_compared AS (
 SELECT e.table_name,e.constraint_name,c.oid IS NOT NULL AS present,
  c.connoinherit=(e.kind='f') AND c.conislocal AND c.coninhcount=0 AS inheritance_matches
 FROM (VALUES ('teachers','teachers_rates_nonnegative','c'),('teachers','teachers_session_unit_positive','c'),
  ('teacher_availability','teacher_availability_course_id_fkey','f')) e(table_name,constraint_name,kind)
 LEFT JOIN pg_catalog.pg_constraint c ON c.conrelid=to_regclass('public.'||e.table_name) AND c.conname=e.constraint_name
),
indexes_compared AS (
 SELECT e.table_name,e.index_name,i.indexrelid IS NOT NULL AS present,
  i.indislive AND NOT i.indisexclusion AND NOT i.indnullsnotdistinct AS remaining_flags_match,
  pg_get_userbyid(c.relowner) AS table_owner,pg_get_userbyid(idx.relowner) AS index_owner
 FROM (VALUES ('teacher_availability','teacher_availability_course_id_idx'),
  ('teacher_courses','teacher_courses_teacher_course_all_levels_key')) e(table_name,index_name)
 LEFT JOIN pg_catalog.pg_index i ON i.indexrelid=to_regclass('public.'||e.index_name) AND i.indrelid=to_regclass('public.'||e.table_name)
 LEFT JOIN pg_catalog.pg_class c ON c.oid=i.indrelid
 LEFT JOIN pg_catalog.pg_class idx ON idx.oid=i.indexrelid
),
findings AS (
 SELECT 'column_type_and_ownership' AS section,
  CASE WHEN present AND type_identity_and_modifier_match THEN 'MATCH' ELSE 'BLOCKER' END AS status,
  to_jsonb(c) AS details FROM columns_compared c
 UNION ALL SELECT 'constraint_inheritance',CASE WHEN present AND inheritance_matches THEN 'MATCH' ELSE 'BLOCKER' END,
  to_jsonb(c) FROM constraints_compared c
 UNION ALL SELECT 'index_flags_and_ownership',CASE WHEN present AND remaining_flags_match THEN 'MATCH' ELSE 'BLOCKER' END,
  to_jsonb(c) FROM indexes_compared c
)
SELECT jsonb_build_object(
 'query_id','18','completed',true,'observed_at',transaction_timestamp(),
 'read_only',current_setting('transaction_read_only'),'isolation',current_setting('transaction_isolation'),
 'server_version_num',current_setting('server_version_num'),
 'status',CASE WHEN EXISTS(SELECT 1 FROM findings WHERE status='BLOCKER') THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END,
 'scope','Remaining catalog flags and ownership ONLY; combine with verified Query 02 snapshot. Not a fresh full-schema certificate.',
 'item_count',(SELECT count(*) FROM findings),
 'items',(SELECT jsonb_agg(to_jsonb(f) ORDER BY section,details::text) FROM findings f)
) AS preflight_report;
ROLLBACK;
