BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.lead_management_events
    WHERE event_type = 'contacted'
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Rollback blocked: contacted management events exist';
  END IF;
END
$$;

ALTER TABLE public.lead_management_events
  DROP CONSTRAINT lead_management_events_type_check;

ALTER TABLE public.lead_management_events
  ADD CONSTRAINT lead_management_events_type_check CHECK (
    event_type IN (
      'status_changed',
      'follow_up_changed',
      'note_added',
      'relationship_created',
      'duplicate_reviewed'
    )
  );

COMMIT;
