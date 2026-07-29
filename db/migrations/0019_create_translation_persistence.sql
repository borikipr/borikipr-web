BEGIN;

CREATE TABLE public.content_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NULL
    REFERENCES public.propiedades(id) ON DELETE CASCADE,
  testimonial_id uuid NULL
    REFERENCES public.testimonios(id) ON DELETE CASCADE,
  target_locale text NOT NULL,
  field_key text NOT NULL,
  translated_value text NULL,
  source_hash text NOT NULL,
  translated_source_hash text NULL,
  hash_version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  origin text NOT NULL DEFAULT 'machine',
  review_status text NOT NULL DEFAULT 'unreviewed',
  protected_from_automation boolean NOT NULL DEFAULT false,
  provider text NULL,
  provider_model text NULL,
  provider_version text NULL,
  lock_version integer NOT NULL DEFAULT 0,
  generated_at timestamptz NULL,
  manually_edited_at timestamptz NULL,
  reviewed_at timestamptz NULL,
  reviewed_by uuid NULL
    REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_translations_exactly_one_owner_check CHECK (
    (property_id IS NOT NULL AND testimonial_id IS NULL)
    OR (property_id IS NULL AND testimonial_id IS NOT NULL)
  ),
  CONSTRAINT content_translations_field_key_check CHECK (
    (
      property_id IS NOT NULL
      AND field_key IN ('title', 'description')
    )
    OR (
      testimonial_id IS NOT NULL
      AND field_key = 'body'
    )
  ),
  CONSTRAINT content_translations_target_locale_check CHECK (
    target_locale = 'en-US'
  ),
  CONSTRAINT content_translations_source_hash_check CHECK (
    source_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT content_translations_translated_source_hash_check CHECK (
    translated_source_hash IS NULL
    OR translated_source_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT content_translations_hash_version_check CHECK (
    hash_version > 0
  ),
  CONSTRAINT content_translations_status_check CHECK (
    status IN ('pending', 'processing', 'ready', 'stale', 'failed')
  ),
  CONSTRAINT content_translations_origin_check CHECK (
    origin IN ('machine', 'manual')
  ),
  CONSTRAINT content_translations_review_status_check CHECK (
    review_status IN ('unreviewed', 'reviewed')
  ),
  CONSTRAINT content_translations_lock_version_check CHECK (
    lock_version >= 0
  ),
  CONSTRAINT content_translations_ready_value_check CHECK (
    status <> 'ready'
    OR (
      translated_value IS NOT NULL
      AND btrim(translated_value) <> ''
      AND translated_source_hash IS NOT NULL
    )
  ),
  CONSTRAINT content_translations_manual_protection_check CHECK (
    origin <> 'manual' OR protected_from_automation = true
  ),
  CONSTRAINT content_translations_review_protection_check CHECK (
    review_status <> 'reviewed' OR protected_from_automation = true
  ),
  CONSTRAINT content_translations_provider_check CHECK (
    provider IS NULL OR btrim(provider) <> ''
  ),
  CONSTRAINT content_translations_provider_model_check CHECK (
    provider_model IS NULL OR btrim(provider_model) <> ''
  ),
  CONSTRAINT content_translations_provider_version_check CHECK (
    provider_version IS NULL OR btrim(provider_version) <> ''
  )
);

CREATE UNIQUE INDEX content_translations_property_locale_field_uidx
  ON public.content_translations (property_id, target_locale, field_key)
  WHERE property_id IS NOT NULL;

CREATE UNIQUE INDEX content_translations_testimonial_locale_field_uidx
  ON public.content_translations (testimonial_id, target_locale, field_key)
  WHERE testimonial_id IS NOT NULL;

CREATE INDEX content_translations_property_id_idx
  ON public.content_translations (property_id)
  WHERE property_id IS NOT NULL;

CREATE INDEX content_translations_testimonial_id_idx
  ON public.content_translations (testimonial_id)
  WHERE testimonial_id IS NOT NULL;

CREATE INDEX content_translations_status_updated_at_idx
  ON public.content_translations (status, updated_at);

CREATE TABLE public.translation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_id uuid NOT NULL
    REFERENCES public.content_translations(id) ON DELETE CASCADE,
  source_hash text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  priority integer NOT NULL DEFAULT 100,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  provider text NULL,
  provider_model text NULL,
  provider_version text NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz NULL,
  locked_by text NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  last_error_code text NULL,
  last_error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT translation_jobs_source_hash_check CHECK (
    source_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT translation_jobs_status_check CHECK (
    status IN ('queued', 'processing', 'succeeded', 'failed', 'cancelled')
  ),
  CONSTRAINT translation_jobs_priority_check CHECK (
    priority >= 0
  ),
  CONSTRAINT translation_jobs_attempts_check CHECK (
    attempts >= 0 AND attempts <= max_attempts
  ),
  CONSTRAINT translation_jobs_max_attempts_check CHECK (
    max_attempts > 0
  ),
  CONSTRAINT translation_jobs_processing_lock_check CHECK (
    status <> 'processing'
    OR (
      locked_at IS NOT NULL
      AND locked_by IS NOT NULL
      AND btrim(locked_by) <> ''
      AND started_at IS NOT NULL
    )
  ),
  CONSTRAINT translation_jobs_completed_at_check CHECK (
    status NOT IN ('succeeded', 'failed', 'cancelled')
    OR completed_at IS NOT NULL
  ),
  CONSTRAINT translation_jobs_provider_check CHECK (
    provider IS NULL OR btrim(provider) <> ''
  ),
  CONSTRAINT translation_jobs_provider_model_check CHECK (
    provider_model IS NULL OR btrim(provider_model) <> ''
  ),
  CONSTRAINT translation_jobs_provider_version_check CHECK (
    provider_version IS NULL OR btrim(provider_version) <> ''
  ),
  CONSTRAINT translation_jobs_locked_by_check CHECK (
    locked_by IS NULL OR btrim(locked_by) <> ''
  ),
  CONSTRAINT translation_jobs_error_code_check CHECK (
    last_error_code IS NULL
    OR last_error_code ~ '^[A-Za-z][A-Za-z0-9_.:-]{0,119}$'
  )
);

CREATE UNIQUE INDEX translation_jobs_active_source_uidx
  ON public.translation_jobs (translation_id, source_hash)
  WHERE status IN ('queued', 'processing');

CREATE INDEX translation_jobs_claim_idx
  ON public.translation_jobs (status, available_at, priority, created_at);

CREATE INDEX translation_jobs_processing_locked_at_idx
  ON public.translation_jobs (locked_at)
  WHERE status = 'processing';

CREATE INDEX translation_jobs_status_updated_at_idx
  ON public.translation_jobs (status, updated_at);

CREATE TABLE public.translation_revision_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_id uuid NOT NULL
    REFERENCES public.content_translations(id) ON DELETE CASCADE,
  job_id uuid NULL
    REFERENCES public.translation_jobs(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  previous_source_hash text NULL,
  new_source_hash text NULL,
  previous_translated_source_hash text NULL,
  new_translated_source_hash text NULL,
  previous_status text NULL,
  new_status text NULL,
  previous_value text NULL,
  new_value text NULL,
  actor_admin_id uuid NULL
    REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT translation_revision_events_type_check CHECK (
    event_type IN (
      'created',
      'source_changed',
      'job_queued',
      'generation_succeeded',
      'generation_failed',
      'manually_edited',
      'reviewed',
      'automation_unprotected',
      'regeneration_authorized'
    )
  ),
  CONSTRAINT translation_revision_events_previous_source_hash_check CHECK (
    previous_source_hash IS NULL
    OR previous_source_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT translation_revision_events_new_source_hash_check CHECK (
    new_source_hash IS NULL
    OR new_source_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT translation_revision_events_previous_translated_hash_check CHECK (
    previous_translated_source_hash IS NULL
    OR previous_translated_source_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT translation_revision_events_new_translated_hash_check CHECK (
    new_translated_source_hash IS NULL
    OR new_translated_source_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT translation_revision_events_previous_status_check CHECK (
    previous_status IS NULL
    OR previous_status IN ('pending', 'processing', 'ready', 'stale', 'failed')
  ),
  CONSTRAINT translation_revision_events_new_status_check CHECK (
    new_status IS NULL
    OR new_status IN ('pending', 'processing', 'ready', 'stale', 'failed')
  )
);

CREATE INDEX translation_revision_events_translation_created_at_idx
  ON public.translation_revision_events (translation_id, created_at DESC);

CREATE INDEX translation_revision_events_actor_created_at_idx
  ON public.translation_revision_events (actor_admin_id, created_at DESC)
  WHERE actor_admin_id IS NOT NULL;

COMMIT;
