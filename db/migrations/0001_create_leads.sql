BEGIN;

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email_original text NULL,
  email_normalized text NULL,
  phone_original text NULL,
  phone_normalized text NULL,
  status text NOT NULL DEFAULT 'new',
  identity_status text NOT NULL DEFAULT 'provisional',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  merged_into_lead_id uuid NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  CONSTRAINT leads_contact_identity_check CHECK (
    email_normalized IS NOT NULL OR phone_normalized IS NOT NULL
  ),
  CONSTRAINT leads_status_check CHECK (
    status IN ('new', 'active', 'do_not_contact', 'archived', 'merged')
  ),
  CONSTRAINT leads_identity_status_check CHECK (
    identity_status IN ('provisional', 'matched', 'conflict', 'reviewed')
  ),
  CONSTRAINT leads_not_self_merged_check CHECK (
    merged_into_lead_id IS NULL OR merged_into_lead_id <> id
  ),
  CONSTRAINT leads_merged_target_status_check CHECK (
    merged_into_lead_id IS NULL OR status = 'merged'
  )
);

CREATE INDEX leads_email_normalized_idx
  ON public.leads (email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE INDEX leads_phone_normalized_idx
  ON public.leads (phone_normalized)
  WHERE phone_normalized IS NOT NULL;

CREATE INDEX leads_last_activity_at_idx
  ON public.leads (last_activity_at DESC);

CREATE INDEX leads_merged_into_lead_id_idx
  ON public.leads (merged_into_lead_id)
  WHERE merged_into_lead_id IS NOT NULL;

COMMIT;
