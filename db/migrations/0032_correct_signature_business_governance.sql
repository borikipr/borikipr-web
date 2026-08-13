BEGIN;

ALTER TABLE public.signature_document_type_approvals
  ADD COLUMN approval_mode text NOT NULL DEFAULT 'external_review',
  ADD COLUMN approved_by_admin_id uuid NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  ADD COLUMN approver_role text NULL,
  ADD COLUMN external_reviewer_role text NULL,
  ADD COLUMN approval_snapshot_sha256 text NULL,
  ADD COLUMN phase2m_legacy boolean NOT NULL DEFAULT true,
  ADD CONSTRAINT signature_type_approvals_mode_check
    CHECK (approval_mode IN ('internal_business','external_review','out_of_scope')),
  ADD CONSTRAINT signature_type_approvals_approver_role_check
    CHECK (approver_role IS NULL OR char_length(btrim(approver_role)) BETWEEN 1 AND 120),
  ADD CONSTRAINT signature_type_approvals_external_role_check
    CHECK (external_reviewer_role IS NULL OR char_length(btrim(external_reviewer_role)) BETWEEN 1 AND 120),
  ADD CONSTRAINT signature_type_approvals_snapshot_check
    CHECK (approval_snapshot_sha256 IS NULL OR approval_snapshot_sha256 ~ '^[0-9a-f]{64}$');
ALTER TABLE public.signature_document_type_approvals ALTER COLUMN approval_mode SET DEFAULT 'internal_business';
ALTER TABLE public.signature_document_type_approvals ALTER COLUMN phase2m_legacy SET DEFAULT false;
ALTER TABLE public.signature_document_type_approvals DROP CONSTRAINT signature_type_approvals_approved_check;
ALTER TABLE public.signature_document_type_approvals ADD CONSTRAINT signature_type_approvals_approved_check CHECK (
  status <> 'approved' OR (
    approval_mode IN ('internal_business','external_review')
    AND approval_reference IS NOT NULL AND approval_date IS NOT NULL
    AND effective_from IS NOT NULL AND revoked_at IS NULL
    AND (legacy_imported OR phase2m_legacy OR (
      approved_at IS NOT NULL AND approved_by_admin_id IS NOT NULL
      AND entered_by_admin_id IS NOT NULL AND approver_role IS NOT NULL
      AND approval_snapshot_sha256 ~ '^[0-9a-f]{64}$'
      AND (
        approval_mode='internal_business'
        OR (counsel_name IS NOT NULL AND counsel_law_firm IS NOT NULL
            AND source_reference IS NOT NULL)
      )
    ))
  )
);
ALTER TABLE public.signature_document_type_approvals ADD CONSTRAINT signature_type_approvals_restricted_check CHECK (
  status <> 'restricted' OR legacy_imported OR phase2m_legacy OR (
    approval_mode='out_of_scope' AND approval_reference IS NOT NULL AND approval_date IS NOT NULL
    AND effective_from IS NOT NULL AND approved_at IS NOT NULL AND approved_by_admin_id IS NOT NULL
    AND entered_by_admin_id IS NOT NULL AND approver_role IS NOT NULL
    AND approval_snapshot_sha256 ~ '^[0-9a-f]{64}$'
  )
);

ALTER TABLE public.signature_consent_versions
  ADD COLUMN approval_mode text NOT NULL DEFAULT 'external_review',
  ADD COLUMN approver_role text NULL,
  ADD COLUMN phase2m_legacy boolean NOT NULL DEFAULT true,
  ADD CONSTRAINT signature_consent_approval_mode_check
    CHECK (approval_mode IN ('internal_business','external_review')),
  ADD CONSTRAINT signature_consent_approver_role_check
    CHECK (approver_role IS NULL OR char_length(btrim(approver_role)) BETWEEN 1 AND 120);
ALTER TABLE public.signature_consent_versions ALTER COLUMN approval_mode SET DEFAULT 'internal_business';
ALTER TABLE public.signature_consent_versions ALTER COLUMN phase2m_legacy SET DEFAULT false;
ALTER TABLE public.signature_consent_versions DROP CONSTRAINT signature_consent_versions_approved_check;
ALTER TABLE public.signature_consent_versions ADD CONSTRAINT signature_consent_versions_approved_check CHECK (
  status <> 'approved' OR (
    effective_from IS NOT NULL AND approval_reference IS NOT NULL AND (legacy_imported OR phase2m_legacy OR (
      approved_at IS NOT NULL AND approved_by_admin_id IS NOT NULL AND approver_role IS NOT NULL
      AND (approval_mode='internal_business' OR
        (external_reviewer_name IS NOT NULL AND external_reviewer_reference IS NOT NULL))
    ))
  )
);

ALTER TABLE public.signature_privacy_disclosure_versions
  ADD COLUMN approval_mode text NOT NULL DEFAULT 'external_review',
  ADD COLUMN approver_role text NULL,
  ADD COLUMN phase2m_legacy boolean NOT NULL DEFAULT true,
  ADD CONSTRAINT signature_privacy_approval_mode_check
    CHECK (approval_mode IN ('internal_business','external_review')),
  ADD CONSTRAINT signature_privacy_approver_role_check
    CHECK (approver_role IS NULL OR char_length(btrim(approver_role)) BETWEEN 1 AND 120);
ALTER TABLE public.signature_privacy_disclosure_versions ALTER COLUMN approval_mode SET DEFAULT 'internal_business';
ALTER TABLE public.signature_privacy_disclosure_versions ALTER COLUMN phase2m_legacy SET DEFAULT false;
ALTER TABLE public.signature_privacy_disclosure_versions DROP CONSTRAINT signature_privacy_versions_approval_check;
ALTER TABLE public.signature_privacy_disclosure_versions ADD CONSTRAINT signature_privacy_versions_approval_check CHECK (
  status <> 'approved' OR (
    approval_reference IS NOT NULL AND effective_from IS NOT NULL AND (legacy_imported OR phase2m_legacy OR (
      approved_at IS NOT NULL AND approved_by_admin_id IS NOT NULL AND approver_role IS NOT NULL
      AND (approval_mode='internal_business' OR
        (external_reviewer_name IS NOT NULL AND external_reviewer_reference IS NOT NULL))
    ))
  )
);

ALTER TABLE public.signature_retention_policy_versions
  ADD COLUMN approval_mode text NOT NULL DEFAULT 'external_review',
  ADD COLUMN approver_role text NULL,
  ADD COLUMN phase2m_legacy boolean NOT NULL DEFAULT true,
  ADD CONSTRAINT signature_retention_approval_mode_check
    CHECK (approval_mode IN ('internal_business','external_review')),
  ADD CONSTRAINT signature_retention_approver_role_check
    CHECK (approver_role IS NULL OR char_length(btrim(approver_role)) BETWEEN 1 AND 120);
ALTER TABLE public.signature_retention_policy_versions ALTER COLUMN approval_mode SET DEFAULT 'internal_business';
ALTER TABLE public.signature_retention_policy_versions ALTER COLUMN phase2m_legacy SET DEFAULT false;
ALTER TABLE public.signature_retention_policy_versions DROP CONSTRAINT signature_retention_versions_active_check;
ALTER TABLE public.signature_retention_policy_versions ADD CONSTRAINT signature_retention_versions_active_check CHECK (
  status NOT IN ('approved','active') OR (
    approval_reference IS NOT NULL AND privacy_reference IS NOT NULL AND (legacy_imported OR phase2m_legacy OR (
      policy_sha256 ~ '^[0-9a-f]{64}$' AND approved_at IS NOT NULL
      AND approved_by_admin_id IS NOT NULL AND approver_role IS NOT NULL
      AND (approval_mode='internal_business' OR
        (external_reviewer_name IS NOT NULL AND external_reviewer_reference IS NOT NULL))
    ))
    AND (status <> 'active' OR (activated_at IS NOT NULL AND activated_by_admin_id IS NOT NULL))
  )
);

ALTER TABLE public.signature_participants DROP CONSTRAINT signature_participants_role_check;
ALTER TABLE public.signature_participants ADD CONSTRAINT signature_participants_role_check CHECK (
  char_length(btrim(role)) BETWEEN 1 AND 80 AND role !~ '[[:cntrl:]]'
);

ALTER TABLE public.signature_documents
  ADD COLUMN archived_at timestamptz NULL,
  ADD COLUMN archived_by_admin_id uuid NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  ADD COLUMN archive_reason text NULL,
  ADD COLUMN deleted_at timestamptz NULL,
  ADD COLUMN deleted_by_admin_id uuid NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT signature_documents_archive_evidence_check CHECK (
    (status <> 'archived' AND archived_at IS NULL AND archived_by_admin_id IS NULL AND archive_reason IS NULL AND deleted_at IS NULL AND deleted_by_admin_id IS NULL)
    OR (status='archived' AND archived_at IS NOT NULL AND archived_by_admin_id IS NOT NULL
        AND char_length(btrim(archive_reason)) BETWEEN 1 AND 500
        AND ((deleted_at IS NULL AND deleted_by_admin_id IS NULL)
          OR (deleted_at IS NOT NULL AND deleted_by_admin_id IS NOT NULL)))
  );
ALTER TABLE public.signature_documents DROP CONSTRAINT signature_documents_status_check;
ALTER TABLE public.signature_documents ADD CONSTRAINT signature_documents_status_check CHECK (
  status IN ('draft','sent','viewed','partially_signed','completed','voided','expired','archived')
);
ALTER TABLE public.signature_documents DROP CONSTRAINT signature_documents_active_state_check;
ALTER TABLE public.signature_documents ADD CONSTRAINT signature_documents_active_state_check CHECK (
  status IN ('draft','archived') OR (active_version_id IS NOT NULL AND document_type_approval_reference IS NOT NULL)
);
ALTER TABLE public.signature_documents DROP CONSTRAINT signature_documents_sent_at_check;
ALTER TABLE public.signature_documents ADD CONSTRAINT signature_documents_sent_at_check CHECK (
  status IN ('draft','voided','archived') OR sent_at IS NOT NULL
);
ALTER TABLE public.signature_documents DROP CONSTRAINT signature_documents_send_governance_check;
ALTER TABLE public.signature_documents ADD CONSTRAINT signature_documents_send_governance_check CHECK (
  status IN ('draft','archived') OR (document_type_approval_id IS NOT NULL AND consent_version_id IS NOT NULL)
);
ALTER TABLE public.signature_documents DROP CONSTRAINT signature_documents_sent_privacy_disclosure_check;
ALTER TABLE public.signature_documents ADD CONSTRAINT signature_documents_sent_privacy_disclosure_check CHECK (
  status IN ('draft','archived') OR privacy_disclosure_version IS NOT NULL
);
ALTER TABLE public.signature_documents DROP CONSTRAINT signature_documents_sent_privacy_disclosure_text_check;
ALTER TABLE public.signature_documents ADD CONSTRAINT signature_documents_sent_privacy_disclosure_text_check CHECK (
  status IN ('draft','archived') OR (privacy_disclosure_es_pr_text IS NOT NULL AND privacy_disclosure_en_us_text IS NOT NULL)
);
ALTER TABLE public.signature_document_versions
  ADD COLUMN source_deleted_at timestamptz NULL;

ALTER TABLE public.signature_governance_events DROP CONSTRAINT signature_governance_events_entity_check;
ALTER TABLE public.signature_governance_events ADD CONSTRAINT signature_governance_events_entity_check CHECK (
  entity_type IN ('document_classification','consent_version','privacy_disclosure','retention_policy','launch_authorization','legal_hold','signing_draft')
);
ALTER TABLE public.signature_governance_events DROP CONSTRAINT signature_governance_events_action_check;
ALTER TABLE public.signature_governance_events ADD CONSTRAINT signature_governance_events_action_check CHECK (
  action IN ('created','submitted','approved','activated','retired','restricted','authorized','revoked','placed','released','archived','deleted')
);

CREATE OR REPLACE FUNCTION public.signature_enforce_document_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN allowed := true;
  ELSIF OLD.status = 'draft' AND NEW.status IN ('sent','archived') THEN allowed := true;
  ELSIF OLD.status = 'sent' AND NEW.status IN ('viewed','partially_signed','completed') THEN allowed := true;
  ELSIF OLD.status = 'viewed' AND NEW.status IN ('partially_signed','completed') THEN allowed := true;
  ELSIF OLD.status = 'partially_signed' AND NEW.status = 'completed' THEN allowed := true;
  ELSIF OLD.status NOT IN ('completed','voided','archived') AND NEW.status = 'voided' THEN allowed := true;
  ELSIF OLD.status IN ('sent','viewed','partially_signed') AND NEW.status = 'expired' THEN allowed := true;
  END IF;
  IF NOT allowed THEN RAISE EXCEPTION 'illegal signature document state transition: % -> %', OLD.status, NEW.status; END IF;
  IF OLD.status='archived' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'archived signature draft evidence is immutable'; END IF;
  IF OLD.status='draft' AND NEW.status='sent' AND (
    NEW.active_version_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.signature_document_versions v WHERE v.id=NEW.active_version_id AND v.document_id=NEW.id AND v.locked_at IS NOT NULL AND v.field_definition_sha256 IS NOT NULL)
    OR NOT EXISTS (SELECT 1 FROM public.signature_participants p WHERE p.document_version_id=NEW.active_version_id)
    OR NOT EXISTS (SELECT 1 FROM public.signature_fields f WHERE f.document_version_id=NEW.active_version_id)
    OR EXISTS (SELECT 1 FROM public.signature_participants p WHERE p.document_version_id=NEW.active_version_id AND NOT EXISTS (SELECT 1 FROM public.signature_fields f WHERE f.document_version_id=NEW.active_version_id AND f.participant_id=p.id AND f.required))
  ) THEN RAISE EXCEPTION 'signature send requires a locked version and required fields for every participant'; END IF;
  IF NEW.status='completed' AND OLD.status<>'completed' AND (
    NOT EXISTS (SELECT 1 FROM public.signature_document_versions v WHERE v.id=NEW.active_version_id AND v.finalized_at IS NOT NULL)
    OR NOT EXISTS (SELECT 1 FROM public.signature_participants p WHERE p.document_version_id=NEW.active_version_id)
    OR EXISTS (SELECT 1 FROM public.signature_participants p WHERE p.document_version_id=NEW.active_version_id AND p.status<>'completed')
  ) THEN RAISE EXCEPTION 'signature completion requires a finalized version and completed participants'; END IF;
  IF OLD.status NOT IN ('draft') AND NEW.active_version_id IS DISTINCT FROM OLD.active_version_id THEN RAISE EXCEPTION 'active signature version is immutable after send'; END IF;
  IF OLD.status NOT IN ('draft') AND (
    NEW.canonical_lead_id IS DISTINCT FROM OLD.canonical_lead_id OR NEW.lead_group_id IS DISTINCT FROM OLD.lead_group_id
    OR NEW.title IS DISTINCT FROM OLD.title OR NEW.document_type IS DISTINCT FROM OLD.document_type
    OR NEW.document_type_approval_reference IS DISTINCT FROM OLD.document_type_approval_reference
    OR NEW.created_by_admin_id IS DISTINCT FROM OLD.created_by_admin_id OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    OR NEW.sent_at IS DISTINCT FROM OLD.sent_at OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN RAISE EXCEPTION 'sent signature document identity is immutable'; END IF;
  IF OLD.completed_at IS NOT NULL AND NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN RAISE EXCEPTION 'signature document completion timestamp is immutable'; END IF;
  IF OLD.voided_at IS NOT NULL AND (NEW.voided_at IS DISTINCT FROM OLD.voided_at OR NEW.void_reason IS DISTINCT FROM OLD.void_reason) THEN RAISE EXCEPTION 'signature document void evidence is immutable'; END IF;
  NEW.row_version := OLD.row_version + 1; NEW.updated_at := now(); RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.signature_enforce_approval_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('approved','restricted','revoked','retired') THEN
    IF OLD.status='approved' AND NEW.status IN ('revoked','retired')
       AND NEW.document_type=OLD.document_type AND NEW.version_number=OLD.version_number
       AND NEW.display_name IS NOT DISTINCT FROM OLD.display_name AND NEW.description IS NOT DISTINCT FROM OLD.description
       AND NEW.permitted_signing_use IS NOT DISTINCT FROM OLD.permitted_signing_use
       AND NEW.approval_mode=OLD.approval_mode AND NEW.approval_snapshot_sha256=OLD.approval_snapshot_sha256
       AND NEW.approval_reference=OLD.approval_reference AND NEW.approval_date=OLD.approval_date
       AND NEW.reviewed_by IS NOT DISTINCT FROM OLD.reviewed_by AND NEW.source_reference IS NOT DISTINCT FROM OLD.source_reference
       AND NEW.effective_from=OLD.effective_from AND NEW.approved_at=OLD.approved_at
       AND NEW.approved_by_admin_id=OLD.approved_by_admin_id AND NEW.approver_role=OLD.approver_role
       AND NEW.entered_by_admin_id=OLD.entered_by_admin_id AND NEW.created_by_admin_id=OLD.created_by_admin_id
       AND NEW.counsel_name IS NOT DISTINCT FROM OLD.counsel_name AND NEW.counsel_law_firm IS NOT DISTINCT FROM OLD.counsel_law_firm
       AND NEW.external_reviewer_role IS NOT DISTINCT FROM OLD.external_reviewer_role
       AND NEW.legacy_imported=OLD.legacy_imported AND NEW.phase2m_legacy=OLD.phase2m_legacy AND NEW.created_at=OLD.created_at
       AND (NEW.status<>'revoked' OR NEW.revoked_at IS NOT NULL) AND (NEW.status<>'retired' OR NEW.retired_at IS NOT NULL)
    THEN RETURN NEW; END IF;
    IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'approved signature document classification is immutable'; END IF;
  END IF;
  IF OLD.status='draft' AND NEW.status NOT IN ('draft','pending') THEN RAISE EXCEPTION 'signature classification transition rejected'; END IF;
  IF OLD.status='pending' AND NEW.status NOT IN ('pending','approved','restricted') THEN RAISE EXCEPTION 'signature classification transition rejected'; END IF;
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
       AND NEW.approval_mode=OLD.approval_mode AND NEW.approver_role=OLD.approver_role
       AND NEW.approved_at=OLD.approved_at AND NEW.approved_by_admin_id=OLD.approved_by_admin_id
       AND NEW.external_reviewer_name IS NOT DISTINCT FROM OLD.external_reviewer_name
       AND NEW.external_reviewer_reference IS NOT DISTINCT FROM OLD.external_reviewer_reference
       AND NEW.created_by_admin_id=OLD.created_by_admin_id AND NEW.created_at=OLD.created_at
       AND NEW.legacy_imported=OLD.legacy_imported AND NEW.phase2m_legacy=OLD.phase2m_legacy
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
         AND NEW.version_identifier=OLD.version_identifier AND NEW.es_pr_text=OLD.es_pr_text AND NEW.en_us_text=OLD.en_us_text
         AND NEW.es_pr_sha256=OLD.es_pr_sha256 AND NEW.en_us_sha256=OLD.en_us_sha256
         AND NEW.approval_reference=OLD.approval_reference AND NEW.effective_from=OLD.effective_from
         AND NEW.approval_mode=OLD.approval_mode AND NEW.approver_role=OLD.approver_role
         AND NEW.approved_at=OLD.approved_at AND NEW.approved_by_admin_id=OLD.approved_by_admin_id
         AND NEW.external_reviewer_name IS NOT DISTINCT FROM OLD.external_reviewer_name
         AND NEW.external_reviewer_reference IS NOT DISTINCT FROM OLD.external_reviewer_reference
         AND NEW.created_by_admin_id=OLD.created_by_admin_id AND NEW.created_at=OLD.created_at AND NEW.legacy_imported=OLD.legacy_imported AND NEW.phase2m_legacy=OLD.phase2m_legacy
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
         AND NEW.approval_mode=OLD.approval_mode AND NEW.approver_role=OLD.approver_role
         AND NEW.source_pdf_days=OLD.source_pdf_days AND NEW.completed_pdf_days IS NOT DISTINCT FROM OLD.completed_pdf_days
         AND NEW.certificate_days IS NOT DISTINCT FROM OLD.certificate_days AND NEW.evidence_manifest_days IS NOT DISTINCT FROM OLD.evidence_manifest_days
         AND NEW.token_days=OLD.token_days AND NEW.session_hours=OLD.session_hours AND NEW.network_evidence_days=OLD.network_evidence_days
         AND NEW.failed_cancelled_draft_days=OLD.failed_cancelled_draft_days AND NEW.audit_event_days IS NOT DISTINCT FROM OLD.audit_event_days
         AND NEW.completed_cleanup_enabled=OLD.completed_cleanup_enabled AND NEW.approved_at=OLD.approved_at
         AND NEW.approved_by_admin_id=OLD.approved_by_admin_id
         AND NEW.external_reviewer_name IS NOT DISTINCT FROM OLD.external_reviewer_name
         AND NEW.external_reviewer_reference IS NOT DISTINCT FROM OLD.external_reviewer_reference
         AND NEW.created_by_admin_id=OLD.created_by_admin_id AND NEW.created_at=OLD.created_at AND NEW.legacy_imported=OLD.legacy_imported AND NEW.phase2m_legacy=OLD.phase2m_legacy
      THEN RETURN NEW; END IF;
      IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'approved signature retention policy is immutable'; END IF;
    END IF;
    IF OLD.status='draft' AND NEW.status NOT IN ('draft','pending_review') THEN RAISE EXCEPTION 'signature retention transition rejected'; END IF;
    IF OLD.status='pending_review' AND NEW.status NOT IN ('pending_review','approved') THEN RAISE EXCEPTION 'signature retention transition rejected'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.signature_enforce_version_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.finalized_at IS NOT NULL THEN RAISE EXCEPTION 'finalized signature document versions are immutable'; END IF;
  IF OLD.source_deleted_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'deleted signature draft version evidence is immutable'; END IF;
  IF OLD.locked_at IS NOT NULL AND (
    NEW.document_id IS DISTINCT FROM OLD.document_id OR NEW.version_number IS DISTINCT FROM OLD.version_number
    OR NEW.source_r2_key IS DISTINCT FROM OLD.source_r2_key OR NEW.filename_snapshot IS DISTINCT FROM OLD.filename_snapshot
    OR NEW.mime_type IS DISTINCT FROM OLD.mime_type OR NEW.byte_count IS DISTINCT FROM OLD.byte_count
    OR NEW.page_count IS DISTINCT FROM OLD.page_count OR NEW.source_sha256 IS DISTINCT FROM OLD.source_sha256
    OR NEW.page_geometry_manifest IS DISTINCT FROM OLD.page_geometry_manifest
    OR NEW.field_definition_sha256 IS DISTINCT FROM OLD.field_definition_sha256 OR NEW.locked_at IS DISTINCT FROM OLD.locked_at
    OR NEW.source_deleted_at IS DISTINCT FROM OLD.source_deleted_at OR NEW.created_by_admin_id IS DISTINCT FROM OLD.created_by_admin_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN RAISE EXCEPTION 'sent signature document version definitions are immutable'; END IF;
  NEW.updated_at := now(); RETURN NEW;
END;
$$;

COMMIT;
