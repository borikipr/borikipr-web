BEGIN;

ALTER TABLE public.translation_provider_usage_buckets
  DROP CONSTRAINT translation_provider_usage_provider_check;

ALTER TABLE public.translation_provider_usage_buckets
  ADD CONSTRAINT translation_provider_usage_provider_check CHECK (
    provider IN ('google-cloud-translation', 'azure-translator')
  );

COMMIT;
