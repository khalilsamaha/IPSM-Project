-- 14. IPSM project rakzehtbpzseetldbohm ONLY. Run this ENTIRE file in SQL Editor.
-- Read README.md first. Missing results, errors and timeouts are verification blockers.
-- Only schema metadata, hashes and aggregate diagnostics are returned.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
-- Does NOT bypass RLS: fail rather than return policy-filtered counts.
SET LOCAL row_security = off;

WITH
audit_references AS (
 SELECT action,entity_id AS payroll_id,
  CASE WHEN metadata->>'expenseId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   THEN (metadata->>'expenseId')::uuid END AS expense_id,
  CASE WHEN metadata->'expenseId' IS NULL THEN 'missing_key'
   WHEN jsonb_typeof(metadata->'expenseId')='null' THEN 'json_null'
   WHEN jsonb_typeof(metadata->'expenseId')<>'string' THEN 'non_string'
   WHEN metadata->>'expenseId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'invalid_uuid'
   ELSE 'valid_uuid' END AS reference_format
 FROM public.audit_logs WHERE entity='TeacherPayroll' AND action IN ('mark_paid','payroll_shift_reconciled')
),
reference_counts AS (
 SELECT payroll_id,count(DISTINCT expense_id) AS expenses FROM audit_references GROUP BY payroll_id
),
healthy_payrolls AS (
 SELECT DISTINCT a.payroll_id
 FROM audit_references a JOIN reference_counts r ON r.payroll_id=a.payroll_id AND r.expenses=1
 JOIN public.teacher_payrolls p ON p.id=a.payroll_id AND p.status='PAID'
 JOIN public.expenses e ON e.id=a.expense_id AND e.amount_cents=p.gross_amount_cents
  AND lower(e.category)='teacher payroll' AND e.archived_at IS NULL
),
classified AS (
 SELECT a.*,p.id IS NOT NULL AS payroll_exists,e.id IS NOT NULL AS expense_exists,
  p.status::text AS payroll_status,h.payroll_id IS NOT NULL AS has_consistent_current_posting,
  p.id IS NOT NULL AND e.id IS NOT NULL AND p.gross_amount_cents IS DISTINCT FROM e.amount_cents AS amount_mismatch,
  e.id IS NOT NULL AND lower(e.category) IS DISTINCT FROM 'teacher payroll' AS category_mismatch,
  e.archived_at IS NOT NULL AS expense_archived,
  CASE WHEN p.id IS NULL AND e.id IS NULL THEN 'BOTH_ABSENT_HISTORICAL_OR_UNRESOLVED'
   WHEN p.id IS NULL THEN 'LIVE_EXPENSE_WITHOUT_PAYROLL'
   WHEN e.id IS NULL AND h.payroll_id IS NOT NULL THEN 'UNRESOLVED_OLD_REFERENCE_WITH_CURRENT_POSTING'
   WHEN a.expense_id IS NULL THEN 'LIVE_PAYROLL_WITH_INVALID_EXPENSE_REFERENCE'
   WHEN e.id IS NULL THEN 'LIVE_PAYROLL_WITH_MISSING_EXPENSE'
   WHEN p.status<>'PAID' OR p.gross_amount_cents IS DISTINCT FROM e.amount_cents
     OR lower(e.category) IS DISTINCT FROM 'teacher payroll' OR e.archived_at IS NOT NULL THEN 'LIVE_POSTING_MISMATCH'
   ELSE 'CONSISTENT_EXISTING_PAIR' END AS classification
 FROM audit_references a LEFT JOIN public.teacher_payrolls p ON p.id=a.payroll_id
 LEFT JOIN public.expenses e ON e.id=a.expense_id
 LEFT JOIN healthy_payrolls h ON h.payroll_id=a.payroll_id
),
findings AS (
 SELECT 'classification' AS section,
  CASE WHEN classification='CONSISTENT_EXISTING_PAIR' THEN 'NO_FINDINGS'
   WHEN classification='UNRESOLVED_OLD_REFERENCE_WITH_CURRENT_POSTING' THEN 'REVIEW_REQUIRED' ELSE 'BLOCKER' END AS status,
  jsonb_build_object('classification',classification,'action',action,'reference_format',reference_format,
   'payroll_exists',payroll_exists,'expense_exists',expense_exists,'payroll_status',payroll_status,'has_consistent_current_posting',has_consistent_current_posting,
   'amount_mismatch',amount_mismatch,'category_mismatch',category_mismatch,'expense_archived',expense_archived,
   'audit_events',count(*),'distinct_reference_pairs',count(DISTINCT (payroll_id,expense_id))) AS details
 FROM classified GROUP BY classification,action,reference_format,payroll_exists,expense_exists,payroll_status,has_consistent_current_posting,amount_mismatch,category_mismatch,expense_archived
 UNION ALL
 SELECT 'summary','REVIEW_REQUIRED',jsonb_build_object(
  'audit_events',count(*),'invalid_audit_expense_references',count(*) FILTER (WHERE expense_id IS NULL OR payroll_id IS NULL),
  'missing_or_inconsistent_posting_links',(SELECT count(*) FROM (SELECT DISTINCT payroll_id,expense_id FROM classified WHERE classification<>'CONSISTENT_EXISTING_PAIR') pairs),
  'live_financial_issue_events',count(*) FILTER (WHERE classification NOT IN ('CONSISTENT_EXISTING_PAIR','BOTH_ABSENT_HISTORICAL_OR_UNRESOLVED','UNRESOLVED_OLD_REFERENCE_WITH_CURRENT_POSTING')),
  'old_references_with_current_posting',count(*) FILTER (WHERE classification='UNRESOLVED_OLD_REFERENCE_WITH_CURRENT_POSTING'),
  'both_absent_events',count(*) FILTER (WHERE classification='BOTH_ABSENT_HISTORICAL_OR_UNRESOLVED'),
  'instruction','2 invalid events and 3 distinct inconsistent links may overlap; do not sum them as 5 records. Both absent does not prove legitimate prior deletion. Preserve audits; no automatic cleanup.')
 FROM classified
 UNION ALL
 SELECT 'current_financial_population','REVIEW_REQUIRED',jsonb_build_object(
  'payrolls',(SELECT count(*) FROM public.teacher_payrolls),
  'paid_payrolls',(SELECT count(*) FROM public.teacher_payrolls WHERE status='PAID'),
  'payroll_expenses',(SELECT count(*) FROM public.expenses WHERE lower(category)='teacher payroll'),
  'archived_payroll_expenses',(SELECT count(*) FROM public.expenses WHERE lower(category)='teacher payroll' AND archived_at IS NOT NULL))
),
report AS (
  SELECT jsonb_build_object(
    'query_id', '14', 'completed', true,
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
