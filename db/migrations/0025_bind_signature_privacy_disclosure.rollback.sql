BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.signature_documents
    WHERE privacy_disclosure_version IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'rollback blocked: signature privacy disclosure evidence exists';
  END IF;
END;
$$;

ALTER TABLE public.signature_documents
  DROP CONSTRAINT signature_documents_sent_privacy_disclosure_check,
  DROP CONSTRAINT signature_documents_privacy_disclosure_bundle_check,
  DROP CONSTRAINT signature_documents_privacy_disclosure_reference_check,
  DROP CONSTRAINT signature_documents_privacy_disclosure_hashes_check,
  DROP CONSTRAINT signature_documents_privacy_disclosure_version_check,
  DROP COLUMN privacy_disclosure_approval_reference,
  DROP COLUMN privacy_disclosure_effective_from,
  DROP COLUMN privacy_disclosure_en_us_sha256,
  DROP COLUMN privacy_disclosure_es_pr_sha256,
  DROP COLUMN privacy_disclosure_version;

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

COMMIT;
