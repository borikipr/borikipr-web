BEGIN;

ALTER TABLE public.lead_management_events
  DROP CONSTRAINT lead_management_events_type_check;

ALTER TABLE public.lead_management_events
  ADD CONSTRAINT lead_management_events_type_check CHECK (
    event_type IN (
      'status_changed',
      'follow_up_changed',
      'note_added',
      'relationship_created',
      'duplicate_reviewed',
      'contacted',
      'document_accessed'
    )
  );

COMMIT;
