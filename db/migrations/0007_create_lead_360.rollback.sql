BEGIN;

DO $rollback_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.lead_notes LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.lead_relationships LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.lead_duplicate_reviews LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.lead_management_events LIMIT 1)
    OR EXISTS (
      SELECT 1 FROM public.leads WHERE next_follow_up_at IS NOT NULL LIMIT 1
    ) THEN
    RAISE EXCEPTION
      '0007_create_lead_360 rollback requires all Lead 360 data to be empty';
  END IF;
END
$rollback_guard$;

DROP TABLE public.lead_management_events;
DROP TABLE public.lead_duplicate_reviews;
DROP TABLE public.lead_relationships;
DROP TABLE public.lead_notes;

DROP INDEX public.leads_next_follow_up_at_idx;

ALTER TABLE public.leads
  DROP COLUMN next_follow_up_at;

COMMIT;
