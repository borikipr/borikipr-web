BEGIN;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.signature_launch_authorizations WHERE phase2o_legacy=false)
     OR EXISTS (SELECT 1 FROM public.signature_readiness_snapshots)
     OR EXISTS (SELECT 1 FROM public.signature_risk_acceptances)
  THEN RAISE EXCEPTION 'rollback blocked: Phase 2O safety evidence exists'; END IF;
END $$;

ALTER TABLE public.signature_governance_events DROP CONSTRAINT signature_governance_events_entity_check;
ALTER TABLE public.signature_governance_events ADD CONSTRAINT signature_governance_events_entity_check CHECK (
  entity_type IN ('document_classification','consent_version','privacy_disclosure','retention_policy','launch_authorization','legal_hold','signing_draft')
);

ALTER TABLE public.signature_launch_authorizations
  DROP CONSTRAINT signature_launch_auth_phase2o_scope_check,
  DROP COLUMN phase2o_legacy,
  DROP COLUMN authorized_locales,
  DROP COLUMN authorized_participant_emails,
  DROP COLUMN readiness_snapshot_id;

CREATE OR REPLACE FUNCTION public.signature_launch_authorization_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='active' AND NEW.status='revoked' AND NEW.revoked_at IS NOT NULL
     AND NEW.environment=OLD.environment AND NEW.authorization_type=OLD.authorization_type
     AND NEW.readiness_snapshot_sha256=OLD.readiness_snapshot_sha256
     AND NEW.authorized_participant_scope=OLD.authorized_participant_scope
     AND NEW.authorized_document_types=OLD.authorized_document_types
     AND NEW.expires_at IS NOT DISTINCT FROM OLD.expires_at
     AND NEW.notes IS NOT DISTINCT FROM OLD.notes AND NEW.explicit_confirmation=OLD.explicit_confirmation
     AND NEW.authorized_by_admin_id=OLD.authorized_by_admin_id AND NEW.authorized_at=OLD.authorized_at
  THEN RETURN NEW; END IF;
  IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'signature launch authorization is immutable'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER signature_readiness_snapshots_immutable_trigger ON public.signature_readiness_snapshots;
DROP TRIGGER signature_risk_acceptances_immutable_trigger ON public.signature_risk_acceptances;
DROP FUNCTION public.signature_phase2o_immutable_record();
DROP TABLE public.signature_readiness_snapshots;
DROP TABLE public.signature_risk_acceptances;

COMMIT;
