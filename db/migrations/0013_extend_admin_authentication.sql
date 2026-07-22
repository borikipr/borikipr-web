BEGIN;

ALTER TABLE public.admin_users
  ADD COLUMN display_name text NULL,
  ADD COLUMN email text NULL,
  ADD COLUMN last_login_at timestamptz NULL,
  ADD COLUMN password_changed_at timestamptz NULL,
  ADD COLUMN session_version integer NOT NULL DEFAULT 1,
  ADD CONSTRAINT admin_users_display_name_check CHECK (
    display_name IS NULL OR btrim(display_name) <> ''
  ),
  ADD CONSTRAINT admin_users_email_check CHECK (
    email IS NULL OR (email = lower(btrim(email)) AND position('@' IN email) > 1)
  ),
  ADD CONSTRAINT admin_users_session_version_check CHECK (session_version > 0);

CREATE UNIQUE INDEX admin_users_email_normalized_uidx
  ON public.admin_users (lower(email))
  WHERE email IS NOT NULL;

CREATE TABLE public.admin_password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL
    REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  email_sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_password_reset_tokens_hash_check CHECK (
    token_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT admin_password_reset_tokens_expiry_check CHECK (
    expires_at > created_at
  ),
  CONSTRAINT admin_password_reset_tokens_used_check CHECK (
    used_at IS NULL OR used_at >= created_at
  )
);

CREATE UNIQUE INDEX admin_password_reset_tokens_hash_uidx
  ON public.admin_password_reset_tokens (token_hash);

CREATE INDEX admin_password_reset_tokens_admin_created_at_idx
  ON public.admin_password_reset_tokens (admin_user_id, created_at DESC);

CREATE INDEX admin_password_reset_tokens_active_expiry_idx
  ON public.admin_password_reset_tokens (expires_at)
  WHERE used_at IS NULL;

CREATE TABLE public.admin_auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_hash text NOT NULL,
  attempt_type text NOT NULL,
  succeeded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_auth_attempts_identifier_hash_check CHECK (
    identifier_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT admin_auth_attempts_type_check CHECK (
    attempt_type IN ('login', 'password_reset_request')
  )
);

CREATE INDEX admin_auth_attempts_lookup_idx
  ON public.admin_auth_attempts (attempt_type, identifier_hash, created_at DESC);

COMMIT;
