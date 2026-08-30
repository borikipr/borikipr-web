BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.admin_users
     WHERE professional_phone_e164 IS NOT NULL
  ) THEN
    RAISE EXCEPTION '0052 rollback blocked: professional phone data exists';
  END IF;
END $$;

ALTER TABLE public.admin_users
  DROP CONSTRAINT admin_users_professional_phone_e164_check,
  ADD CONSTRAINT admin_users_professional_phone_e164_check CHECK (
    professional_phone_e164 IS NULL
    OR professional_phone_e164 ~ '^\\+[1-9][0-9]{7,14}$'
  );

COMMIT;
