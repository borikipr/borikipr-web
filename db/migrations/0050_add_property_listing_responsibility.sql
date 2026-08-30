BEGIN;

ALTER TABLE public.propiedades
  ADD COLUMN listing_responsible_user_id uuid NULL;

ALTER TABLE public.propiedades
  ADD CONSTRAINT propiedades_listing_responsible_user_fk
    FOREIGN KEY (listing_responsible_user_id)
    REFERENCES public.admin_users(id)
    ON DELETE RESTRICT;

CREATE INDEX propiedades_listing_responsible_user_idx
  ON public.propiedades (listing_responsible_user_id)
  WHERE listing_responsible_user_id IS NOT NULL;

CREATE TABLE public.property_listing_responsibility_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.propiedades(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  previous_responsible_user_id uuid NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  next_responsible_user_id uuid NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  actor_admin_user_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_listing_responsibility_events_type_check CHECK (
    event_type IN ('assigned', 'changed', 'cleared')
  ),
  CONSTRAINT property_listing_responsibility_events_transition_check CHECK (
    (event_type = 'assigned'
      AND previous_responsible_user_id IS NULL
      AND next_responsible_user_id IS NOT NULL)
    OR (event_type = 'changed'
      AND previous_responsible_user_id IS NOT NULL
      AND next_responsible_user_id IS NOT NULL
      AND previous_responsible_user_id <> next_responsible_user_id)
    OR (event_type = 'cleared'
      AND previous_responsible_user_id IS NOT NULL
      AND next_responsible_user_id IS NULL)
  )
);

CREATE INDEX property_listing_responsibility_events_property_occurred_idx
  ON public.property_listing_responsibility_events (property_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.property_listing_responsibility_events_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- A property FK cascade is the only legitimate event deletion. The parent
  -- row has already been removed in the current transaction at this point.
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM public.propiedades WHERE id = OLD.property_id
  ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'property_listing_responsibility_events are append-only';
END;
$$;

CREATE TRIGGER property_listing_responsibility_events_immutable_trigger
  BEFORE UPDATE OR DELETE ON public.property_listing_responsibility_events
  FOR EACH ROW EXECUTE FUNCTION public.property_listing_responsibility_events_immutable();

COMMIT;
