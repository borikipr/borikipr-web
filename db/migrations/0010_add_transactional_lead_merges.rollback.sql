BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.lead_merge_events LIMIT 1)
    OR EXISTS (
      SELECT 1 FROM public.lead_management_events
      WHERE event_type = 'leads_merged'
      LIMIT 1
    )
    OR EXISTS (
      SELECT 1 FROM public.leads
      WHERE merged_at IS NOT NULL OR merged_by IS NOT NULL
      LIMIT 1
    )
    OR EXISTS (
      SELECT 1 FROM public.lead_duplicate_reviews
      WHERE decision = 'merged'
      LIMIT 1
    )
  THEN
    RAISE EXCEPTION 'Migration 0010 rollback blocked: lead merge history exists';
  END IF;
END $$;

ALTER TABLE public.lead_duplicate_reviews
  DROP CONSTRAINT lead_duplicate_reviews_decision_check;

ALTER TABLE public.lead_duplicate_reviews
  ADD CONSTRAINT lead_duplicate_reviews_decision_check CHECK (
    decision IN ('keep_separate', 'same_person')
  );

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

DROP TABLE public.lead_merge_events;

ALTER TABLE public.leads
  DROP CONSTRAINT leads_merge_metadata_check,
  DROP COLUMN merged_by,
  DROP COLUMN merged_at;

COMMIT;
