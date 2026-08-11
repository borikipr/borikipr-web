BEGIN;

ALTER TABLE public.signature_documents
  ADD COLUMN privacy_disclosure_es_pr_text text NULL,
  ADD COLUMN privacy_disclosure_en_us_text text NULL,
  ADD CONSTRAINT signature_documents_privacy_disclosure_text_check CHECK (
    ((privacy_disclosure_es_pr_text IS NULL AND privacy_disclosure_en_us_text IS NULL AND privacy_disclosure_version IS NULL)
      OR (char_length(privacy_disclosure_es_pr_text) BETWEEN 20 AND 10000
        AND char_length(privacy_disclosure_en_us_text) BETWEEN 20 AND 10000
        AND privacy_disclosure_version IS NOT NULL))
  ),
  ADD CONSTRAINT signature_documents_sent_privacy_disclosure_text_check CHECK (
    status = 'draft' OR (privacy_disclosure_es_pr_text IS NOT NULL AND privacy_disclosure_en_us_text IS NOT NULL)
  );

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
    OR NEW.privacy_disclosure_es_pr_text IS DISTINCT FROM OLD.privacy_disclosure_es_pr_text
    OR NEW.privacy_disclosure_en_us_text IS DISTINCT FROM OLD.privacy_disclosure_en_us_text
  ) THEN RAISE EXCEPTION 'signature send governance evidence is immutable'; END IF;
  RETURN NEW;
END;
$$;

COMMIT;
