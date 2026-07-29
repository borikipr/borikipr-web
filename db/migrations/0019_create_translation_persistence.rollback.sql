BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.translation_revision_events)
     OR EXISTS (SELECT 1 FROM public.translation_jobs)
     OR EXISTS (SELECT 1 FROM public.content_translations) THEN
    RAISE EXCEPTION 'Cannot roll back 0019 while translation persistence data exists';
  END IF;
END $$;

DROP TABLE public.translation_revision_events;
DROP TABLE public.translation_jobs;
DROP TABLE public.content_translations;

COMMIT;
