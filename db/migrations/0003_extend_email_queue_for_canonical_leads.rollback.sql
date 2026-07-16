BEGIN;

DROP INDEX IF EXISTS public.email_queue_related_submission_idx;
DROP INDEX IF EXISTS public.email_queue_canonical_lead_id_idx;
DROP INDEX IF EXISTS public.email_queue_dedupe_key_uidx;

ALTER TABLE public.email_queue
  DROP COLUMN IF EXISTS dedupe_key,
  DROP COLUMN IF EXISTS related_submission_id,
  DROP COLUMN IF EXISTS related_submission_type,
  DROP COLUMN IF EXISTS canonical_lead_id;

COMMIT;
