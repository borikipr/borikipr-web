BEGIN;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE professional_title IS NOT NULL OR profile_image_url IS NOT NULL
  ) THEN
    RAISE EXCEPTION '0043 rollback blocked: admin profile identity data exists';
  END IF;
END $$;

ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_profile_image_url_length,
  DROP CONSTRAINT IF EXISTS admin_users_professional_title_length,
  DROP COLUMN IF EXISTS profile_image_url,
  DROP COLUMN IF EXISTS professional_title;

COMMIT;
