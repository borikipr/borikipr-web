BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.translation_provider_usage_buckets) THEN
    RAISE EXCEPTION 'Rollback blocked: translation usage accounting exists.';
  END IF;
END
$$;

ALTER TABLE public.translation_jobs
  ALTER COLUMN max_attempts SET DEFAULT 5;

DROP TABLE public.translation_provider_usage_buckets;

COMMIT;
