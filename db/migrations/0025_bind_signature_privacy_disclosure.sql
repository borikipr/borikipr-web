BEGIN;

ALTER TABLE public.signature_documents
  ADD COLUMN privacy_disclosure_version text NULL,
  ADD COLUMN privacy_disclosure_es_pr_sha256 text NULL,
  ADD COLUMN privacy_disclosure_en_us_sha256 text NULL,
  ADD COLUMN privacy_disclosure_effective_from timestamptz NULL,
  ADD COLUMN privacy_disclosure_approval_reference text NULL,
  ADD CONSTRAINT signature_documents_privacy_disclosure_version_check CHECK (
    privacy_disclosure_version IS NULL
    OR privacy_disclosure_version ~ '^[a-z0-9][a-z0-9._-]{0,99}$'
  ),
  ADD CONSTRAINT signature_documents_privacy_disclosure_hashes_check CHECK (
    (privacy_disclosure_es_pr_sha256 IS NULL AND privacy_disclosure_en_us_sha256 IS NULL)
    OR (
      privacy_disclosure_es_pr_sha256 ~ '^[0-9a-f]{64}$'
      AND privacy_disclosure_en_us_sha256 ~ '^[0-9a-f]{64}$'
    )
  ),
  ADD CONSTRAINT signature_documents_privacy_disclosure_reference_check CHECK (
    privacy_disclosure_approval_reference IS NULL
    OR char_length(btrim(privacy_disclosure_approval_reference)) BETWEEN 1 AND 200
  ),
  ADD CONSTRAINT signature_documents_privacy_disclosure_bundle_check CHECK (
    (
      privacy_disclosure_version IS NULL
      AND privacy_disclosure_es_pr_sha256 IS NULL
      AND privacy_disclosure_en_us_sha256 IS NULL
      AND privacy_disclosure_effective_from IS NULL
      AND privacy_disclosure_approval_reference IS NULL
    )
    OR (
      privacy_disclosure_version IS NOT NULL
      AND privacy_disclosure_es_pr_sha256 IS NOT NULL
      AND privacy_disclosure_en_us_sha256 IS NOT NULL
      AND privacy_disclosure_effective_from IS NOT NULL
      AND privacy_disclosure_approval_reference IS NOT NULL
    )
  ),
  ADD CONSTRAINT signature_documents_sent_privacy_disclosure_check CHECK (
    status = 'draft' OR privacy_disclosure_version IS NOT NULL
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
  ) THEN
    RAISE EXCEPTION 'signature send governance evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
