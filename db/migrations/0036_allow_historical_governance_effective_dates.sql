BEGIN;

-- Human approvals can be entered after their approved effective date. The
-- technical creation timestamp remains the immutable system-entry time.
ALTER TABLE public.signature_document_type_approvals
  DROP CONSTRAINT signature_type_approvals_time_check;
ALTER TABLE public.signature_document_type_approvals
  ADD CONSTRAINT signature_type_approvals_time_check CHECK (
    updated_at >= created_at
    AND (revoked_at IS NULL OR revoked_at >= created_at)
  );

ALTER TABLE public.signature_consent_versions
  DROP CONSTRAINT signature_consent_versions_time_check;
ALTER TABLE public.signature_consent_versions
  ADD CONSTRAINT signature_consent_versions_time_check CHECK (
    updated_at >= created_at
  );

COMMIT;
