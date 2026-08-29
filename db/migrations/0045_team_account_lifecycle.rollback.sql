BEGIN;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE account_state <> 'active' OR system_role <> 'member'
       OR disabled_at IS NOT NULL OR disabled_by_admin_id IS NOT NULL
       OR setup_completed_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.admin_password_reset_tokens
    WHERE purpose <> 'password_reset'
  ) THEN
    RAISE EXCEPTION '0045 rollback blocked: Team & Access lifecycle data exists';
  END IF;
END $$;

DROP INDEX IF EXISTS public.admin_password_reset_tokens_active_purpose_idx;
DROP INDEX IF EXISTS public.admin_users_active_super_admin_idx;
DROP INDEX IF EXISTS public.admin_users_active_access_lookup_idx;

ALTER TABLE public.admin_password_reset_tokens
  DROP CONSTRAINT IF EXISTS admin_password_reset_tokens_purpose_check,
  DROP COLUMN IF EXISTS purpose;

ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_disabled_metadata_check,
  DROP CONSTRAINT IF EXISTS admin_users_lifecycle_activo_check,
  DROP CONSTRAINT IF EXISTS admin_users_system_role_check,
  DROP CONSTRAINT IF EXISTS admin_users_account_state_check,
  DROP COLUMN IF EXISTS setup_completed_at,
  DROP COLUMN IF EXISTS disabled_by_admin_id,
  DROP COLUMN IF EXISTS disabled_at,
  DROP COLUMN IF EXISTS system_role,
  DROP COLUMN IF EXISTS account_state;

COMMIT;
