BEGIN;

ALTER TABLE public.signature_participants
  ADD COLUMN consent_version text NULL,
  ADD COLUMN consent_text_sha256 text NULL,
  ADD COLUMN consent_source_sha256 text NULL,
  ADD COLUMN consent_locale text NULL,
  ADD CONSTRAINT signature_participants_consent_evidence_check CHECK (
    (consented_at IS NULL AND consent_version IS NULL AND consent_text_sha256 IS NULL
      AND consent_source_sha256 IS NULL AND consent_locale IS NULL)
    OR
    (consented_at IS NOT NULL
      AND char_length(consent_version) BETWEEN 1 AND 100
      AND consent_text_sha256 ~ '^[0-9a-f]{64}$'
      AND consent_source_sha256 ~ '^[0-9a-f]{64}$'
      AND consent_locale IN ('es-PR', 'en-US'))
  );

ALTER TABLE public.signature_field_values
  ADD COLUMN sanitized_value_payload jsonb NULL;

ALTER TABLE public.signature_field_values
  DROP CONSTRAINT signature_field_values_payload_check,
  ADD CONSTRAINT signature_field_values_payload_check CHECK (
    (
      capture_method = 'drawn_vector'
      AND sanitized_typed_value IS NULL
      AND private_artifact_r2_key IS NULL
      AND jsonb_typeof(sanitized_value_payload) = 'object'
      AND jsonb_typeof(sanitized_value_payload->'strokes') = 'array'
      AND char_length(sanitized_value_payload::text) <= 100000
    )
    OR (
      capture_method <> 'drawn_vector'
      AND sanitized_typed_value IS NOT NULL
      AND private_artifact_r2_key IS NULL
      AND sanitized_value_payload IS NULL
      AND char_length(sanitized_typed_value) BETWEEN 1 AND 500
      AND sanitized_typed_value !~ '[[:cntrl:]]'
    )
  );

ALTER TABLE public.signature_events
  DROP CONSTRAINT signature_events_type_check,
  ADD CONSTRAINT signature_events_type_check CHECK (
    event_type IN (
      'document_created', 'version_created', 'participant_added',
      'participant_updated', 'field_added', 'field_updated', 'field_removed',
      'send_prepared', 'document_sent', 'document_viewed',
      'document_partially_signed', 'document_completed', 'document_voided',
      'document_expired', 'participant_invited', 'participant_viewed',
      'participant_consented', 'participant_completed', 'participant_revoked',
      'participant_expired', 'participant_declined', 'field_submitted',
      'token_issued', 'token_revoked', 'token_superseded', 'session_created',
      'session_revoked', 'session_completed', 'finalization_completed',
      'delivery_recorded', 'document_downloaded', 'consent_presented',
      'consent_accepted', 'field_completed', 'signature_submitted',
      'final_pdf_generated', 'certificate_generated'
    )
  );

CREATE OR REPLACE FUNCTION public.signature_validate_event_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  prior_sequence bigint;
  prior_digest text;
  metadata_key text;
BEGIN
  FOR metadata_key IN SELECT jsonb_object_keys(NEW.controlled_metadata)
  LOOP
    IF metadata_key <> ALL (ARRAY[
      'consent_version', 'consent_text_sha256', 'locale', 'field_id',
      'field_type', 'capture_method', 'document_status', 'participant_status',
      'delivery_id', 'delivery_channel', 'reason_code', 'verification_id',
      'source_sha256', 'final_pdf_sha256', 'certificate_sha256', 'event_note_code'
    ]) THEN
      RAISE EXCEPTION 'signature event metadata key is not allowlisted';
    END IF;
  END LOOP;
  SELECT sequence_number, event_digest INTO prior_sequence, prior_digest
    FROM public.signature_events WHERE document_id = NEW.document_id
   ORDER BY sequence_number DESC LIMIT 1;
  IF prior_sequence IS NULL THEN
    IF NEW.sequence_number <> 1 OR NEW.previous_event_digest IS NOT NULL THEN
      RAISE EXCEPTION 'first signature event must start a new chain';
    END IF;
  ELSIF NEW.sequence_number <> prior_sequence + 1
     OR NEW.previous_event_digest IS DISTINCT FROM prior_digest THEN
    RAISE EXCEPTION 'signature event chain predecessor mismatch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.signature_enforce_consent_evidence_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.consented_at IS NOT NULL AND (
    NEW.consent_version IS DISTINCT FROM OLD.consent_version
    OR NEW.consent_text_sha256 IS DISTINCT FROM OLD.consent_text_sha256
    OR NEW.consent_source_sha256 IS DISTINCT FROM OLD.consent_source_sha256
    OR NEW.consent_locale IS DISTINCT FROM OLD.consent_locale
  ) THEN
    RAISE EXCEPTION 'signature consent evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER signature_participants_consent_immutable_trigger
BEFORE UPDATE ON public.signature_participants
FOR EACH ROW EXECUTE FUNCTION public.signature_enforce_consent_evidence_immutability();

COMMIT;
