BEGIN;

-- Block every concurrent property/event writer before checking whether this
-- additive schema is still unused. A rollback must never race a new assignment.
LOCK TABLE public.propiedades, public.property_listing_responsibility_events
  IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.propiedades
     WHERE listing_responsible_user_id IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.property_listing_responsibility_events
  ) THEN
    RAISE EXCEPTION '0050 rollback blocked: listing responsibility data or audit history exists';
  END IF;
END $$;

DROP TRIGGER IF EXISTS property_listing_responsibility_events_immutable_trigger
  ON public.property_listing_responsibility_events;
DROP FUNCTION IF EXISTS public.property_listing_responsibility_events_immutable();
DROP INDEX IF EXISTS public.property_listing_responsibility_events_property_occurred_idx;
DROP TABLE public.property_listing_responsibility_events;
DROP INDEX IF EXISTS public.propiedades_listing_responsible_user_idx;
ALTER TABLE public.propiedades
  DROP CONSTRAINT propiedades_listing_responsible_user_fk,
  DROP COLUMN listing_responsible_user_id;

COMMIT;
