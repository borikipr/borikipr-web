BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.signature_field_values
    WHERE capture_method = 'typed' AND sanitized_value_payload IS NOT NULL
  ) THEN
    RAISE EXCEPTION '0037 rollback blocked: typed signature-style evidence already exists';
  END IF;
END $$;

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
      'delivery_id', 'delivery_channel', 'delivery_status', 'reason_code', 'verification_id',
      'source_sha256', 'final_pdf_sha256', 'certificate_sha256', 'event_note_code',
      'access_type', 'approval_status', 'time_zone'
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

COMMIT;
