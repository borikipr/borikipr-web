BEGIN;

ALTER TABLE public.email_queue
  ADD COLUMN canonical_lead_id uuid NULL
    REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN related_submission_type text NULL,
  ADD COLUMN related_submission_id uuid NULL,
  ADD COLUMN dedupe_key text NULL;

CREATE UNIQUE INDEX email_queue_dedupe_key_uidx
  ON public.email_queue (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX email_queue_canonical_lead_id_idx
  ON public.email_queue (canonical_lead_id)
  WHERE canonical_lead_id IS NOT NULL;

CREATE INDEX email_queue_related_submission_idx
  ON public.email_queue (related_submission_type, related_submission_id)
  WHERE related_submission_type IS NOT NULL
    AND related_submission_id IS NOT NULL;

COMMIT;
