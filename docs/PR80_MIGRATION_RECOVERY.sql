-- PR80 registration-attempt recovery script
--
-- Run only after the normal Prisma migration failed because the original
-- created_by_id foreign key named the non-existent user_profiles table.
-- This deliberately is NOT the normal Prisma/Supabase migration: it is
-- idempotent only for the known partial-attempt states described in PR80.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'RegistrationAttemptStatus'
  ) THEN
    CREATE TYPE public."RegistrationAttemptStatus" AS ENUM ('IDENTITY_SAVED', 'COMPLETED', 'CANCELLED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'ShiftStatus' AND e.enumlabel = 'AUTO_CLOSED'
  ) THEN
    ALTER TYPE public."ShiftStatus" ADD VALUE 'AUTO_CLOSED';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.registration_attempts (
  id UUID PRIMARY KEY,
  status public."RegistrationAttemptStatus" NOT NULL DEFAULT 'IDENTITY_SAVED',
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE RESTRICT,
  primary_student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  last_failure_reason TEXT,
  created_by_id UUID,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Remove only foreign keys attached to created_by_id. This repairs a manually
-- created user_profiles constraint without disturbing the four data relations.
DO $$
DECLARE constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.contype = 'f'
      AND con.conrelid = 'public.registration_attempts'::regclass
      AND con.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = con.conrelid AND attname = 'created_by_id')]
  LOOP
    EXECUTE format('ALTER TABLE public.registration_attempts DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.registration_attempts
  ADD CONSTRAINT registration_attempts_created_by_id_fkey
  FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS registration_attempts_family_id_idx ON public.registration_attempts(family_id);
CREATE INDEX IF NOT EXISTS registration_attempts_primary_student_id_idx ON public.registration_attempts(primary_student_id);
CREATE INDEX IF NOT EXISTS registration_attempts_status_idx ON public.registration_attempts(status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN pg_namespace n ON n.oid = parent.relnamespace
    WHERE con.contype = 'f' AND con.conrelid = 'public.registration_attempts'::regclass
      AND n.nspname = 'public' AND parent.relname = 'users'
  ) THEN RAISE EXCEPTION 'PR80 recovery failed: created_by_id does not reference public.users'; END IF;
END $$;
