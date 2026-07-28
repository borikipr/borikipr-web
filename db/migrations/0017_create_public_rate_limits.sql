BEGIN;

CREATE TABLE public.public_rate_limit_buckets (
  action_type text NOT NULL,
  identifier_hash text NOT NULL,
  bucket_start timestamptz NOT NULL,
  window_seconds integer NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (action_type, identifier_hash, bucket_start, window_seconds),
  CONSTRAINT public_rate_limit_action_check CHECK (
    action_type ~ '^[a-z0-9][a-z0-9:_-]{0,79}$'
  ),
  CONSTRAINT public_rate_limit_identifier_check CHECK (
    identifier_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT public_rate_limit_window_check CHECK (
    window_seconds BETWEEN 1 AND 86400
  ),
  CONSTRAINT public_rate_limit_count_check CHECK (
    request_count BETWEEN 1 AND 100000
  ),
  CONSTRAINT public_rate_limit_expiry_check CHECK (
    expires_at > bucket_start
  )
);

CREATE INDEX public_rate_limit_buckets_expires_at_idx
  ON public.public_rate_limit_buckets (expires_at);

COMMIT;
