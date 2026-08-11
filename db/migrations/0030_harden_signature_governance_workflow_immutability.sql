BEGIN;

ALTER TABLE public.signature_document_type_approvals
  ADD COLUMN retired_at timestamptz NULL,
  ADD CONSTRAINT signature_type_approvals_retired_check CHECK (status <> 'retired' OR retired_at IS NOT NULL);

CREATE OR REPLACE FUNCTION public.signature_enforce_approval_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('approved','restricted','revoked','retired') THEN
    IF OLD.status='approved' AND NEW.status IN ('revoked','retired')
       AND NEW.document_type=OLD.document_type AND NEW.version_number=OLD.version_number
       AND NEW.display_name IS NOT DISTINCT FROM OLD.display_name
       AND NEW.description IS NOT DISTINCT FROM OLD.description
       AND NEW.permitted_signing_use IS NOT DISTINCT FROM OLD.permitted_signing_use
       AND NEW.approval_reference=OLD.approval_reference AND NEW.approval_date=OLD.approval_date
       AND NEW.reviewed_by=OLD.reviewed_by AND NEW.source_reference=OLD.source_reference
       AND NEW.effective_from=OLD.effective_from AND NEW.approved_at IS NOT DISTINCT FROM OLD.approved_at
       AND NEW.entered_by_admin_id IS NOT DISTINCT FROM OLD.entered_by_admin_id
       AND NEW.created_by_admin_id IS NOT DISTINCT FROM OLD.created_by_admin_id
       AND NEW.counsel_name IS NOT DISTINCT FROM OLD.counsel_name
       AND NEW.counsel_law_firm IS NOT DISTINCT FROM OLD.counsel_law_firm
       AND NEW.legacy_imported=OLD.legacy_imported AND NEW.created_at=OLD.created_at
       AND (NEW.status <> 'revoked' OR NEW.revoked_at IS NOT NULL)
       AND (NEW.status <> 'retired' OR NEW.retired_at IS NOT NULL)
    THEN RETURN NEW; END IF;
    IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'signature counsel approval evidence is immutable'; END IF;
  END IF;
  IF OLD.status='draft' AND NEW.status NOT IN ('draft','pending') THEN RAISE EXCEPTION 'signature counsel approval transition rejected'; END IF;
  IF OLD.status='pending' AND NEW.status NOT IN ('pending','approved','restricted') THEN RAISE EXCEPTION 'signature counsel approval transition rejected'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.signature_enforce_consent_version_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('approved','retired') THEN
    IF OLD.status='approved' AND NEW.status='retired' AND NEW.retired_at IS NOT NULL
       AND NEW.version_identifier=OLD.version_identifier AND NEW.locale=OLD.locale
       AND NEW.consent_text=OLD.consent_text AND NEW.consent_text_sha256=OLD.consent_text_sha256
       AND NEW.effective_from=OLD.effective_from AND NEW.approval_reference=OLD.approval_reference
       AND NEW.approved_at IS NOT DISTINCT FROM OLD.approved_at
       AND NEW.approved_by_admin_id IS NOT DISTINCT FROM OLD.approved_by_admin_id
       AND NEW.external_reviewer_name IS NOT DISTINCT FROM OLD.external_reviewer_name
       AND NEW.external_reviewer_reference IS NOT DISTINCT FROM OLD.external_reviewer_reference
       AND NEW.created_by_admin_id=OLD.created_by_admin_id AND NEW.created_at=OLD.created_at
       AND NEW.legacy_imported=OLD.legacy_imported
    THEN RETURN NEW; END IF;
    IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'approved signature consent is immutable'; END IF;
  END IF;
  IF OLD.status='draft' AND NEW.status NOT IN ('draft','pending_review') THEN RAISE EXCEPTION 'signature consent transition rejected'; END IF;
  IF OLD.status='pending_review' AND NEW.status NOT IN ('pending_review','approved') THEN RAISE EXCEPTION 'signature consent transition rejected'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.signature_governance_version_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='signature_privacy_disclosure_versions' THEN
    IF OLD.status IN ('approved','retired') THEN
      IF OLD.status='approved' AND NEW.status='retired' AND NEW.retired_at IS NOT NULL
         AND NEW.version_identifier=OLD.version_identifier
         AND NEW.es_pr_text=OLD.es_pr_text AND NEW.en_us_text=OLD.en_us_text
         AND NEW.es_pr_sha256=OLD.es_pr_sha256 AND NEW.en_us_sha256=OLD.en_us_sha256
         AND NEW.approval_reference=OLD.approval_reference AND NEW.effective_from=OLD.effective_from
         AND NEW.approved_at=OLD.approved_at AND NEW.approved_by_admin_id=OLD.approved_by_admin_id
         AND NEW.external_reviewer_name=OLD.external_reviewer_name
         AND NEW.external_reviewer_reference=OLD.external_reviewer_reference
         AND NEW.created_by_admin_id=OLD.created_by_admin_id AND NEW.created_at=OLD.created_at
         AND NEW.legacy_imported=OLD.legacy_imported
      THEN RETURN NEW; END IF;
      IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'approved signature privacy disclosure is immutable'; END IF;
    END IF;
    IF OLD.status='draft' AND NEW.status NOT IN ('draft','pending_review') THEN RAISE EXCEPTION 'signature privacy transition rejected'; END IF;
    IF OLD.status='pending_review' AND NEW.status NOT IN ('pending_review','approved') THEN RAISE EXCEPTION 'signature privacy transition rejected'; END IF;
  END IF;
  IF TG_TABLE_NAME='signature_retention_policy_versions' THEN
    IF OLD.status IN ('approved','active','retired') THEN
      IF ((OLD.status='approved' AND NEW.status='active' AND NEW.activated_at IS NOT NULL AND NEW.activated_by_admin_id IS NOT NULL)
          OR (OLD.status='active' AND NEW.status='retired' AND NEW.retired_at IS NOT NULL))
         AND NEW.version_identifier=OLD.version_identifier AND NEW.policy_sha256=OLD.policy_sha256
         AND NEW.approval_reference=OLD.approval_reference AND NEW.privacy_reference=OLD.privacy_reference
         AND NEW.source_pdf_days=OLD.source_pdf_days AND NEW.completed_pdf_days IS NOT DISTINCT FROM OLD.completed_pdf_days
         AND NEW.certificate_days IS NOT DISTINCT FROM OLD.certificate_days
         AND NEW.evidence_manifest_days IS NOT DISTINCT FROM OLD.evidence_manifest_days
         AND NEW.token_days=OLD.token_days AND NEW.session_hours=OLD.session_hours
         AND NEW.network_evidence_days=OLD.network_evidence_days
         AND NEW.failed_cancelled_draft_days=OLD.failed_cancelled_draft_days
         AND NEW.audit_event_days IS NOT DISTINCT FROM OLD.audit_event_days
         AND NEW.completed_cleanup_enabled=OLD.completed_cleanup_enabled
         AND NEW.approved_at=OLD.approved_at AND NEW.approved_by_admin_id=OLD.approved_by_admin_id
         AND NEW.external_reviewer_name=OLD.external_reviewer_name
         AND NEW.external_reviewer_reference=OLD.external_reviewer_reference
         AND NEW.created_by_admin_id=OLD.created_by_admin_id AND NEW.created_at=OLD.created_at
         AND NEW.legacy_imported=OLD.legacy_imported
      THEN RETURN NEW; END IF;
      IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'approved signature retention policy is immutable'; END IF;
    END IF;
    IF OLD.status='draft' AND NEW.status NOT IN ('draft','pending_review') THEN RAISE EXCEPTION 'signature retention transition rejected'; END IF;
    IF OLD.status='pending_review' AND NEW.status NOT IN ('pending_review','approved') THEN RAISE EXCEPTION 'signature retention transition rejected'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
