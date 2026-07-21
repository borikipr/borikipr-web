BEGIN;

ALTER TABLE public.leads
  ADD COLUMN merged_at timestamptz NULL,
  ADD COLUMN merged_by text NULL;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_merge_metadata_check CHECK (
    (
      merged_into_lead_id IS NULL
      AND merged_at IS NULL
      AND merged_by IS NULL
      AND status <> 'merged'
    )
    OR (
      merged_into_lead_id IS NOT NULL
      AND merged_at IS NOT NULL
      AND char_length(merged_by) BETWEEN 1 AND 200
      AND status = 'merged'
    )
  );

CREATE TABLE public.lead_merge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  secondary_lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  actor_username text NOT NULL,
  operation_key uuid NOT NULL,
  identity_snapshot jsonb NOT NULL,
  affected_counts jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_merge_events_distinct_leads_check CHECK (
    primary_lead_id <> secondary_lead_id
  ),
  CONSTRAINT lead_merge_events_actor_username_check CHECK (
    char_length(actor_username) BETWEEN 1 AND 200
  ),
  CONSTRAINT lead_merge_events_identity_snapshot_object_check CHECK (
    jsonb_typeof(identity_snapshot) = 'object'
  ),
  CONSTRAINT lead_merge_events_affected_counts_object_check CHECK (
    jsonb_typeof(affected_counts) = 'object'
  )
);

CREATE UNIQUE INDEX lead_merge_events_operation_key_uidx
  ON public.lead_merge_events (operation_key);

CREATE UNIQUE INDEX lead_merge_events_secondary_lead_id_uidx
  ON public.lead_merge_events (secondary_lead_id);

CREATE INDEX lead_merge_events_primary_created_at_idx
  ON public.lead_merge_events (primary_lead_id, created_at DESC);

ALTER TABLE public.lead_duplicate_reviews
  DROP CONSTRAINT lead_duplicate_reviews_decision_check;

ALTER TABLE public.lead_duplicate_reviews
  ADD CONSTRAINT lead_duplicate_reviews_decision_check CHECK (
    decision IN ('keep_separate', 'same_person', 'merged')
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
      'document_accessed',
      'leads_merged'
    )
  );

COMMIT;
