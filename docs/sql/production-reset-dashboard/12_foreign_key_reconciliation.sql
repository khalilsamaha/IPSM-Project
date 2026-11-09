-- 12. IPSM project rakzehtbpzseetldbohm ONLY. Run this ENTIRE file in SQL Editor.
-- Read README.md first. Missing results, errors and timeouts are verification blockers.
-- Only schema metadata, hashes and aggregate diagnostics are returned.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
-- Does NOT bypass RLS: fail rather than return policy-filtered counts.
SET LOCAL row_security = off;

-- Expected actions below retain the ef53ed5 baseline so the 22 exact differences stay visible.
WITH
reviewed_no_action(relationship) AS (VALUES
 ('public.audit_logs.created_by_id->public.users.id'),
 ('public.enrollments.season_id->public.seasons.id'),
 ('public.enrollments.student_id->public.students.id'),
 ('public.enrollments.teacher_id->public.teachers.id'),
 ('public.expenses.created_by_id->public.users.id'),
 ('public.payment_items.enrollment_id->public.enrollments.id'),
 ('public.payment_items.payment_id->public.payments.id'),
 ('public.payments.created_by_id->public.users.id'),
 ('public.payments.family_id->public.families.id'),
 ('public.receipts.payment_id->public.payments.id'),
 ('public.schedule_patterns.enrollment_id->public.enrollments.id'),
 ('public.schedule_patterns.room_id->public.rooms.id'),
 ('public.schedule_patterns.teacher_id->public.teachers.id'),
 ('public.schedule_sessions.enrollment_id->public.enrollments.id'),
 ('public.schedule_sessions.room_id->public.rooms.id'),
 ('public.schedule_sessions.schedule_pattern_id->public.schedule_patterns.id'),
 ('public.schedule_sessions.season_id->public.seasons.id'),
 ('public.schedule_sessions.student_id->public.students.id'),
 ('public.schedule_sessions.teacher_id->public.teachers.id'),
 ('public.students.family_id->public.families.id'),
 ('public.teacher_availability.season_id->public.seasons.id'),
 ('public.teacher_availability.teacher_id->public.teachers.id')),
expected(relationship,delete_action,update_action) AS (VALUES
 ('public.audit_logs.created_by_id->public.users.id','n','c'),
 ('public.students.family_id->public.families.id','r','c'),
 ('public.teacher_courses.teacher_id->public.teachers.id','c','c'),
 ('public.teacher_courses.course_id->public.courses.id','r','c'),
 ('public.teacher_courses.level_id->public.course_levels.id','n','c'),
 ('public.course_pricings.course_id->public.courses.id','c','c'),
 ('public.course_pricings.level_id->public.course_levels.id','c','c'),
 ('public.course_pricings.season_id->public.seasons.id','n','c'),
 ('public.enrollments.student_id->public.students.id','c','c'),
 ('public.enrollments.season_id->public.seasons.id','r','c'),
 ('public.enrollments.teacher_id->public.teachers.id','n','c'),
 ('public.enrollments.course_id->public.courses.id','n','c'),
 ('public.enrollments.level_id->public.course_levels.id','n','c'),
 ('public.registration_attempts.family_id->public.families.id','r','c'),
 ('public.registration_attempts.primary_student_id->public.students.id','r','c'),
 ('public.registration_attempts.enrollment_id->public.enrollments.id','n','c'),
 ('public.registration_attempts.payment_id->public.payments.id','n','c'),
 ('public.registration_attempts.created_by_id->public.users.id','n','c'),
 ('public.schedule_sessions.student_id->public.students.id','r','c'),
 ('public.schedule_sessions.teacher_id->public.teachers.id','r','c'),
 ('public.schedule_sessions.enrollment_id->public.enrollments.id','n','c'),
 ('public.schedule_sessions.season_id->public.seasons.id','n','c'),
 ('public.schedule_sessions.room_id->public.rooms.id','n','c'),
 ('public.schedule_sessions.schedule_pattern_id->public.schedule_patterns.id','n','c'),
 ('public.schedule_patterns.enrollment_id->public.enrollments.id','r','c'),
 ('public.schedule_patterns.teacher_id->public.teachers.id','r','c'),
 ('public.schedule_patterns.room_id->public.rooms.id','n','c'),
 ('public.teacher_availability.teacher_id->public.teachers.id','c','c'),
 ('public.teacher_availability.course_id->public.courses.id','r','c'),
 ('public.teacher_availability.season_id->public.seasons.id','n','c'),
 ('public.teacher_payrolls.teacher_id->public.teachers.id','r','c'),
 ('public.teacher_payrolls.approved_by_id->public.users.id','n','c'),
 ('public.teacher_payroll_items.payroll_id->public.teacher_payrolls.id','c','c'),
 ('public.teacher_payroll_items.schedule_session_id->public.schedule_sessions.id','r','c'),
 ('public.payments.family_id->public.families.id','r','c'),
 ('public.payments.created_by_id->public.users.id','n','c'),
 ('public.payments.shift_id->public.cashier_shifts.id','n','c'),
 ('public.payment_items.payment_id->public.payments.id','c','c'),
 ('public.payment_items.enrollment_id->public.enrollments.id','r','c'),
 ('public.receipts.payment_id->public.payments.id','c','c'),
 ('public.expenses.created_by_id->public.users.id','n','c'),
 ('public.expenses.shift_id->public.cashier_shifts.id','n','c'),
 ('public.cashier_shifts.user_id->public.users.id','r','c'),
 ('public.cashier_shifts.closed_by_id->public.users.id','n','c'),
 ('public.cashier_shifts.reopened_by_id->public.users.id','n','c'),
 ('public.expenses.payroll_id->public.teacher_payrolls.id','r','c')),
actual AS (
 SELECT c.conname,c.convalidated,c.condeferrable,c.condeferred,c.confmatchtype,
  c.confdeltype::text AS delete_action,c.confupdtype::text AS update_action,
  ns.nspname||'.'||ch.relname||'.'||
   (SELECT string_agg(a.attname,',' ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY k(num,ord)
    JOIN pg_catalog.pg_attribute a ON a.attrelid=ch.oid AND a.attnum=k.num)||'->'||
  pn.nspname||'.'||p.relname||'.'||
   (SELECT string_agg(a.attname,',' ORDER BY k.ord) FROM unnest(c.confkey) WITH ORDINALITY k(num,ord)
    JOIN pg_catalog.pg_attribute a ON a.attrelid=p.oid AND a.attnum=k.num) AS relationship,
  pg_get_constraintdef(c.oid,true) AS definition
 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class ch ON ch.oid=c.conrelid
 JOIN pg_catalog.pg_namespace ns ON ns.oid=ch.relnamespace
 JOIN pg_catalog.pg_class p ON p.oid=c.confrelid JOIN pg_catalog.pg_namespace pn ON pn.oid=p.relnamespace
 WHERE c.contype='f' AND (ns.nspname='public' OR pn.nspname='public')
),
comparison AS (
 SELECT coalesce(a.relationship,e.relationship) AS relationship,a.conname,a.definition,
  a.convalidated,a.condeferrable,a.condeferred,a.confmatchtype,
  a.delete_action AS live_delete,e.delete_action AS expected_delete,
  a.update_action AS live_update,e.update_action AS expected_update,
  CASE
   WHEN a.conname IS NULL AND e.relationship='public.expenses.payroll_id->public.teacher_payrolls.id'
    THEN 'EXPECTED_ABSENT_BEFORE_PR90'
   WHEN a.conname IS NULL THEN 'MISSING_EXPECTED_FK'
   WHEN e.relationship IS NULL THEN 'UNREVIEWED_RELATIONSHIP'
   WHEN NOT a.convalidated OR a.condeferrable OR a.confmatchtype<>'s' THEN 'REVIEW_CONSTRAINT_PROPERTIES'
   WHEN a.delete_action=e.delete_action AND a.update_action=e.update_action THEN 'EXACT_SIGNATURE_MATCH'
   WHEN a.delete_action=e.delete_action AND a.update_action='a' AND e.update_action='c'
    AND EXISTS(SELECT 1 FROM reviewed_no_action r WHERE r.relationship=a.relationship) THEN 'REVIEWED_LIVE_UPDATE_VARIANT'
   WHEN a.delete_action=e.delete_action AND a.update_action='a' AND e.update_action='c' THEN 'UPDATE_ONLY_NO_ACTION_CANDIDATE'
   ELSE 'OTHER_ACTION_MISMATCH'
  END AS assessment
 FROM actual a FULL JOIN expected e ON e.relationship=a.relationship
),
findings AS (
 SELECT 'fk_comparison' AS section,
  CASE WHEN assessment='EXPECTED_ABSENT_BEFORE_PR90' THEN assessment
   WHEN assessment IN ('EXACT_SIGNATURE_MATCH','REVIEWED_LIVE_UPDATE_VARIANT') THEN 'REVIEW_REQUIRED' ELSE 'BLOCKER' END AS status,
  to_jsonb(c)||jsonb_build_object(
   'candidate_explicit_signature',CASE WHEN assessment='UPDATE_ONLY_NO_ACTION_CANDIDATE'
    THEN relationship||':'||live_delete||live_update END,
   'deletion_assessment',CASE WHEN assessment IN ('UPDATE_ONLY_NO_ACTION_CANDIDATE','REVIEWED_LIVE_UPDATE_VARIANT')
    THEN 'Same DELETE action; reset does not update referenced IDs. Review any unlisted relationship before adding it; never accept update actions broadly.'
    ELSE 'Retain strict column, delete-action and validated-constraint checks.' END) AS details
 FROM comparison c
 UNION ALL
 SELECT 'summary','REVIEW_REQUIRED',jsonb_build_object(
  'observed_fks',(SELECT count(*) FROM actual),'expected_signatures',(SELECT count(*) FROM expected),
  'exact_signature_matches',count(*) FILTER (WHERE live_delete=expected_delete AND live_update=expected_update),
  'update_action_mismatches',count(*) FILTER (WHERE live_delete=expected_delete AND live_update<>expected_update),
  'no_action_candidates',count(*) FILTER (WHERE assessment='UPDATE_ONLY_NO_ACTION_CANDIDATE'),
  'reviewed_live_variants',count(*) FILTER (WHERE assessment='REVIEWED_LIVE_UPDATE_VARIANT'),
  'instruction','Administrator reported 45 observed / 23 matches / 22 update mismatches. Verify exact rows; this report does not change the allowlist.')
 FROM comparison
),
report AS (
  SELECT jsonb_build_object(
    'query_id', '12', 'completed', true,
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
