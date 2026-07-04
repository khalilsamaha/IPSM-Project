-- Allow independent students to be created without a family/group payer.
ALTER TABLE public.students
ALTER COLUMN family_id DROP NOT NULL;
