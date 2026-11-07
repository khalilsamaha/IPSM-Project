-- 02. IPSM project rakzehtbpzseetldbohm ONLY. Run this ENTIRE file in SQL Editor.
-- Read README.md first. Missing results, errors and timeouts are verification blockers.
-- Only schema metadata, hashes and aggregate diagnostics are returned.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
-- Does NOT bypass RLS: fail rather than return policy-filtered counts.
SET LOCAL row_security = off;

WITH
findings AS (
 SELECT 'column' AS section,'REVIEW_REQUIRED' AS status,jsonb_build_object(
  'table',c.relname,'position',a.attnum,'name',a.attname,
  'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
  'identity',a.attidentity,'generated',a.attgenerated,'has_default',d.oid IS NOT NULL,
  'default_md5',md5(pg_get_expr(d.adbin,d.adrelid))) AS details
 FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
 WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f') AND a.attnum>0 AND NOT a.attisdropped
 UNION ALL
 SELECT 'enum','REVIEW_REQUIRED',jsonb_build_object('type',t.typname,'label',e.enumlabel,'order',e.enumsortorder)
 FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
 JOIN pg_catalog.pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public'
 UNION ALL
 SELECT 'constraint',CASE WHEN NOT co.convalidated THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END,
  jsonb_build_object('schema',n.nspname,'table',c.relname,'name',co.conname,'type',co.contype,
   'validated',co.convalidated,'deferrable',co.condeferrable,'initially_deferred',co.condeferred,
   'columns',(SELECT jsonb_agg(a.attname ORDER BY k.ord) FROM unnest(co.conkey) WITH ORDINALITY k(num,ord)
     JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.num),
   'parent_schema',pn.nspname,'parent_table',p.relname,
   'parent_columns',(SELECT jsonb_agg(a.attname ORDER BY k.ord) FROM unnest(co.confkey) WITH ORDINALITY k(num,ord)
     JOIN pg_catalog.pg_attribute a ON a.attrelid=p.oid AND a.attnum=k.num),
   'delete_action',co.confdeltype,'update_action',co.confupdtype,'match_type',co.confmatchtype,
   'definition_md5',md5(pg_get_constraintdef(co.oid,true)))
 FROM pg_catalog.pg_constraint co JOIN pg_catalog.pg_class c ON c.oid=co.conrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 LEFT JOIN pg_catalog.pg_class p ON p.oid=co.confrelid LEFT JOIN pg_catalog.pg_namespace pn ON pn.oid=p.relnamespace
 WHERE n.nspname='public' OR pn.nspname='public'
 UNION ALL
 SELECT 'index',CASE WHEN NOT i.indisvalid OR NOT i.indisready THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END,
  jsonb_build_object('table',c.relname,'name',idx.relname,'unique',i.indisunique,'primary',i.indisprimary,
   'valid',i.indisvalid,'ready',i.indisready,'key_count',i.indnkeyatts,'attribute_count',i.indnatts,
   'columns',(SELECT jsonb_agg(a.attname ORDER BY k.ord) FROM unnest(i.indkey) WITH ORDINALITY k(num,ord)
    LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.num),
   'has_expression',i.indexprs IS NOT NULL,'expression_md5',md5(pg_get_expr(i.indexprs,i.indrelid)),
   'has_predicate',i.indpred IS NOT NULL,'predicate_md5',md5(pg_get_expr(i.indpred,i.indrelid)),
   'definition_md5',md5(pg_get_indexdef(i.indexrelid)))
 FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class idx ON idx.oid=i.indexrelid
 JOIN pg_catalog.pg_class c ON c.oid=i.indrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public'
),
report AS (
  SELECT jsonb_build_object(
    'query_id', '02', 'completed', true,
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
