BEGIN;

CREATE OR REPLACE FUNCTION public.signature_governance_version_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='signature_privacy_disclosure_versions' AND OLD.status IN ('approved','retired') THEN
    IF OLD.status='approved' AND NEW.status='retired'
      AND NEW.retired_at IS NOT NULL
      AND NEW.version_identifier=OLD.version_identifier
      AND NEW.es_pr_text=OLD.es_pr_text AND NEW.en_us_text=OLD.en_us_text
      AND NEW.es_pr_sha256=OLD.es_pr_sha256 AND NEW.en_us_sha256=OLD.en_us_sha256
      AND NEW.approval_reference=OLD.approval_reference
      AND NEW.effective_from=OLD.effective_from AND NEW.approved_at=OLD.approved_at
      AND NEW.created_by_admin_id=OLD.created_by_admin_id
      AND NEW.approved_by_admin_id=OLD.approved_by_admin_id
      AND NEW.created_at=OLD.created_at
    THEN RETURN NEW; END IF;
    IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'approved signature privacy disclosure is immutable'; END IF;
  END IF;
  IF TG_TABLE_NAME='signature_retention_policy_versions' AND OLD.status IN ('active','retired') THEN
    IF OLD.status='active' AND NEW.status='retired'
      AND NEW.retired_at IS NOT NULL
      AND NEW.version_identifier=OLD.version_identifier
      AND NEW.approval_reference=OLD.approval_reference AND NEW.privacy_reference=OLD.privacy_reference
      AND NEW.source_pdf_days=OLD.source_pdf_days
      AND NEW.completed_pdf_days IS NOT DISTINCT FROM OLD.completed_pdf_days
      AND NEW.certificate_days IS NOT DISTINCT FROM OLD.certificate_days
      AND NEW.evidence_manifest_days IS NOT DISTINCT FROM OLD.evidence_manifest_days
      AND NEW.token_days=OLD.token_days AND NEW.session_hours=OLD.session_hours
      AND NEW.network_evidence_days=OLD.network_evidence_days
      AND NEW.failed_cancelled_draft_days=OLD.failed_cancelled_draft_days
      AND NEW.audit_event_days IS NOT DISTINCT FROM OLD.audit_event_days
      AND NEW.completed_cleanup_enabled=OLD.completed_cleanup_enabled
      AND NEW.activated_at=OLD.activated_at
      AND NEW.created_by_admin_id=OLD.created_by_admin_id
      AND NEW.activated_by_admin_id=OLD.activated_by_admin_id
      AND NEW.created_at=OLD.created_at
    THEN RETURN NEW; END IF;
    IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'active signature retention policy is immutable'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.signature_launch_authorization_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='active' AND NEW.status IN ('revoked','expired')
    AND NEW.environment=OLD.environment AND NEW.authorization_type=OLD.authorization_type
    AND NEW.readiness_snapshot_sha256=OLD.readiness_snapshot_sha256
    AND NEW.notes IS NOT DISTINCT FROM OLD.notes
    AND NEW.explicit_confirmation=OLD.explicit_confirmation
    AND NEW.authorized_by_admin_id=OLD.authorized_by_admin_id
    AND NEW.authorized_at=OLD.authorized_at
    AND NEW.expires_at IS NOT DISTINCT FROM OLD.expires_at
    AND (NEW.status <> 'revoked' OR NEW.revoked_at IS NOT NULL)
  THEN RETURN NEW; END IF;
  IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'signature launch authorization is immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER signature_launch_authorizations_immutable_trigger
BEFORE UPDATE OR DELETE ON public.signature_launch_authorizations
FOR EACH ROW EXECUTE FUNCTION public.signature_launch_authorization_immutability();

COMMIT;
