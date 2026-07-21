BEGIN;

ALTER TABLE public.leads
  ADD COLUMN next_follow_up_at timestamptz NULL;

CREATE INDEX leads_next_follow_up_at_idx
  ON public.leads (next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL
    AND merged_into_lead_id IS NULL;

CREATE TABLE public.lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  body text NOT NULL,
  author_username text NOT NULL,
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_notes_body_check CHECK (char_length(body) BETWEEN 1 AND 5000),
  CONSTRAINT lead_notes_author_username_check CHECK (
    char_length(author_username) BETWEEN 1 AND 200
  )
);

CREATE UNIQUE INDEX lead_notes_idempotency_key_uidx
  ON public.lead_notes (idempotency_key);

CREATE INDEX lead_notes_lead_created_at_idx
  ON public.lead_notes (lead_id, created_at DESC);

CREATE TABLE public.lead_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  related_lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  relationship_type text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_relationships_distinct_leads_check CHECK (lead_id <> related_lead_id),
  CONSTRAINT lead_relationships_type_check CHECK (
    relationship_type IN (
      'family',
      'primary_buyer',
      'co_buyer',
      'prequalified_person',
      'representative_contact',
      'other'
    )
  ),
  CONSTRAINT lead_relationships_created_by_check CHECK (
    char_length(created_by) BETWEEN 1 AND 200
  )
);

CREATE UNIQUE INDEX lead_relationships_pair_uidx
  ON public.lead_relationships (
    LEAST(lead_id, related_lead_id),
    GREATEST(lead_id, related_lead_id)
  );

CREATE INDEX lead_relationships_lead_id_idx
  ON public.lead_relationships (lead_id, created_at DESC);

CREATE INDEX lead_relationships_related_lead_id_idx
  ON public.lead_relationships (related_lead_id, created_at DESC);

CREATE TABLE public.lead_duplicate_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  compared_lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  decision text NOT NULL,
  decided_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_duplicate_reviews_distinct_leads_check CHECK (
    lead_id <> compared_lead_id
  ),
  CONSTRAINT lead_duplicate_reviews_decision_check CHECK (
    decision IN ('keep_separate', 'same_person')
  ),
  CONSTRAINT lead_duplicate_reviews_decided_by_check CHECK (
    char_length(decided_by) BETWEEN 1 AND 200
  )
);

CREATE UNIQUE INDEX lead_duplicate_reviews_pair_uidx
  ON public.lead_duplicate_reviews (
    LEAST(lead_id, compared_lead_id),
    GREATEST(lead_id, compared_lead_id)
  );

CREATE INDEX lead_duplicate_reviews_lead_id_idx
  ON public.lead_duplicate_reviews (lead_id, updated_at DESC);

CREATE INDEX lead_duplicate_reviews_compared_lead_id_idx
  ON public.lead_duplicate_reviews (compared_lead_id, updated_at DESC);

CREATE TABLE public.lead_management_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_username text NOT NULL,
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_management_events_type_check CHECK (
    event_type IN (
      'status_changed',
      'follow_up_changed',
      'note_added',
      'relationship_created',
      'duplicate_reviewed'
    )
  ),
  CONSTRAINT lead_management_events_data_object_check CHECK (
    jsonb_typeof(event_data) = 'object'
  ),
  CONSTRAINT lead_management_events_actor_username_check CHECK (
    char_length(actor_username) BETWEEN 1 AND 200
  )
);

CREATE UNIQUE INDEX lead_management_events_idempotency_key_uidx
  ON public.lead_management_events (idempotency_key);

CREATE INDEX lead_management_events_lead_created_at_idx
  ON public.lead_management_events (lead_id, created_at DESC);

COMMIT;
