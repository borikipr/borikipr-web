BEGIN;

CREATE TABLE public.translation_provider_usage_buckets (
  provider text NOT NULL,
  period_kind text NOT NULL,
  period_start date NOT NULL,
  attempted_characters bigint NOT NULL DEFAULT 0,
  provider_attempts integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, period_kind, period_start),
  CONSTRAINT translation_provider_usage_provider_check CHECK (
    provider = 'google-cloud-translation'
  ),
  CONSTRAINT translation_provider_usage_period_kind_check CHECK (
    period_kind IN ('day', 'month')
  ),
  CONSTRAINT translation_provider_usage_characters_check CHECK (
    attempted_characters >= 0
  ),
  CONSTRAINT translation_provider_usage_attempts_check CHECK (
    provider_attempts >= 0
  ),
  CONSTRAINT translation_provider_usage_period_start_check CHECK (
    (period_kind = 'day')
    OR (period_kind = 'month' AND period_start = date_trunc('month', period_start)::date)
  )
);

CREATE INDEX translation_provider_usage_period_idx
  ON public.translation_provider_usage_buckets (period_start DESC, period_kind);

ALTER TABLE public.translation_jobs
  ALTER COLUMN max_attempts SET DEFAULT 2;

COMMIT;
