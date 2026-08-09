BEGIN;

CREATE TABLE public.signature_document_type_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  approval_reference text NULL,
  approval_date date NULL,
  reviewed_by text NULL,
  source_reference text NULL,
  notes text NULL,
  effective_from timestamptz NULL,
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_type_approvals_document_type_check CHECK (
    document_type IN (
      'ordinary_brokerage_agreement', 'buyer_representation_agreement',
      'listing_related_agreement', 'ordinary_transaction_addendum', 'lease',
      'transaction_acknowledgment', 'ordinary_offer_or_contract', 'deed',
      'mortgage', 'power_of_attorney', 'sworn_statement', 'affidavit',
      'notarized_document', 'witnessed_document', 'property_registry_instrument',
      'foreclosure_default_acceleration_notice', 'inheritance_or_succession',
      'judicial_filing', 'externally_controlled_execution'
    )
  ),
  CONSTRAINT signature_type_approvals_status_check CHECK (
    status IN ('pending', 'approved', 'restricted', 'revoked')
  ),
  CONSTRAINT signature_type_approvals_reference_check CHECK (
    approval_reference IS NULL OR char_length(btrim(approval_reference)) BETWEEN 1 AND 200
  ),
  CONSTRAINT signature_type_approvals_reviewer_check CHECK (
    reviewed_by IS NULL OR char_length(btrim(reviewed_by)) BETWEEN 1 AND 200
  ),
  CONSTRAINT signature_type_approvals_source_check CHECK (
    source_reference IS NULL OR char_length(btrim(source_reference)) BETWEEN 1 AND 500
  ),
  CONSTRAINT signature_type_approvals_notes_check CHECK (
    notes IS NULL OR char_length(notes) <= 2000
  ),
  CONSTRAINT signature_type_approvals_approved_check CHECK (
    status <> 'approved' OR (
      approval_reference IS NOT NULL AND approval_date IS NOT NULL
      AND reviewed_by IS NOT NULL AND source_reference IS NOT NULL
      AND effective_from IS NOT NULL AND revoked_at IS NULL
    )
  ),
  CONSTRAINT signature_type_approvals_revoked_check CHECK (
    status <> 'revoked' OR revoked_at IS NOT NULL
  ),
  CONSTRAINT signature_type_approvals_time_check CHECK (
    updated_at >= created_at
    AND (effective_from IS NULL OR effective_from >= created_at)
    AND (revoked_at IS NULL OR revoked_at >= created_at)
  )
);

CREATE UNIQUE INDEX signature_type_approvals_active_approved_unique
  ON public.signature_document_type_approvals (document_type)
  WHERE status = 'approved' AND revoked_at IS NULL;
CREATE INDEX signature_type_approvals_status_idx
  ON public.signature_document_type_approvals (status, document_type, created_at DESC);

CREATE TABLE public.signature_consent_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_identifier text NOT NULL,
  locale text NOT NULL,
  consent_text text NOT NULL,
  consent_text_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  effective_from timestamptz NULL,
  approval_reference text NULL,
  created_by_admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_consent_versions_identifier_check CHECK (
    version_identifier ~ '^[a-z0-9][a-z0-9._-]{0,99}$'
  ),
  CONSTRAINT signature_consent_versions_locale_check CHECK (locale IN ('es-PR', 'en-US')),
  CONSTRAINT signature_consent_versions_text_check CHECK (
    char_length(consent_text) BETWEEN 20 AND 10000
  ),
  CONSTRAINT signature_consent_versions_hash_check CHECK (
    consent_text_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT signature_consent_versions_status_check CHECK (
    status IN ('draft', 'approved', 'retired')
  ),
  CONSTRAINT signature_consent_versions_approved_check CHECK (
    status <> 'approved' OR (effective_from IS NOT NULL AND approval_reference IS NOT NULL)
  ),
  CONSTRAINT signature_consent_versions_reference_check CHECK (
    approval_reference IS NULL OR char_length(btrim(approval_reference)) BETWEEN 1 AND 200
  ),
  CONSTRAINT signature_consent_versions_time_check CHECK (
    updated_at >= created_at AND (effective_from IS NULL OR effective_from >= created_at)
  ),
  CONSTRAINT signature_consent_versions_identity_unique UNIQUE (version_identifier, locale)
);

CREATE UNIQUE INDEX signature_consent_versions_active_locale_unique
  ON public.signature_consent_versions (locale)
  WHERE status = 'approved';
CREATE INDEX signature_consent_versions_status_idx
  ON public.signature_consent_versions (status, locale, effective_from DESC);

ALTER TABLE public.signature_documents
  ADD COLUMN document_type_approval_id uuid NULL
    REFERENCES public.signature_document_type_approvals(id) ON DELETE RESTRICT,
  ADD COLUMN consent_version_id uuid NULL
    REFERENCES public.signature_consent_versions(id) ON DELETE RESTRICT,
  ADD CONSTRAINT signature_documents_send_governance_check CHECK (
    status='draft' OR (document_type_approval_id IS NOT NULL AND consent_version_id IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.signature_enforce_send_governance_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'draft' AND (
    NEW.document_type_approval_id IS DISTINCT FROM OLD.document_type_approval_id
    OR NEW.consent_version_id IS DISTINCT FROM OLD.consent_version_id
  ) THEN RAISE EXCEPTION 'signature send governance evidence is immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER signature_documents_send_governance_immutable_trigger
BEFORE UPDATE ON public.signature_documents
FOR EACH ROW EXECUTE FUNCTION public.signature_enforce_send_governance_immutability();

ALTER TABLE public.signature_signing_tokens
  DROP CONSTRAINT signature_signing_tokens_purpose_check,
  ADD CONSTRAINT signature_signing_tokens_purpose_check CHECK (
    purpose IN ('sign_document', 'completed_document_access')
  );

ALTER TABLE public.signature_sessions
  ADD COLUMN purpose text NOT NULL DEFAULT 'sign_document',
  ADD CONSTRAINT signature_sessions_purpose_check CHECK (
    purpose IN ('sign_document', 'completed_document_access')
  );

CREATE TABLE public.signature_delivery_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL,
  document_version_id uuid NOT NULL,
  token_id uuid NULL,
  delivery_kind text NOT NULL DEFAULT 'invitation',
  locale text NOT NULL,
  recipient_email_snapshot text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  idempotency_key uuid NOT NULL,
  last_error_code text NULL,
  provider_message_reference text NULL,
  created_by_admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  locked_at timestamptz NULL,
  locked_by uuid NULL,
  attempted_at timestamptz NULL,
  delivered_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_delivery_intents_participant_fk
    FOREIGN KEY (document_version_id, participant_id)
    REFERENCES public.signature_participants (document_version_id, id) ON DELETE RESTRICT,
  CONSTRAINT signature_delivery_intents_token_fk
    FOREIGN KEY (token_id, document_version_id, participant_id)
    REFERENCES public.signature_signing_tokens (id, document_version_id, participant_id)
    ON DELETE RESTRICT,
  CONSTRAINT signature_delivery_intents_kind_check CHECK (
    delivery_kind IN ('invitation', 'completed_document')
  ),
  CONSTRAINT signature_delivery_intents_locale_check CHECK (locale IN ('es-PR', 'en-US')),
  CONSTRAINT signature_delivery_intents_email_check CHECK (
    recipient_email_snapshot = lower(btrim(recipient_email_snapshot))
    AND char_length(recipient_email_snapshot) BETWEEN 3 AND 320
    AND position('@' IN recipient_email_snapshot) > 1
  ),
  CONSTRAINT signature_delivery_intents_status_check CHECK (
    status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')
  ),
  CONSTRAINT signature_delivery_intents_attempts_check CHECK (attempts BETWEEN 0 AND 5),
  CONSTRAINT signature_delivery_intents_error_check CHECK (
    last_error_code IS NULL OR last_error_code ~ '^[a-z0-9_]{1,100}$'
  ),
  CONSTRAINT signature_delivery_intents_provider_reference_check CHECK (
    provider_message_reference IS NULL OR char_length(provider_message_reference) BETWEEN 1 AND 200
  ),
  CONSTRAINT signature_delivery_intents_state_check CHECK (
    (status <> 'processing' OR (locked_at IS NOT NULL AND locked_by IS NOT NULL))
    AND (status <> 'sent' OR (token_id IS NOT NULL AND delivered_at IS NOT NULL))
    AND (status <> 'cancelled' OR cancelled_at IS NOT NULL)
  ),
  CONSTRAINT signature_delivery_intents_time_check CHECK (
    updated_at >= created_at
    AND (locked_at IS NULL OR locked_at >= created_at)
    AND (attempted_at IS NULL OR attempted_at >= created_at)
    AND (delivered_at IS NULL OR delivered_at >= created_at)
    AND (cancelled_at IS NULL OR cancelled_at >= created_at)
  ),
  CONSTRAINT signature_delivery_intents_idempotency_unique UNIQUE (idempotency_key)
);

CREATE INDEX signature_delivery_intents_pending_idx
  ON public.signature_delivery_intents (created_at)
  WHERE status = 'pending';
CREATE INDEX signature_delivery_intents_participant_idx
  ON public.signature_delivery_intents (participant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.signature_enforce_approval_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('approved', 'restricted', 'revoked') AND (
    NEW.document_type IS DISTINCT FROM OLD.document_type
    OR NEW.approval_reference IS DISTINCT FROM OLD.approval_reference
    OR NEW.approval_date IS DISTINCT FROM OLD.approval_date
    OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
    OR NEW.source_reference IS DISTINCT FROM OLD.source_reference
    OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
    OR NEW.notes IS DISTINCT FROM OLD.notes
  ) THEN RAISE EXCEPTION 'signature counsel approval evidence is immutable'; END IF;
  IF OLD.status = 'revoked' OR (OLD.status = 'approved' AND NEW.status NOT IN ('approved','revoked')) THEN
    RAISE EXCEPTION 'signature counsel approval transition rejected';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER signature_type_approvals_immutable_trigger
BEFORE UPDATE ON public.signature_document_type_approvals
FOR EACH ROW EXECUTE FUNCTION public.signature_enforce_approval_immutability();

CREATE OR REPLACE FUNCTION public.signature_enforce_consent_version_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('approved','retired') AND (
    NEW.version_identifier IS DISTINCT FROM OLD.version_identifier
    OR NEW.locale IS DISTINCT FROM OLD.locale
    OR NEW.consent_text IS DISTINCT FROM OLD.consent_text
    OR NEW.consent_text_sha256 IS DISTINCT FROM OLD.consent_text_sha256
    OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
    OR NEW.approval_reference IS DISTINCT FROM OLD.approval_reference
  ) THEN RAISE EXCEPTION 'approved signature consent is immutable'; END IF;
  IF OLD.status = 'retired' OR (OLD.status = 'approved' AND NEW.status NOT IN ('approved','retired')) THEN
    RAISE EXCEPTION 'signature consent transition rejected';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER signature_consent_versions_immutable_trigger
BEFORE UPDATE ON public.signature_consent_versions
FOR EACH ROW EXECUTE FUNCTION public.signature_enforce_consent_version_immutability();

ALTER TABLE public.signature_events DROP CONSTRAINT signature_events_type_check;
ALTER TABLE public.signature_events ADD CONSTRAINT signature_events_type_check CHECK (
  event_type IN (
    'document_created', 'version_created', 'participant_added', 'participant_updated',
    'field_added', 'field_updated', 'field_removed', 'send_prepared', 'document_sent',
    'document_viewed', 'document_partially_signed', 'document_completed', 'document_voided',
    'document_expired', 'participant_invited', 'participant_viewed', 'participant_consented',
    'participant_completed', 'participant_revoked', 'participant_expired', 'participant_declined',
    'field_submitted', 'token_issued', 'token_revoked', 'token_superseded', 'session_created',
    'session_revoked', 'session_completed', 'finalization_completed', 'delivery_recorded',
    'document_downloaded', 'consent_presented', 'consent_accepted', 'field_completed',
    'signature_submitted', 'final_pdf_generated', 'certificate_generated',
    'invitation_created', 'invitation_delivery_attempted', 'invitation_delivery_succeeded',
    'invitation_delivery_failed', 'invitation_reissued', 'invitation_revoked',
    'completed_document_accessed', 'certificate_accessed'
  )
);

CREATE OR REPLACE FUNCTION public.signature_validate_event_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior_sequence bigint; prior_digest text; metadata_key text;
BEGIN
  FOR metadata_key IN SELECT jsonb_object_keys(NEW.controlled_metadata) LOOP
    IF metadata_key <> ALL (ARRAY[
      'consent_version', 'consent_text_sha256', 'locale', 'field_id', 'field_type',
      'capture_method', 'document_status', 'participant_status', 'delivery_id',
      'delivery_channel', 'delivery_status', 'reason_code', 'verification_id',
      'source_sha256', 'final_pdf_sha256', 'certificate_sha256', 'event_note_code',
      'access_type', 'approval_status'
    ]) THEN RAISE EXCEPTION 'signature event metadata key is not allowlisted'; END IF;
  END LOOP;
  SELECT sequence_number, event_digest INTO prior_sequence, prior_digest
    FROM public.signature_events WHERE document_id=NEW.document_id
    ORDER BY sequence_number DESC LIMIT 1;
  IF prior_sequence IS NULL THEN
    IF NEW.sequence_number<>1 OR NEW.previous_event_digest IS NOT NULL THEN
      RAISE EXCEPTION 'first signature event must start a new chain'; END IF;
  ELSIF NEW.sequence_number<>prior_sequence+1 OR NEW.previous_event_digest IS DISTINCT FROM prior_digest THEN
    RAISE EXCEPTION 'signature event chain predecessor mismatch';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
