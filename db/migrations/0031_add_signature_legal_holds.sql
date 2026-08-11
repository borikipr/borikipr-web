BEGIN;

CREATE TABLE public.signature_legal_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL,
  document_id uuid NULL REFERENCES public.signature_documents(id) ON DELETE RESTRICT,
  document_version_id uuid NULL REFERENCES public.signature_document_versions(id) ON DELETE RESTRICT,
  evidence_classes text[] NOT NULL DEFAULT ARRAY[]::text[],
  reason_reference text NOT NULL,
  external_legal_reference text NULL,
  status text NOT NULL DEFAULT 'active',
  created_by_admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz NULL,
  released_by_admin_id uuid NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  release_reference text NULL,
  CONSTRAINT signature_legal_holds_scope_check CHECK (scope_type IN ('document','document_version','evidence_class')),
  CONSTRAINT signature_legal_holds_target_check CHECK (
    (scope_type='document' AND document_id IS NOT NULL AND document_version_id IS NULL)
    OR (scope_type='document_version' AND document_id IS NULL AND document_version_id IS NOT NULL)
    OR (scope_type='evidence_class' AND document_id IS NULL AND document_version_id IS NULL AND cardinality(evidence_classes)>0)
  ),
  CONSTRAINT signature_legal_holds_evidence_check CHECK (
    evidence_classes <@ ARRAY['source_pdf','completed_pdf','certificate','evidence_manifest','token','session','network_evidence','failed_cancelled_draft','audit_event']::text[]
  ),
  CONSTRAINT signature_legal_holds_reason_check CHECK (char_length(btrim(reason_reference)) BETWEEN 1 AND 500),
  CONSTRAINT signature_legal_holds_external_check CHECK (external_legal_reference IS NULL OR char_length(btrim(external_legal_reference)) BETWEEN 1 AND 500),
  CONSTRAINT signature_legal_holds_status_check CHECK (status IN ('active','released')),
  CONSTRAINT signature_legal_holds_release_check CHECK (
    (status='active' AND released_at IS NULL AND released_by_admin_id IS NULL AND release_reference IS NULL)
    OR (status='released' AND released_at IS NOT NULL AND released_by_admin_id IS NOT NULL AND char_length(btrim(release_reference)) BETWEEN 1 AND 500)
  )
);

CREATE INDEX signature_legal_holds_active_document_idx ON public.signature_legal_holds(document_id) WHERE status='active' AND document_id IS NOT NULL;
CREATE INDEX signature_legal_holds_active_version_idx ON public.signature_legal_holds(document_version_id) WHERE status='active' AND document_version_id IS NOT NULL;
CREATE INDEX signature_legal_holds_active_evidence_idx ON public.signature_legal_holds USING gin(evidence_classes) WHERE status='active';

CREATE OR REPLACE FUNCTION public.signature_legal_hold_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'signature legal hold evidence is immutable'; END IF;
  IF OLD.status='active' AND NEW.status='released'
    AND NEW.scope_type=OLD.scope_type
    AND NEW.document_id IS NOT DISTINCT FROM OLD.document_id
    AND NEW.document_version_id IS NOT DISTINCT FROM OLD.document_version_id
    AND NEW.evidence_classes=OLD.evidence_classes
    AND NEW.reason_reference=OLD.reason_reference
    AND NEW.external_legal_reference IS NOT DISTINCT FROM OLD.external_legal_reference
    AND NEW.created_by_admin_id=OLD.created_by_admin_id
    AND NEW.created_at=OLD.created_at
    AND NEW.released_at IS NOT NULL AND NEW.released_by_admin_id IS NOT NULL
    AND NEW.release_reference IS NOT NULL
  THEN RETURN NEW; END IF;
  IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'signature legal hold evidence is immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER signature_legal_holds_immutable_trigger
BEFORE UPDATE OR DELETE ON public.signature_legal_holds
FOR EACH ROW EXECUTE FUNCTION public.signature_legal_hold_immutability();

ALTER TABLE public.signature_governance_events DROP CONSTRAINT signature_governance_events_entity_check;
ALTER TABLE public.signature_governance_events ADD CONSTRAINT signature_governance_events_entity_check
  CHECK (entity_type IN ('document_classification','consent_version','privacy_disclosure','retention_policy','launch_authorization','legal_hold'));
ALTER TABLE public.signature_governance_events DROP CONSTRAINT signature_governance_events_action_check;
ALTER TABLE public.signature_governance_events ADD CONSTRAINT signature_governance_events_action_check
  CHECK (action IN ('created','submitted','approved','activated','retired','restricted','authorized','revoked','placed','released'));

COMMIT;
