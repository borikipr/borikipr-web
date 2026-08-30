BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE professional_email IS NOT NULL
        OR professional_phone_e164 IS NOT NULL
        OR professional_phone_whatsapp_enabled = true
        OR professional_bio IS NOT NULL
        OR public_profile_slug IS NOT NULL
        OR public_profile_enabled = true
        OR public_profile_approval_state <> 'draft'
        OR public_profile_approved_at IS NOT NULL
        OR public_profile_approved_by_admin_id IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.admin_access_events
     WHERE event_type IN (
       'public_profile_approved', 'public_profile_approval_withdrawn',
       'public_profile_review_invalidated'
     )
  ) THEN
    RAISE EXCEPTION '0049 rollback blocked: professional profile data or audit evidence exists';
  END IF;
END $$;

DROP INDEX IF EXISTS public.admin_users_public_profile_slug_uidx;
ALTER TABLE public.admin_access_events
  DROP CONSTRAINT admin_access_events_type_check,
  ADD CONSTRAINT admin_access_events_type_check CHECK (
    event_type IN (
      'user_created', 'setup_issued', 'account_activated', 'account_disabled',
      'account_reactivated', 'system_role_changed', 'module_access_granted',
      'module_access_revoked', 'broker_authorization_granted',
      'broker_authorization_revoked', 'assigned_broker_changed'
    )
  );
ALTER TABLE public.admin_users
  DROP CONSTRAINT admin_users_public_profile_state_metadata_check,
  DROP CONSTRAINT admin_users_public_profile_approval_state_check,
  DROP CONSTRAINT admin_users_public_profile_slug_check,
  DROP CONSTRAINT admin_users_professional_bio_check,
  DROP CONSTRAINT admin_users_professional_phone_whatsapp_check,
  DROP CONSTRAINT admin_users_professional_phone_e164_check,
  DROP CONSTRAINT admin_users_professional_email_check,
  DROP COLUMN public_profile_approved_by_admin_id,
  DROP COLUMN public_profile_approved_at,
  DROP COLUMN public_profile_approval_state,
  DROP COLUMN public_profile_slug,
  DROP COLUMN public_profile_enabled,
  DROP COLUMN professional_bio,
  DROP COLUMN professional_phone_whatsapp_enabled,
  DROP COLUMN professional_phone_e164,
  DROP COLUMN professional_email;

COMMIT;
