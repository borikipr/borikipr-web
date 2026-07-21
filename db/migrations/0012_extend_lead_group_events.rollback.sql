BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.lead_group_events
    WHERE event_type IN ('member_role_changed', 'primary_contact_changed')
  ) THEN
    RAISE EXCEPTION 'Cannot roll back 0012 while extended lead group events exist';
  END IF;
END $$;

ALTER TABLE public.lead_group_events
  DROP CONSTRAINT lead_group_events_type_check;

ALTER TABLE public.lead_group_events
  ADD CONSTRAINT lead_group_events_type_check CHECK (
    event_type IN (
      'group_created', 'member_added', 'member_removed', 'status_changed',
      'follow_up_changed', 'note_added', 'contacted'
    )
  );

COMMIT;
