-- 07. IPSM project rakzehtbpzseetldbohm ONLY. Run this ENTIRE file in SQL Editor.
-- Read README.md first. Missing results, errors and timeouts are verification blockers.
-- Only schema metadata, hashes and aggregate diagnostics are returned.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
-- Does NOT bypass RLS: fail rather than return policy-filtered counts.
SET LOCAL row_security = off;

WITH
links AS (
 SELECT entity_id AS payroll_id,
  CASE WHEN metadata->>'expenseId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       THEN (metadata->>'expenseId')::uuid END AS expense_id
 FROM public.audit_logs WHERE entity='TeacherPayroll' AND action IN ('mark_paid','payroll_shift_reconciled')
),
distinct_links AS (SELECT DISTINCT payroll_id,expense_id FROM links),
checks(section,affected) AS (
 SELECT 'invalid_audit_expense_references',count(*) FROM links WHERE expense_id IS NULL OR payroll_id IS NULL
 UNION ALL SELECT 'multiple_expenses_for_payroll',count(*) FROM (
  SELECT payroll_id FROM links GROUP BY payroll_id HAVING count(DISTINCT expense_id)>1) q
 UNION ALL SELECT 'multiple_payrolls_for_expense',count(*) FROM (
  SELECT expense_id FROM links WHERE expense_id IS NOT NULL GROUP BY expense_id HAVING count(DISTINCT payroll_id)>1) q
 UNION ALL SELECT 'missing_or_inconsistent_posting_links',count(*)
 FROM distinct_links l LEFT JOIN public.teacher_payrolls p ON p.id=l.payroll_id
 LEFT JOIN public.expenses e ON e.id=l.expense_id
 WHERE p.id IS NULL OR e.id IS NULL OR p.status<>'PAID' OR p.gross_amount_cents IS DISTINCT FROM e.amount_cents
  OR lower(e.category) IS DISTINCT FROM 'teacher payroll' OR e.archived_at IS NOT NULL
 UNION ALL SELECT 'paid_payroll_without_recoverable_posting',count(*) FROM public.teacher_payrolls p
 WHERE p.status='PAID' AND NOT EXISTS (SELECT 1 FROM links l JOIN public.expenses e ON e.id=l.expense_id WHERE l.payroll_id=p.id)
 UNION ALL SELECT 'payroll_expense_without_recoverable_payroll',count(*) FROM public.expenses e
 WHERE lower(e.category)='teacher payroll' AND NOT EXISTS (SELECT 1 FROM links l JOIN public.teacher_payrolls p ON p.id=l.payroll_id WHERE l.expense_id=e.id)
),
findings AS (
 SELECT section,CASE WHEN affected>0 THEN 'BLOCKER' ELSE 'NO_FINDINGS' END AS status,
  jsonb_build_object('affected',affected) AS details FROM checks
),
report AS (
  SELECT jsonb_build_object(
    'query_id', '07', 'completed', true,
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
