BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.public_rate_limit_buckets LIMIT 1) THEN
    RAISE EXCEPTION
      'Refusing to drop public_rate_limit_buckets while rate-limit state exists.';
  END IF;
END
$$;

DROP TABLE public.public_rate_limit_buckets;

COMMIT;
