BEGIN;

ALTER TABLE public.admin_users
  DROP CONSTRAINT admin_users_professional_phone_e164_check,
  ADD CONSTRAINT admin_users_professional_phone_e164_check CHECK (
    professional_phone_e164 IS NULL
    OR professional_phone_e164 ~ '^[+][1-9][0-9]{7,14}$'
  );

COMMIT;
