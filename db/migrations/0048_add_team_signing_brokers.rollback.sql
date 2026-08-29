BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_access_events WHERE event_type IN ('broker_authorization_granted','broker_authorization_revoked','assigned_broker_changed')) THEN
    RAISE EXCEPTION '0048 rollback blocked: broker access audit history exists';
  END IF;
END $$;
ALTER TABLE public.admin_access_events DROP CONSTRAINT admin_access_events_type_check;
ALTER TABLE public.admin_access_events ADD CONSTRAINT admin_access_events_type_check CHECK (event_type IN ('user_created','setup_issued','account_activated','account_disabled','account_reactivated','system_role_changed','module_access_granted','module_access_revoked'));
DROP INDEX IF EXISTS public.admin_users_assigned_broker_idx;
DROP INDEX IF EXISTS public.admin_users_signing_broker_active_idx;
ALTER TABLE public.admin_users DROP COLUMN assigned_broker_user_id, DROP COLUMN signing_broker_authorized_by_admin_id, DROP COLUMN signing_broker_authorized_at;
COMMIT;
