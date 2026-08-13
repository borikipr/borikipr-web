BEGIN;

ALTER TABLE public.signature_documents
  ADD COLUMN operationally_hidden_at timestamptz NULL,
  ADD COLUMN operationally_hidden_by_admin_id uuid NULL
    REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  ADD COLUMN operationally_hidden_reason text NULL,
  ADD CONSTRAINT signature_documents_operational_hide_check CHECK (
    (operationally_hidden_at IS NULL
      AND operationally_hidden_by_admin_id IS NULL
      AND operationally_hidden_reason IS NULL)
    OR
    (operationally_hidden_at IS NOT NULL
      AND operationally_hidden_by_admin_id IS NOT NULL
      AND char_length(btrim(operationally_hidden_reason)) BETWEEN 1 AND 500)
  );

CREATE INDEX signature_documents_operational_visibility_idx
  ON public.signature_documents (operationally_hidden_at, status, updated_at DESC);

ALTER TABLE public.signature_participants
  ADD COLUMN removed_at timestamptz NULL,
  ADD COLUMN removed_by_admin_id uuid NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  ADD COLUMN removal_reason text NULL,
  ADD CONSTRAINT signature_participants_draft_removal_check CHECK (
    (removed_at IS NULL AND removed_by_admin_id IS NULL AND removal_reason IS NULL)
    OR (removed_at IS NOT NULL AND removed_by_admin_id IS NOT NULL
      AND char_length(btrim(removal_reason)) BETWEEN 1 AND 500)
  );
ALTER TABLE public.signature_participants
  DROP CONSTRAINT signature_participants_version_email_unique;
CREATE UNIQUE INDEX signature_participants_active_version_email_unique
  ON public.signature_participants (document_version_id, normalized_email)
  WHERE removed_at IS NULL;

ALTER TABLE public.signature_governance_events
  DROP CONSTRAINT signature_governance_events_entity_check;
ALTER TABLE public.signature_governance_events
  ADD CONSTRAINT signature_governance_events_entity_check CHECK (
    entity_type IN ('document_classification','consent_version','privacy_disclosure','retention_policy',
      'launch_authorization','legal_hold','signing_draft','signing_request','risk_acceptance','readiness_snapshot')
  );

ALTER TABLE public.signature_governance_events
  DROP CONSTRAINT signature_governance_events_action_check;
ALTER TABLE public.signature_governance_events
  ADD CONSTRAINT signature_governance_events_action_check CHECK (
    action IN ('created','submitted','approved','activated','retired','restricted','authorized','revoked',
      'placed','released','archived','deleted','workflow_hidden','recipient_removed')
  );

CREATE OR REPLACE FUNCTION public.signature_enforce_operational_hide_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.operationally_hidden_at IS NOT NULL AND (
    NEW.operationally_hidden_at IS DISTINCT FROM OLD.operationally_hidden_at
    OR NEW.operationally_hidden_by_admin_id IS DISTINCT FROM OLD.operationally_hidden_by_admin_id
    OR NEW.operationally_hidden_reason IS DISTINCT FROM OLD.operationally_hidden_reason
  ) THEN
    RAISE EXCEPTION 'signature operational removal evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER signature_documents_operational_hide_immutable_trigger
BEFORE UPDATE ON public.signature_documents
FOR EACH ROW EXECUTE FUNCTION public.signature_enforce_operational_hide_immutability();

CREATE OR REPLACE FUNCTION public.signature_enforce_removed_participant_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.removed_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'removed signature participant evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER signature_participants_removed_immutable_trigger
BEFORE UPDATE ON public.signature_participants
FOR EACH ROW EXECUTE FUNCTION public.signature_enforce_removed_participant_immutability();

CREATE OR REPLACE FUNCTION public.signature_enforce_participant_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM public.signature_document_versions WHERE id=NEW.document_version_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.signature_document_versions WHERE id=NEW.document_version_id AND locked_at IS NOT NULL)
    THEN RAISE EXCEPTION 'cannot add a participant to a locked signature version'; END IF;
  IF (SELECT count(*) FROM public.signature_participants WHERE document_version_id=NEW.document_version_id AND removed_at IS NULL) >= 8
    THEN RAISE EXCEPTION 'signature participant limit exceeded'; END IF;
  RETURN NEW;
END;
$$;

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
    OR NOT EXISTS (SELECT 1 FROM public.signature_participants p WHERE p.document_version_id=NEW.active_version_id AND p.removed_at IS NULL)
    OR NOT EXISTS (SELECT 1 FROM public.signature_fields f WHERE f.document_version_id=NEW.active_version_id)
    OR EXISTS (SELECT 1 FROM public.signature_participants p WHERE p.document_version_id=NEW.active_version_id AND p.removed_at IS NULL AND NOT EXISTS (SELECT 1 FROM public.signature_fields f WHERE f.document_version_id=NEW.active_version_id AND f.participant_id=p.id AND f.required))
  ) THEN RAISE EXCEPTION 'signature send requires a locked version and required fields for every participant'; END IF;
  IF NEW.status='completed' AND OLD.status<>'completed' AND (
    NOT EXISTS (SELECT 1 FROM public.signature_document_versions v WHERE v.id=NEW.active_version_id AND v.finalized_at IS NOT NULL)
    OR NOT EXISTS (SELECT 1 FROM public.signature_participants p WHERE p.document_version_id=NEW.active_version_id AND p.removed_at IS NULL)
    OR EXISTS (SELECT 1 FROM public.signature_participants p WHERE p.document_version_id=NEW.active_version_id AND p.removed_at IS NULL AND p.status<>'completed')
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

COMMIT;
