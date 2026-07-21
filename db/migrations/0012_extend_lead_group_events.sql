BEGIN;

ALTER TABLE public.lead_group_events
  DROP CONSTRAINT lead_group_events_type_check;

ALTER TABLE public.lead_group_events
  ADD CONSTRAINT lead_group_events_type_check CHECK (
    event_type IN (
      'group_created',
      'member_added',
      'member_removed',
      'member_role_changed',
      'primary_contact_changed',
      'status_changed',
      'follow_up_changed',
      'note_added',
      'contacted'
    )
  );

COMMIT;
