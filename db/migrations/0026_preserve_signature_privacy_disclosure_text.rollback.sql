BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.signature_documents
    WHERE privacy_disclosure_es_pr_text IS NOT NULL OR privacy_disclosure_en_us_text IS NOT NULL)
  THEN RAISE EXCEPTION 'rollback blocked: durable signature privacy disclosure text exists'; END IF;
END;
$$;

ALTER TABLE public.signature_documents
  DROP CONSTRAINT signature_documents_sent_privacy_disclosure_text_check,
  DROP CONSTRAINT signature_documents_privacy_disclosure_text_check,
  DROP COLUMN privacy_disclosure_en_us_text,
  DROP COLUMN privacy_disclosure_es_pr_text;

CREATE OR REPLACE FUNCTION public.signature_enforce_send_governance_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'draft' AND (
    NEW.document_type_approval_id IS DISTINCT FROM OLD.document_type_approval_id
    OR NEW.consent_version_id IS DISTINCT FROM OLD.consent_version_id
    OR NEW.privacy_disclosure_version IS DISTINCT FROM OLD.privacy_disclosure_version
    OR NEW.privacy_disclosure_es_pr_sha256 IS DISTINCT FROM OLD.privacy_disclosure_es_pr_sha256
    OR NEW.privacy_disclosure_en_us_sha256 IS DISTINCT FROM OLD.privacy_disclosure_en_us_sha256
    OR NEW.privacy_disclosure_effective_from IS DISTINCT FROM OLD.privacy_disclosure_effective_from
    OR NEW.privacy_disclosure_approval_reference IS DISTINCT FROM OLD.privacy_disclosure_approval_reference
  ) THEN RAISE EXCEPTION 'signature send governance evidence is immutable'; END IF;
  RETURN NEW;
END;
$$;

COMMIT;
