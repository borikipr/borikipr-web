BEGIN;

ALTER TABLE public.signature_document_type_approvals
  ADD COLUMN version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN display_name text NULL,
  ADD COLUMN description text NULL,
  ADD COLUMN permitted_signing_use text NULL,
  ADD COLUMN created_by_admin_id uuid NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  ADD COLUMN entered_by_admin_id uuid NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  ADD COLUMN counsel_name text NULL,
  ADD COLUMN counsel_law_firm text NULL,
  ADD COLUMN submitted_at timestamptz NULL,
  ADD COLUMN approved_at timestamptz NULL,
  ADD COLUMN legacy_imported boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT signature_type_approvals_version_check CHECK (version_number BETWEEN 1 AND 10000),
  ADD CONSTRAINT signature_type_approvals_display_check CHECK (display_name IS NULL OR char_length(btrim(display_name)) BETWEEN 1 AND 200),
  ADD CONSTRAINT signature_type_approvals_description_check CHECK (description IS NULL OR char_length(description) <= 2000),
  ADD CONSTRAINT signature_type_approvals_use_check CHECK (permitted_signing_use IS NULL OR char_length(permitted_signing_use) <= 2000),
  ADD CONSTRAINT signature_type_approvals_counsel_check CHECK (
    (counsel_name IS NULL AND counsel_law_firm IS NULL)
    OR (counsel_name IS NOT NULL AND char_length(btrim(counsel_name)) BETWEEN 1 AND 200
        AND counsel_law_firm IS NOT NULL AND char_length(btrim(counsel_law_firm)) BETWEEN 1 AND 200)
  );
ALTER TABLE public.signature_document_type_approvals DROP CONSTRAINT signature_type_approvals_status_check;
ALTER TABLE public.signature_document_type_approvals ADD CONSTRAINT signature_type_approvals_status_check
  CHECK (status IN ('draft','pending','approved','restricted','revoked','retired'));
ALTER TABLE public.signature_document_type_approvals DROP CONSTRAINT signature_type_approvals_approved_check;
UPDATE public.signature_document_type_approvals SET legacy_imported=true WHERE status IN ('approved','restricted','revoked');
ALTER TABLE public.signature_document_type_approvals ADD CONSTRAINT signature_type_approvals_approved_check CHECK (
  status <> 'approved' OR (
    approval_reference IS NOT NULL AND approval_date IS NOT NULL AND reviewed_by IS NOT NULL
    AND source_reference IS NOT NULL AND effective_from IS NOT NULL AND revoked_at IS NULL
    AND (legacy_imported OR (counsel_name IS NOT NULL AND counsel_law_firm IS NOT NULL
      AND entered_by_admin_id IS NOT NULL AND approved_at IS NOT NULL))
  )
);
CREATE UNIQUE INDEX signature_type_approvals_version_unique
  ON public.signature_document_type_approvals (document_type, version_number);

ALTER TABLE public.signature_consent_versions
  ADD COLUMN submitted_at timestamptz NULL,
  ADD COLUMN approved_at timestamptz NULL,
  ADD COLUMN retired_at timestamptz NULL,
  ADD COLUMN approved_by_admin_id uuid NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  ADD COLUMN external_reviewer_name text NULL,
  ADD COLUMN external_reviewer_reference text NULL,
  ADD COLUMN legacy_imported boolean NOT NULL DEFAULT false;
ALTER TABLE public.signature_consent_versions DROP CONSTRAINT signature_consent_versions_status_check;
ALTER TABLE public.signature_consent_versions ADD CONSTRAINT signature_consent_versions_status_check
  CHECK (status IN ('draft','pending_review','approved','retired'));
ALTER TABLE public.signature_consent_versions DROP CONSTRAINT signature_consent_versions_approved_check;
UPDATE public.signature_consent_versions SET legacy_imported=true WHERE status IN ('approved','retired');
ALTER TABLE public.signature_consent_versions ADD CONSTRAINT signature_consent_versions_approved_check CHECK (
  status <> 'approved' OR (
    effective_from IS NOT NULL AND approval_reference IS NOT NULL AND (legacy_imported OR (
      approved_at IS NOT NULL AND approved_by_admin_id IS NOT NULL AND external_reviewer_name IS NOT NULL
      AND external_reviewer_reference IS NOT NULL))
  )
);

ALTER TABLE public.signature_privacy_disclosure_versions
  ADD COLUMN submitted_at timestamptz NULL,
  ADD COLUMN external_reviewer_name text NULL,
  ADD COLUMN external_reviewer_reference text NULL,
  ADD COLUMN legacy_imported boolean NOT NULL DEFAULT false;
ALTER TABLE public.signature_privacy_disclosure_versions DROP CONSTRAINT signature_privacy_versions_status_check;
ALTER TABLE public.signature_privacy_disclosure_versions ADD CONSTRAINT signature_privacy_versions_status_check
  CHECK (status IN ('draft','pending_review','approved','retired'));
ALTER TABLE public.signature_privacy_disclosure_versions DROP CONSTRAINT signature_privacy_versions_approval_check;
UPDATE public.signature_privacy_disclosure_versions SET legacy_imported=true WHERE status IN ('approved','retired');
ALTER TABLE public.signature_privacy_disclosure_versions ADD CONSTRAINT signature_privacy_versions_approval_check CHECK (
  status <> 'approved' OR (
    approval_reference IS NOT NULL AND effective_from IS NOT NULL AND (legacy_imported OR (
      approved_at IS NOT NULL AND approved_by_admin_id IS NOT NULL AND external_reviewer_name IS NOT NULL
      AND external_reviewer_reference IS NOT NULL))
  )
);

ALTER TABLE public.signature_retention_policy_versions
  ADD COLUMN policy_sha256 text NULL,
  ADD COLUMN submitted_at timestamptz NULL,
  ADD COLUMN approved_at timestamptz NULL,
  ADD COLUMN approved_by_admin_id uuid NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  ADD COLUMN external_reviewer_name text NULL,
  ADD COLUMN external_reviewer_reference text NULL,
  ADD COLUMN legacy_imported boolean NOT NULL DEFAULT false;
ALTER TABLE public.signature_retention_policy_versions DROP CONSTRAINT signature_retention_versions_status_check;
ALTER TABLE public.signature_retention_policy_versions ADD CONSTRAINT signature_retention_versions_status_check
  CHECK (status IN ('draft','pending_review','approved','active','retired'));
ALTER TABLE public.signature_retention_policy_versions DROP CONSTRAINT signature_retention_versions_active_check;
UPDATE public.signature_retention_policy_versions SET legacy_imported=true WHERE status IN ('active','retired');
ALTER TABLE public.signature_retention_policy_versions ADD CONSTRAINT signature_retention_versions_active_check CHECK (
  status NOT IN ('approved','active') OR (
    approval_reference IS NOT NULL AND privacy_reference IS NOT NULL AND (legacy_imported OR (
    policy_sha256 ~ '^[0-9a-f]{64}$' AND approved_at IS NOT NULL AND approved_by_admin_id IS NOT NULL
    AND external_reviewer_name IS NOT NULL AND external_reviewer_reference IS NOT NULL))
    AND (status <> 'active' OR (activated_at IS NOT NULL AND activated_by_admin_id IS NOT NULL))
  )
);

ALTER TABLE public.signature_launch_authorizations
  ADD COLUMN authorized_participant_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN authorized_document_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD CONSTRAINT signature_launch_auth_participant_scope_check CHECK (jsonb_typeof(authorized_participant_scope)='array' AND jsonb_array_length(authorized_participant_scope) BETWEEN 0 AND 8),
  ADD CONSTRAINT signature_launch_auth_document_scope_check CHECK (cardinality(authorized_document_types) BETWEEN 0 AND 20);

ALTER TABLE public.signature_governance_events
  ADD COLUMN previous_state text NULL,
  ADD COLUMN new_state text NULL,
  ADD COLUMN external_approval_reference text NULL,
  ADD COLUMN idempotency_key uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD CONSTRAINT signature_governance_events_idempotency_unique UNIQUE (idempotency_key);
ALTER TABLE public.signature_governance_events DROP CONSTRAINT signature_governance_events_entity_check;
ALTER TABLE public.signature_governance_events ADD CONSTRAINT signature_governance_events_entity_check
  CHECK (entity_type IN ('document_classification','consent_version','privacy_disclosure','retention_policy','launch_authorization'));
ALTER TABLE public.signature_governance_events DROP CONSTRAINT signature_governance_events_action_check;
ALTER TABLE public.signature_governance_events ADD CONSTRAINT signature_governance_events_action_check
  CHECK (action IN ('created','submitted','approved','activated','retired','restricted','authorized','revoked'));

CREATE OR REPLACE FUNCTION public.signature_enforce_approval_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('approved','restricted','revoked','retired') THEN
    IF OLD.status='approved' AND NEW.status IN ('revoked','retired')
       AND NEW.document_type=OLD.document_type AND NEW.version_number=OLD.version_number
       AND NEW.approval_reference=OLD.approval_reference AND NEW.approval_date=OLD.approval_date
       AND NEW.reviewed_by=OLD.reviewed_by AND NEW.source_reference=OLD.source_reference
       AND NEW.effective_from=OLD.effective_from AND NEW.approved_at=OLD.approved_at
       AND NEW.entered_by_admin_id=OLD.entered_by_admin_id AND NEW.counsel_name=OLD.counsel_name
       AND NEW.counsel_law_firm=OLD.counsel_law_firm
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
    IF OLD.status='approved' AND NEW.status='retired'
       AND NEW.version_identifier=OLD.version_identifier AND NEW.locale=OLD.locale
       AND NEW.consent_text=OLD.consent_text AND NEW.consent_text_sha256=OLD.consent_text_sha256
       AND NEW.effective_from=OLD.effective_from AND NEW.approval_reference=OLD.approval_reference
       AND NEW.approved_at=OLD.approved_at AND NEW.approved_by_admin_id=OLD.approved_by_admin_id
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
      IF OLD.status='approved' AND NEW.status='retired'
         AND NEW.version_identifier=OLD.version_identifier
         AND NEW.es_pr_text=OLD.es_pr_text AND NEW.en_us_text=OLD.en_us_text
         AND NEW.es_pr_sha256=OLD.es_pr_sha256 AND NEW.en_us_sha256=OLD.en_us_sha256
         AND NEW.approval_reference=OLD.approval_reference AND NEW.effective_from=OLD.effective_from
         AND NEW.approved_at=OLD.approved_at AND NEW.approved_by_admin_id=OLD.approved_by_admin_id
      THEN RETURN NEW; END IF;
      IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'approved signature privacy disclosure is immutable'; END IF;
    END IF;
    IF OLD.status='draft' AND NEW.status NOT IN ('draft','pending_review') THEN RAISE EXCEPTION 'signature privacy transition rejected'; END IF;
    IF OLD.status='pending_review' AND NEW.status NOT IN ('pending_review','approved') THEN RAISE EXCEPTION 'signature privacy transition rejected'; END IF;
  END IF;
  IF TG_TABLE_NAME='signature_retention_policy_versions' THEN
    IF OLD.status IN ('approved','active','retired') THEN
      IF OLD.status='approved' AND NEW.status='active'
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
      THEN RETURN NEW; END IF;
      IF OLD.status='active' AND NEW.status='retired'
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
      THEN RETURN NEW; END IF;
      IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'approved signature retention policy is immutable'; END IF;
    END IF;
    IF OLD.status='draft' AND NEW.status NOT IN ('draft','pending_review') THEN RAISE EXCEPTION 'signature retention transition rejected'; END IF;
    IF OLD.status='pending_review' AND NEW.status NOT IN ('pending_review','approved') THEN RAISE EXCEPTION 'signature retention transition rejected'; END IF;
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
    AND NEW.authorized_participant_scope=OLD.authorized_participant_scope
    AND NEW.authorized_document_types=OLD.authorized_document_types
    AND (NEW.status <> 'revoked' OR NEW.revoked_at IS NOT NULL)
  THEN RETURN NEW; END IF;
  IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'signature launch authorization is immutable'; END IF;
  RETURN NEW;
END;
$$;

COMMIT;
