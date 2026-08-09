BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.signature_events)
     OR EXISTS (SELECT 1 FROM public.signature_field_values)
     OR EXISTS (SELECT 1 FROM public.signature_sessions)
     OR EXISTS (SELECT 1 FROM public.signature_signing_tokens)
     OR EXISTS (SELECT 1 FROM public.signature_fields)
     OR EXISTS (SELECT 1 FROM public.signature_participants)
     OR EXISTS (SELECT 1 FROM public.signature_document_versions)
     OR EXISTS (SELECT 1 FROM public.signature_documents) THEN
    RAISE EXCEPTION 'Cannot roll back 0022 while signature foundation data exists';
  END IF;
END $$;

DROP TABLE public.signature_events;
DROP TABLE public.signature_field_values;
DROP TABLE public.signature_sessions;
DROP TABLE public.signature_signing_tokens;
DROP TABLE public.signature_fields;
DROP TABLE public.signature_participants;
ALTER TABLE public.signature_documents
  DROP CONSTRAINT signature_documents_active_version_fk;
DROP TABLE public.signature_document_versions;
DROP TABLE public.signature_documents;

DROP FUNCTION public.signature_reject_event_mutation();
DROP FUNCTION public.signature_validate_event_insert();
DROP FUNCTION public.signature_enforce_session_immutability();
DROP FUNCTION public.signature_enforce_token_immutability();
DROP FUNCTION public.signature_reject_field_value_mutation();
DROP FUNCTION public.signature_validate_field_value();
DROP FUNCTION public.signature_enforce_field_immutability();
DROP FUNCTION public.signature_enforce_version_immutability();
DROP FUNCTION public.signature_enforce_participant_transition();
DROP FUNCTION public.signature_enforce_document_transition();
DROP FUNCTION public.signature_enforce_field_limits();
DROP FUNCTION public.signature_enforce_participant_limit();

COMMIT;
