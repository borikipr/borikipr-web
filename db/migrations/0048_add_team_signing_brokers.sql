BEGIN;

ALTER TABLE public.admin_users
  ADD COLUMN signing_broker_authorized_at timestamptz NULL,
  ADD COLUMN signing_broker_authorized_by_admin_id uuid NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  ADD COLUMN assigned_broker_user_id uuid NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT;

CREATE INDEX admin_users_signing_broker_active_idx
  ON public.admin_users (id)
  WHERE activo = true AND account_state = 'active' AND signing_broker_authorized_at IS NOT NULL;

CREATE INDEX admin_users_assigned_broker_idx
  ON public.admin_users (assigned_broker_user_id)
  WHERE assigned_broker_user_id IS NOT NULL;

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

DO $$
DECLARE
  ivonne_id uuid := '837a7fca-c067-4878-a4eb-01c12a4cf7ba';
  cedric_id uuid := '3cefce78-7d62-485d-9faa-6fed1b6ae377';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE id = cedric_id AND activo = true AND account_state = 'active'
       AND system_role = 'super_admin'
  ) THEN
    RAISE EXCEPTION '0048 explicit Cedric super_admin backfill preconditions failed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE id = ivonne_id AND activo = true AND account_state = 'active'
       AND 'real_estate_broker' = ANY(professional_roles)
       AND nullif(btrim(professional_license_number), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION '0048 explicit Ivonne broker backfill preconditions failed';
  END IF;
  UPDATE public.admin_users
     SET signing_broker_authorized_at = COALESCE(signing_broker_authorized_at, now()),
         signing_broker_authorized_by_admin_id = COALESCE(signing_broker_authorized_by_admin_id, cedric_id)
   WHERE id = ivonne_id;
  INSERT INTO public.admin_access_events (event_type, actor_admin_user_id, target_admin_user_id, metadata)
  SELECT 'broker_authorization_granted', cedric_id, ivonne_id,
         jsonb_build_object('source', 'phase_14_explicit_backfill')
   WHERE NOT EXISTS (
     SELECT 1 FROM public.admin_access_events
      WHERE event_type = 'broker_authorization_granted' AND target_admin_user_id = ivonne_id
        AND metadata->>'source' = 'phase_14_explicit_backfill'
   );
END $$;

COMMIT;
