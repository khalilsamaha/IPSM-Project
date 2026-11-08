-- MODIFYING TEMPLATE FOR SEPARATE ADMINISTRATOR REVIEW. NOT A PREFLIGHT.
-- Do not execute against production under PR90 preparation authorization.
-- Drain writers; certify historical non-use and complete recovery first.
-- Every REPLACE_* value is deliberately invalid until explicitly reviewed.
-- For a hold, keep enabled FALSE. For activation, an authorized operator must
-- explicitly choose TRUE after certification, then separately select the reviewed
-- ID in the appropriate environment. No application/client invokes this template.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE public.business_identifier_activations, public.business_identifier_allocations IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO public.business_identifier_activations(
  id, enabled, non_use_sha256, recovery_sha256, approved_by, database_oid, server_started_at
) VALUES (
  'REPLACE_REVIEWED_ACTIVATION_UUID'::uuid, FALSE,
  'REPLACE_PRIVATE_NON_USE_EVIDENCE_SHA256',
  'REPLACE_PRIVATE_COMPLETE_RECOVERY_MANIFEST_SHA256',
  'REPLACE_APPROVER_AND_REVIEW_REFERENCE', 0, now()
);
-- Binding fields above are replaced by the validating trigger. Review the
-- targeted read-only Query20 afterward. Do not expose private manifest records.
COMMIT;
