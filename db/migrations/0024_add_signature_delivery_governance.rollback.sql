BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.signature_document_type_approvals)
    OR EXISTS (SELECT 1 FROM public.signature_consent_versions)
    OR EXISTS (SELECT 1 FROM public.signature_delivery_intents)
    OR EXISTS (SELECT 1 FROM public.signature_signing_tokens WHERE purpose='completed_document_access')
  THEN RAISE EXCEPTION 'Cannot roll back 0024 after signature governance or delivery data exists'; END IF;
END;
$$;

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
    'signature_submitted', 'final_pdf_generated', 'certificate_generated'
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
      'delivery_channel', 'reason_code', 'verification_id', 'source_sha256',
      'final_pdf_sha256', 'certificate_sha256', 'event_note_code'
    ]) THEN RAISE EXCEPTION 'signature event metadata key is not allowlisted'; END IF;
  END LOOP;
  SELECT sequence_number, event_digest INTO prior_sequence, prior_digest
    FROM public.signature_events WHERE document_id=NEW.document_id
    ORDER BY sequence_number DESC LIMIT 1;
  IF prior_sequence IS NULL THEN
    IF NEW.sequence_number<>1 OR NEW.previous_event_digest IS NOT NULL THEN
      RAISE EXCEPTION 'first signature event must start a new chain'; END IF;
  ELSIF NEW.sequence_number<>prior_sequence+1 OR NEW.previous_event_digest IS DISTINCT FROM prior_digest THEN
    RAISE EXCEPTION 'signature event chain predecessor mismatch'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER signature_consent_versions_immutable_trigger ON public.signature_consent_versions;
DROP FUNCTION public.signature_enforce_consent_version_immutability();
DROP TRIGGER signature_type_approvals_immutable_trigger ON public.signature_document_type_approvals;
DROP FUNCTION public.signature_enforce_approval_immutability();
DROP TABLE public.signature_delivery_intents;
DROP TRIGGER signature_documents_send_governance_immutable_trigger ON public.signature_documents;
DROP FUNCTION public.signature_enforce_send_governance_immutability();
ALTER TABLE public.signature_documents DROP CONSTRAINT signature_documents_send_governance_check;
ALTER TABLE public.signature_documents DROP COLUMN consent_version_id;
ALTER TABLE public.signature_documents DROP COLUMN document_type_approval_id;
ALTER TABLE public.signature_sessions DROP CONSTRAINT signature_sessions_purpose_check;
ALTER TABLE public.signature_sessions DROP COLUMN purpose;
ALTER TABLE public.signature_signing_tokens DROP CONSTRAINT signature_signing_tokens_purpose_check;
ALTER TABLE public.signature_signing_tokens ADD CONSTRAINT signature_signing_tokens_purpose_check CHECK (purpose='sign_document');
DROP TABLE public.signature_consent_versions;
DROP TABLE public.signature_document_type_approvals;

COMMIT;
