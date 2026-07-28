BEGIN;

CREATE TABLE public.operational_cron_heartbeats (
  job_name text PRIMARY KEY,
  last_started_at timestamptz NULL,
  last_succeeded_at timestamptz NULL,
  last_failed_at timestamptz NULL,
  last_error_class text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operational_cron_heartbeats_job_check CHECK (
    job_name IN ('email_queue', 'admin_auth_cleanup', 'operational_health')
  ),
  CONSTRAINT operational_cron_heartbeats_error_check CHECK (
    last_error_class IS NULL
    OR last_error_class ~ '^[A-Za-z][A-Za-z0-9_.:-]{0,119}$'
  )
);

CREATE TABLE public.operational_alert_state (
  condition_key text PRIMARY KEY,
  fingerprint text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_detected_at timestamptz NOT NULL DEFAULT now(),
  last_alerted_at timestamptz NULL,
  resolved_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operational_alert_state_key_check CHECK (
    condition_key ~ '^[a-z][a-z0-9:_-]{0,79}$'
  ),
  CONSTRAINT operational_alert_state_fingerprint_check CHECK (
    fingerprint ~ '^[0-9a-f]{64}$'
  )
);

CREATE INDEX operational_cron_heartbeats_success_idx
  ON public.operational_cron_heartbeats (last_succeeded_at);

CREATE INDEX operational_alert_state_active_idx
  ON public.operational_alert_state (last_detected_at DESC)
  WHERE active = true;

COMMIT;

