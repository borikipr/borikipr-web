BEGIN;

-- Presentation/contact foundation only. Existing accounts remain private.
ALTER TABLE public.admin_users
  ADD COLUMN professional_email text NULL,
  ADD COLUMN professional_phone_e164 text NULL,
  ADD COLUMN professional_phone_whatsapp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN professional_bio text NULL,
  ADD COLUMN public_profile_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN public_profile_slug text NULL,
  ADD COLUMN public_profile_approval_state text NOT NULL DEFAULT 'draft',
  ADD COLUMN public_profile_approved_at timestamptz NULL,
  ADD COLUMN public_profile_approved_by_admin_id uuid NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT;

ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_professional_email_check CHECK (
    professional_email IS NULL OR (
      professional_email = lower(btrim(professional_email))
      AND char_length(professional_email) BETWEEN 3 AND 254
      AND professional_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    )
  ),
  ADD CONSTRAINT admin_users_professional_phone_e164_check CHECK (
    professional_phone_e164 IS NULL OR professional_phone_e164 ~ '^\\+[1-9][0-9]{7,14}$'
  ),
  ADD CONSTRAINT admin_users_professional_phone_whatsapp_check CHECK (
    professional_phone_whatsapp_enabled = false OR professional_phone_e164 IS NOT NULL
  ),
  ADD CONSTRAINT admin_users_professional_bio_check CHECK (
    professional_bio IS NULL OR char_length(btrim(professional_bio)) BETWEEN 1 AND 2000
  ),
  ADD CONSTRAINT admin_users_public_profile_slug_check CHECK (
    public_profile_slug IS NULL OR (
      public_profile_slug = lower(btrim(public_profile_slug))
      AND char_length(public_profile_slug) BETWEEN 3 AND 120
      AND public_profile_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    )
  ),
  ADD CONSTRAINT admin_users_public_profile_approval_state_check CHECK (
    public_profile_approval_state IN ('draft', 'pending_review', 'approved', 'disabled')
  ),
  ADD CONSTRAINT admin_users_public_profile_state_metadata_check CHECK (
    (public_profile_approval_state = 'approved'
      AND public_profile_enabled = true
      AND public_profile_approved_at IS NOT NULL
      AND public_profile_approved_by_admin_id IS NOT NULL)
    OR (public_profile_approval_state = 'pending_review'
      AND public_profile_enabled = true
      AND public_profile_approved_at IS NULL
      AND public_profile_approved_by_admin_id IS NULL)
    OR (public_profile_approval_state IN ('draft', 'disabled')
      AND public_profile_enabled = false
      AND public_profile_approved_at IS NULL
      AND public_profile_approved_by_admin_id IS NULL)
  );

CREATE UNIQUE INDEX admin_users_public_profile_slug_uidx
  ON public.admin_users (lower(public_profile_slug))
  WHERE public_profile_slug IS NOT NULL;

ALTER TABLE public.admin_access_events
  DROP CONSTRAINT admin_access_events_type_check,
  ADD CONSTRAINT admin_access_events_type_check CHECK (
    event_type IN (
      'user_created', 'setup_issued', 'account_activated', 'account_disabled',
      'account_reactivated', 'system_role_changed', 'module_access_granted',
      'module_access_revoked', 'broker_authorization_granted',
      'broker_authorization_revoked', 'assigned_broker_changed',
      'public_profile_approved', 'public_profile_approval_withdrawn',
      'public_profile_review_invalidated'
    )
  );

COMMIT;
