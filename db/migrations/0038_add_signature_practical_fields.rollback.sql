BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.signature_fields WHERE field_type IN ('checkbox','radio','dropdown','number','email','phone','signer_name'))
     OR EXISTS (SELECT 1 FROM public.signature_field_values WHERE capture_method='system_identity') THEN
    RAISE EXCEPTION '0038 rollback blocked: practical field evidence already exists';
  END IF;
END $$;

ALTER TABLE public.signature_fields DROP CONSTRAINT signature_fields_type_check;
ALTER TABLE public.signature_fields ADD CONSTRAINT signature_fields_type_check CHECK (field_type IN ('signature','initials','date','date_signed','text'));
ALTER TABLE public.signature_field_values DROP CONSTRAINT signature_field_values_capture_method_check;
ALTER TABLE public.signature_field_values ADD CONSTRAINT signature_field_values_capture_method_check CHECK (capture_method IN ('drawn_vector','typed','system_date','text_entry'));
ALTER TABLE public.signature_field_values DROP CONSTRAINT signature_field_values_payload_check;
ALTER TABLE public.signature_field_values ADD CONSTRAINT signature_field_values_payload_check CHECK (
  (capture_method='drawn_vector' AND sanitized_typed_value IS NULL AND private_artifact_r2_key IS NULL AND jsonb_typeof(sanitized_value_payload)='object' AND jsonb_typeof(sanitized_value_payload->'strokes')='array' AND char_length(sanitized_value_payload::text)<=100000)
  OR (capture_method='typed' AND sanitized_typed_value IS NOT NULL AND private_artifact_r2_key IS NULL AND char_length(sanitized_typed_value) BETWEEN 1 AND 500 AND sanitized_typed_value !~ '[[:cntrl:]]' AND (sanitized_value_payload IS NULL OR (jsonb_typeof(sanitized_value_payload)='object' AND sanitized_value_payload-'styleId'='{}'::jsonb AND sanitized_value_payload->>'styleId' IN ('great-vibes','allura','alex-brush','parisienne','sacramento'))))
  OR (capture_method IN ('system_date','text_entry') AND sanitized_typed_value IS NOT NULL AND private_artifact_r2_key IS NULL AND sanitized_value_payload IS NULL AND char_length(sanitized_typed_value) BETWEEN 1 AND 500 AND sanitized_typed_value !~ '[[:cntrl:]]')
);

CREATE OR REPLACE FUNCTION public.signature_validate_field_value()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_type text;
BEGIN
  SELECT field_type INTO expected_type FROM public.signature_fields
   WHERE id=NEW.signature_field_id AND participant_id=NEW.participant_id;
  IF expected_type IS NULL THEN RAISE EXCEPTION 'signature field value binding is invalid'; END IF;
  IF expected_type='signature' AND NEW.capture_method NOT IN ('drawn_vector','typed') THEN RAISE EXCEPTION 'signature capture method is invalid';
  ELSIF expected_type='initials' AND NEW.capture_method NOT IN ('drawn_vector','typed') THEN RAISE EXCEPTION 'initials capture method is invalid';
  ELSIF expected_type='date' AND NEW.capture_method<>'text_entry' THEN RAISE EXCEPTION 'manual date capture method is invalid';
  ELSIF expected_type='date_signed' AND NEW.capture_method<>'system_date' THEN RAISE EXCEPTION 'date signed capture method is invalid';
  ELSIF expected_type='text' AND NEW.capture_method<>'text_entry' THEN RAISE EXCEPTION 'text capture method is invalid'; END IF;
  IF NEW.capture_method='typed' AND expected_type='signature' AND char_length(NEW.sanitized_typed_value)>120 THEN RAISE EXCEPTION 'typed signature exceeds its limit'; END IF;
  IF NEW.capture_method='typed' AND expected_type='initials' AND char_length(NEW.sanitized_typed_value)>8 THEN RAISE EXCEPTION 'typed initials exceeds its limit'; END IF;
  IF expected_type IN ('date','date_signed') AND NEW.sanitized_typed_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'signature date must use ISO format'; END IF;
  RETURN NEW;
END;
$$;

COMMIT;
