BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_password_reset_tokens)
     OR EXISTS (SELECT 1 FROM public.admin_auth_attempts)
     OR EXISTS (
       SELECT 1
       FROM public.admin_users
       WHERE display_name IS NOT NULL
          OR email IS NOT NULL
          OR last_login_at IS NOT NULL
          OR password_changed_at IS NOT NULL
          OR session_version <> 1
     ) THEN
    RAISE EXCEPTION 'Cannot roll back 0013 while admin authentication data exists';
  END IF;
END $$;

DROP TABLE public.admin_auth_attempts;
DROP TABLE public.admin_password_reset_tokens;
DROP INDEX public.admin_users_email_normalized_uidx;

ALTER TABLE public.admin_users
  DROP CONSTRAINT admin_users_session_version_check,
  DROP CONSTRAINT admin_users_email_check,
  DROP CONSTRAINT admin_users_display_name_check,
  DROP COLUMN session_version,
  DROP COLUMN password_changed_at,
  DROP COLUMN last_login_at,
  DROP COLUMN email,
  DROP COLUMN display_name;

COMMIT;
