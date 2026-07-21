BEGIN;

CREATE TABLE public.lead_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  primary_property_id uuid NULL REFERENCES public.propiedades(id) ON DELETE RESTRICT,
  next_follow_up_at timestamptz NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz NULL,
  CONSTRAINT lead_groups_title_check CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT lead_groups_status_check CHECK (
    status IN ('new', 'active', 'on_hold', 'closed', 'archived')
  ),
  CONSTRAINT lead_groups_created_by_check CHECK (
    char_length(created_by) BETWEEN 1 AND 200
  ),
  CONSTRAINT lead_groups_archived_state_check CHECK (
    (status = 'archived' AND archived_at IS NOT NULL)
    OR (status <> 'archived' AND archived_at IS NULL)
  )
);

CREATE INDEX lead_groups_status_updated_at_idx
  ON public.lead_groups (status, updated_at DESC);

CREATE INDEX lead_groups_primary_property_id_idx
  ON public.lead_groups (primary_property_id)
  WHERE primary_property_id IS NOT NULL;

CREATE INDEX lead_groups_next_follow_up_at_idx
  ON public.lead_groups (next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL
    AND status NOT IN ('closed', 'archived');

CREATE TABLE public.lead_group_members (
  group_id uuid NOT NULL REFERENCES public.lead_groups(id) ON DELETE RESTRICT,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  role text NOT NULL,
  is_primary_contact boolean NOT NULL DEFAULT false,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_by text NULL,
  removed_at timestamptz NULL,
  PRIMARY KEY (group_id, lead_id),
  CONSTRAINT lead_group_members_role_check CHECK (
    role IN (
      'family_contact',
      'buyer',
      'prequalified_buyer',
      'co_buyer',
      'tenant',
      'seller',
      'landlord',
      'representative_contact',
      'other'
    )
  ),
  CONSTRAINT lead_group_members_created_by_check CHECK (
    char_length(created_by) BETWEEN 1 AND 200
  ),
  CONSTRAINT lead_group_members_removed_state_check CHECK (
    (removed_at IS NULL AND removed_by IS NULL)
    OR (
      removed_at IS NOT NULL
      AND removed_by IS NOT NULL
      AND char_length(removed_by) BETWEEN 1 AND 200
      AND is_primary_contact = false
    )
  )
);

CREATE UNIQUE INDEX lead_group_members_one_primary_uidx
  ON public.lead_group_members (group_id)
  WHERE is_primary_contact = true AND removed_at IS NULL;

CREATE INDEX lead_group_members_lead_id_idx
  ON public.lead_group_members (lead_id, group_id)
  WHERE removed_at IS NULL;

CREATE TABLE public.lead_group_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.lead_groups(id) ON DELETE RESTRICT,
  body text NOT NULL,
  author_username text NOT NULL,
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_group_notes_body_check CHECK (char_length(body) BETWEEN 1 AND 5000),
  CONSTRAINT lead_group_notes_author_check CHECK (
    char_length(author_username) BETWEEN 1 AND 200
  )
);

CREATE UNIQUE INDEX lead_group_notes_idempotency_key_uidx
  ON public.lead_group_notes (idempotency_key);

CREATE INDEX lead_group_notes_group_created_at_idx
  ON public.lead_group_notes (group_id, created_at DESC);

CREATE TABLE public.lead_group_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.lead_groups(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_username text NOT NULL,
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_group_events_type_check CHECK (
    event_type IN (
      'group_created',
      'member_added',
      'member_removed',
      'status_changed',
      'follow_up_changed',
      'note_added',
      'contacted'
    )
  ),
  CONSTRAINT lead_group_events_data_object_check CHECK (
    jsonb_typeof(event_data) = 'object'
  ),
  CONSTRAINT lead_group_events_actor_check CHECK (
    char_length(actor_username) BETWEEN 1 AND 200
  )
);

CREATE UNIQUE INDEX lead_group_events_idempotency_key_uidx
  ON public.lead_group_events (idempotency_key);

CREATE INDEX lead_group_events_group_created_at_idx
  ON public.lead_group_events (group_id, created_at DESC);

COMMIT;
