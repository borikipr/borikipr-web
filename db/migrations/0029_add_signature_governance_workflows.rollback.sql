BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.signature_document_type_approvals WHERE status IN ('draft','retired'))
    OR EXISTS (SELECT 1 FROM public.signature_consent_versions WHERE status='pending_review')
    OR EXISTS (SELECT 1 FROM public.signature_privacy_disclosure_versions WHERE status='pending_review')
    OR EXISTS (SELECT 1 FROM public.signature_retention_policy_versions WHERE status IN ('pending_review','approved'))
  THEN RAISE EXCEPTION '0029 rollback blocked: workflow records require preservation'; END IF;
END $$;

DROP INDEX public.signature_type_approvals_version_unique;
ALTER TABLE public.signature_governance_events
  DROP CONSTRAINT signature_governance_events_idempotency_unique,
  DROP COLUMN idempotency_key, DROP COLUMN external_approval_reference,
  DROP COLUMN new_state, DROP COLUMN previous_state;
ALTER TABLE public.signature_governance_events DROP CONSTRAINT signature_governance_events_entity_check;
ALTER TABLE public.signature_governance_events ADD CONSTRAINT signature_governance_events_entity_check CHECK (entity_type IN ('privacy_disclosure','retention_policy','launch_authorization'));
ALTER TABLE public.signature_governance_events DROP CONSTRAINT signature_governance_events_action_check;
ALTER TABLE public.signature_governance_events ADD CONSTRAINT signature_governance_events_action_check CHECK (action IN ('created','approved','activated','retired','authorized','revoked'));

ALTER TABLE public.signature_launch_authorizations DROP CONSTRAINT signature_launch_auth_document_scope_check,
  DROP CONSTRAINT signature_launch_auth_participant_scope_check,
  DROP COLUMN authorized_document_types, DROP COLUMN authorized_participant_scope;

ALTER TABLE public.signature_retention_policy_versions DROP CONSTRAINT signature_retention_versions_active_check;
ALTER TABLE public.signature_retention_policy_versions DROP CONSTRAINT signature_retention_versions_status_check;
ALTER TABLE public.signature_retention_policy_versions ADD CONSTRAINT signature_retention_versions_status_check CHECK (status IN ('draft','active','retired'));
ALTER TABLE public.signature_retention_policy_versions ADD CONSTRAINT signature_retention_versions_active_check CHECK (status <> 'active' OR (approval_reference IS NOT NULL AND privacy_reference IS NOT NULL AND activated_at IS NOT NULL AND activated_by_admin_id IS NOT NULL));
ALTER TABLE public.signature_retention_policy_versions DROP COLUMN external_reviewer_reference, DROP COLUMN external_reviewer_name,
  DROP COLUMN legacy_imported, DROP COLUMN approved_by_admin_id, DROP COLUMN approved_at, DROP COLUMN submitted_at, DROP COLUMN policy_sha256;

ALTER TABLE public.signature_privacy_disclosure_versions DROP CONSTRAINT signature_privacy_versions_approval_check;
ALTER TABLE public.signature_privacy_disclosure_versions DROP CONSTRAINT signature_privacy_versions_status_check;
ALTER TABLE public.signature_privacy_disclosure_versions ADD CONSTRAINT signature_privacy_versions_status_check CHECK (status IN ('draft','approved','retired'));
ALTER TABLE public.signature_privacy_disclosure_versions ADD CONSTRAINT signature_privacy_versions_approval_check CHECK (status <> 'approved' OR (approval_reference IS NOT NULL AND effective_from IS NOT NULL AND approved_at IS NOT NULL AND approved_by_admin_id IS NOT NULL));
ALTER TABLE public.signature_privacy_disclosure_versions DROP COLUMN legacy_imported, DROP COLUMN external_reviewer_reference, DROP COLUMN external_reviewer_name, DROP COLUMN submitted_at;

ALTER TABLE public.signature_consent_versions DROP CONSTRAINT signature_consent_versions_approved_check;
ALTER TABLE public.signature_consent_versions DROP CONSTRAINT signature_consent_versions_status_check;
ALTER TABLE public.signature_consent_versions ADD CONSTRAINT signature_consent_versions_status_check CHECK (status IN ('draft','approved','retired'));
ALTER TABLE public.signature_consent_versions ADD CONSTRAINT signature_consent_versions_approved_check CHECK (status <> 'approved' OR (effective_from IS NOT NULL AND approval_reference IS NOT NULL));
ALTER TABLE public.signature_consent_versions DROP COLUMN external_reviewer_reference, DROP COLUMN external_reviewer_name,
  DROP COLUMN legacy_imported, DROP COLUMN approved_by_admin_id, DROP COLUMN retired_at, DROP COLUMN approved_at, DROP COLUMN submitted_at;

ALTER TABLE public.signature_document_type_approvals DROP CONSTRAINT signature_type_approvals_approved_check;
ALTER TABLE public.signature_document_type_approvals DROP CONSTRAINT signature_type_approvals_status_check;
ALTER TABLE public.signature_document_type_approvals ADD CONSTRAINT signature_type_approvals_status_check CHECK (status IN ('pending','approved','restricted','revoked'));
ALTER TABLE public.signature_document_type_approvals ADD CONSTRAINT signature_type_approvals_approved_check CHECK (status <> 'approved' OR (approval_reference IS NOT NULL AND approval_date IS NOT NULL AND reviewed_by IS NOT NULL AND source_reference IS NOT NULL AND effective_from IS NOT NULL AND revoked_at IS NULL));
ALTER TABLE public.signature_document_type_approvals DROP CONSTRAINT signature_type_approvals_counsel_check,
  DROP CONSTRAINT signature_type_approvals_use_check, DROP CONSTRAINT signature_type_approvals_description_check,
  DROP CONSTRAINT signature_type_approvals_display_check, DROP CONSTRAINT signature_type_approvals_version_check,
  DROP COLUMN approved_at, DROP COLUMN submitted_at, DROP COLUMN counsel_law_firm, DROP COLUMN counsel_name,
  DROP COLUMN legacy_imported,
  DROP COLUMN entered_by_admin_id, DROP COLUMN created_by_admin_id, DROP COLUMN permitted_signing_use,
  DROP COLUMN description, DROP COLUMN display_name, DROP COLUMN version_number;

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
COMMIT;
