BEGIN;

-- `activo` remains the compatibility signal during the Team & Access rollout.
-- New direct rows are least-privilege members; existing rows stay usable.
ALTER TABLE public.admin_users
  ADD COLUMN account_state text NOT NULL DEFAULT 'active',
  ADD COLUMN system_role text NOT NULL DEFAULT 'member',
  ADD COLUMN disabled_at timestamptz NULL,
  ADD COLUMN disabled_by_admin_id uuid NULL
    REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  ADD COLUMN setup_completed_at timestamptz NULL,
  ADD CONSTRAINT admin_users_account_state_check CHECK (
    account_state IN ('pending_setup', 'active', 'disabled')
  ),
  ADD CONSTRAINT admin_users_system_role_check CHECK (
    system_role IN ('super_admin', 'admin', 'member')
  ),
  ADD CONSTRAINT admin_users_lifecycle_activo_check CHECK (
    (account_state = 'active' AND activo = true)
    OR (account_state IN ('pending_setup', 'disabled') AND activo = false)
  ),
  ADD CONSTRAINT admin_users_disabled_metadata_check CHECK (
    (account_state = 'disabled' AND disabled_at IS NOT NULL AND disabled_by_admin_id IS NOT NULL)
    OR (account_state <> 'disabled' AND disabled_at IS NULL AND disabled_by_admin_id IS NULL)
  );

ALTER TABLE public.admin_password_reset_tokens
  ADD COLUMN purpose text NOT NULL DEFAULT 'password_reset',
  ADD CONSTRAINT admin_password_reset_tokens_purpose_check CHECK (
    purpose IN ('password_reset', 'account_setup')
  );

CREATE INDEX admin_users_active_access_lookup_idx
  ON public.admin_users (id, system_role)
  WHERE activo = true AND account_state = 'active';

CREATE INDEX admin_users_active_super_admin_idx
  ON public.admin_users (id)
  WHERE activo = true AND account_state = 'active' AND system_role = 'super_admin';

CREATE INDEX admin_password_reset_tokens_active_purpose_idx
  ON public.admin_password_reset_tokens (admin_user_id, purpose, expires_at)
  WHERE used_at IS NULL;

COMMIT;
