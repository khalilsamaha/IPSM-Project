BEGIN;
-- New selection catalogue only. Expense.category remains the historical snapshot;
-- no rewrite, backfill, relation, cascade or reporting change is needed.
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  archived_at timestamp(3),
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT expense_categories_name_check CHECK (
    name = btrim(name) AND length(name) BETWEEN 1 AND 80
    AND lower(regexp_replace(name, '\s+', ' ', 'g')) <> 'teacher payroll'
  )
);
CREATE UNIQUE INDEX expense_categories_name_key ON public.expense_categories (lower(name));
INSERT INTO public.expense_categories(name) VALUES
  ('Rent'), ('Electricity'), ('Cellphone'), ('Ogero / Internet'),
  ('Water'), ('Maintenance'), ('Office Supplies'), ('Other');
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
-- No browser policies. Existing owner-backed Prisma accesses this catalogue;
-- role authorization is performed server-side on each management operation.
-- Remove ALL inherited creator-default grants on this object, including PG17
-- MAINTAIN, TRIGGER, REFERENCES and TRUNCATE. Never change global default ACLs.
DO $$
DECLARE recipient record; client record; owner_id oid;
BEGIN
  SELECT relowner INTO owner_id FROM pg_class WHERE oid='public.expense_categories'::regclass;
  FOR recipient IN SELECT DISTINCT grantee FROM aclexplode(
    (SELECT coalesce(relacl, acldefault('r',relowner)) FROM pg_class WHERE oid='public.expense_categories'::regclass)
  ) WHERE grantee <> owner_id LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.expense_categories FROM %s CASCADE',
      CASE WHEN recipient.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(recipient.grantee)) END);
  END LOOP;
  FOR client IN SELECT oid, rolname, rolsuper FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP
    IF client.rolsuper OR pg_has_role(client.oid,owner_id,'MEMBER') OR
      has_table_privilege(client.oid,'public.expense_categories','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
      RAISE EXCEPTION 'Unsafe effective expense category privileges for %', client.rolname;
    END IF;
  END LOOP;
END $$;
COMMIT;
