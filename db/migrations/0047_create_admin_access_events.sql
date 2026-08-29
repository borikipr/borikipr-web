BEGIN;

CREATE TABLE public.admin_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  actor_admin_user_id uuid NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  target_admin_user_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id text NULL,
  CONSTRAINT admin_access_events_type_check CHECK (
    event_type IN (
      'user_created', 'setup_issued', 'account_activated', 'account_disabled',
      'account_reactivated', 'system_role_changed', 'module_access_granted',
      'module_access_revoked'
    )
  ),
  CONSTRAINT admin_access_events_metadata_object_check CHECK (
    jsonb_typeof(metadata) = 'object'
  )
);

CREATE INDEX admin_access_events_target_occurred_idx
  ON public.admin_access_events (target_admin_user_id, occurred_at DESC);

CREATE INDEX admin_access_events_actor_occurred_idx
  ON public.admin_access_events (actor_admin_user_id, occurred_at DESC)
  WHERE actor_admin_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_access_events_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'admin_access_events are append-only';
END;
$$;

CREATE TRIGGER admin_access_events_immutable_trigger
  BEFORE UPDATE OR DELETE ON public.admin_access_events
  FOR EACH ROW EXECUTE FUNCTION public.admin_access_events_immutable();

COMMIT;
