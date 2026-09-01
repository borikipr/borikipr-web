BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.translation_provider_usage_buckets
     WHERE provider = 'azure-translator'
  ) THEN
    RAISE EXCEPTION '0053 rollback blocked: Azure translation usage exists.';
  END IF;
END
$$;

ALTER TABLE public.translation_provider_usage_buckets
  DROP CONSTRAINT translation_provider_usage_provider_check;

ALTER TABLE public.translation_provider_usage_buckets
  ADD CONSTRAINT translation_provider_usage_provider_check CHECK (
    provider = 'google-cloud-translation'
  );

COMMIT;
