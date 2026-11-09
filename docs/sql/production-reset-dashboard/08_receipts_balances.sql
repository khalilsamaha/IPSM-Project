-- 08. IPSM project rakzehtbpzseetldbohm ONLY. Run this ENTIRE file in SQL Editor.
-- Read README.md first. Missing results, errors and timeouts are verification blockers.
-- Only schema metadata, hashes and aggregate diagnostics are returned.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
-- Does NOT bypass RLS: fail rather than return policy-filtered counts.
SET LOCAL row_security = off;

WITH
owners AS (
 SELECT receipt_number,id AS payment_id FROM public.payments WHERE receipt_number IS NOT NULL
 UNION ALL SELECT receipt_number,payment_id FROM public.receipts
),
checks(section,affected) AS (
 SELECT 'receipt_numbers_with_multiple_payment_owners',count(*) FROM (
  SELECT receipt_number FROM owners GROUP BY receipt_number HAVING count(DISTINCT payment_id)>1) q
 UNION ALL SELECT 'receipt_payment_number_mismatches',count(*) FROM public.receipts r
 JOIN public.payments p ON p.id=r.payment_id WHERE p.receipt_number IS DISTINCT FROM r.receipt_number
 UNION ALL SELECT 'receipts_without_payment_owner',count(*) FROM public.receipts r
 LEFT JOIN public.payments p ON p.id=r.payment_id WHERE p.id IS NULL
 UNION ALL SELECT 'inconsistent_enrollment_charge_or_balance',count(*) FROM public.enrollments
 WHERE fee_cents<0 OR discount_cents<0 OR final_fee_cents<>greatest(0,fee_cents-discount_cents)
  OR paid_cents<0 OR remaining_cents<0 OR paid_cents+remaining_cents<>final_fee_cents
),
findings AS (
 SELECT section,CASE WHEN affected>0 THEN 'BLOCKER' ELSE 'NO_FINDINGS' END AS status,
  jsonb_build_object('affected',affected,'includes_archived_and_void_history',true) AS details FROM checks
),
report AS (
  SELECT jsonb_build_object(
    'query_id', '08', 'completed', true,
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
