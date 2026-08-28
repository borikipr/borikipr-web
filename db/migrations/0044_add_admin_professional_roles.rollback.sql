BEGIN;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE cardinality(professional_roles) > 0 OR professional_license_number IS NOT NULL
  ) THEN
    RAISE EXCEPTION '0044 rollback blocked: professional profile role data exists';
  END IF;
END $$;

ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_professional_license_number_length,
  DROP CONSTRAINT IF EXISTS admin_users_professional_roles_check,
  DROP COLUMN IF EXISTS professional_license_number,
  DROP COLUMN IF EXISTS professional_roles;

COMMIT;
