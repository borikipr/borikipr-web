BEGIN;

CREATE TABLE public.signature_risk_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_code text NOT NULL,
  authorization_scope text NOT NULL,
  residual_risk text NOT NULL,
  evidence_reference text NOT NULL,
  accepted_by_admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  explicit_confirmation boolean NOT NULL,
  confirmation_phrase_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_risk_code_check CHECK (risk_code IN ('neon_restore_unproven','r2_independent_recovery_unproven')),
  CONSTRAINT signature_risk_scope_check CHECK (authorization_scope IN ('internal_canary','production_public_launch')),
  CONSTRAINT signature_risk_description_check CHECK (char_length(btrim(residual_risk)) BETWEEN 20 AND 2000),
  CONSTRAINT signature_risk_evidence_check CHECK (char_length(btrim(evidence_reference)) BETWEEN 3 AND 500),
  CONSTRAINT signature_risk_expiry_check CHECK (expires_at > accepted_at AND expires_at <= accepted_at + interval '90 days'),
  CONSTRAINT signature_risk_confirmation_check CHECK (explicit_confirmation AND confirmation_phrase_sha256 ~ '^[0-9a-f]{64}$')
);
CREATE INDEX signature_risk_acceptances_lookup_idx
  ON public.signature_risk_acceptances (authorization_scope,risk_code,expires_at DESC);

CREATE TABLE public.signature_readiness_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL,
  authorization_type text NOT NULL,
  overall_status text NOT NULL,
  participant_emails text[] NOT NULL,
  document_types text[] NOT NULL,
  locales text[] NOT NULL,
  snapshot jsonb NOT NULL,
  snapshot_sha256 text NOT NULL,
  created_by_admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_readiness_environment_check CHECK (environment IN ('isolated','preview','production')),
  CONSTRAINT signature_readiness_type_check CHECK (authorization_type IN ('internal_canary','production_public_launch')),
  CONSTRAINT signature_readiness_status_check CHECK (overall_status IN ('pass','blocked')),
  CONSTRAINT signature_readiness_email_scope_check CHECK (cardinality(participant_emails) BETWEEN 1 AND 8),
  CONSTRAINT signature_readiness_document_scope_check CHECK (cardinality(document_types) BETWEEN 1 AND 20),
  CONSTRAINT signature_readiness_locale_scope_check CHECK (cardinality(locales) BETWEEN 1 AND 2 AND locales <@ ARRAY['es-PR','en-US']::text[]),
  CONSTRAINT signature_readiness_snapshot_check CHECK (jsonb_typeof(snapshot)='object' AND snapshot_sha256 ~ '^[0-9a-f]{64}$')
);
CREATE INDEX signature_readiness_snapshots_created_idx
  ON public.signature_readiness_snapshots (environment,authorization_type,created_at DESC);

ALTER TABLE public.signature_launch_authorizations
  ADD COLUMN readiness_snapshot_id uuid NULL REFERENCES public.signature_readiness_snapshots(id) ON DELETE RESTRICT,
  ADD COLUMN authorized_participant_emails text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN authorized_locales text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN phase2o_legacy boolean NOT NULL DEFAULT true;
ALTER TABLE public.signature_launch_authorizations ALTER COLUMN phase2o_legacy SET DEFAULT false;
ALTER TABLE public.signature_launch_authorizations
  ADD CONSTRAINT signature_launch_auth_phase2o_scope_check CHECK (
    phase2o_legacy OR environment <> 'production' OR authorization_type <> 'internal_canary' OR (
      readiness_snapshot_id IS NOT NULL
      AND cardinality(authorized_participant_emails) BETWEEN 1 AND 8
      AND cardinality(authorized_document_types)=1
      AND cardinality(authorized_locales)=1
      AND authorized_locales <@ ARRAY['es-PR','en-US']::text[]
      AND expires_at IS NOT NULL
      AND expires_at > authorized_at
      AND expires_at <= authorized_at + interval '24 hours'
    )
  );

ALTER TABLE public.signature_governance_events DROP CONSTRAINT signature_governance_events_entity_check;
ALTER TABLE public.signature_governance_events ADD CONSTRAINT signature_governance_events_entity_check CHECK (
  entity_type IN ('document_classification','consent_version','privacy_disclosure','retention_policy',
    'launch_authorization','legal_hold','signing_draft','risk_acceptance','readiness_snapshot')
);

CREATE OR REPLACE FUNCTION public.signature_phase2o_immutable_record()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'signature phase 2O safety evidence is immutable';
END;
$$;
CREATE TRIGGER signature_risk_acceptances_immutable_trigger
  BEFORE UPDATE OR DELETE ON public.signature_risk_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.signature_phase2o_immutable_record();
CREATE TRIGGER signature_readiness_snapshots_immutable_trigger
  BEFORE UPDATE OR DELETE ON public.signature_readiness_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.signature_phase2o_immutable_record();

CREATE OR REPLACE FUNCTION public.signature_launch_authorization_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='active' AND NEW.status='revoked'
     AND NEW.revoked_at IS NOT NULL
     AND NEW.environment=OLD.environment AND NEW.authorization_type=OLD.authorization_type
     AND NEW.readiness_snapshot_sha256=OLD.readiness_snapshot_sha256
     AND NEW.readiness_snapshot_id IS NOT DISTINCT FROM OLD.readiness_snapshot_id
     AND NEW.authorized_participant_scope=OLD.authorized_participant_scope
     AND NEW.authorized_participant_emails=OLD.authorized_participant_emails
     AND NEW.authorized_document_types=OLD.authorized_document_types
     AND NEW.authorized_locales=OLD.authorized_locales
     AND NEW.expires_at IS NOT DISTINCT FROM OLD.expires_at
     AND NEW.notes IS NOT DISTINCT FROM OLD.notes
     AND NEW.explicit_confirmation=OLD.explicit_confirmation
     AND NEW.authorized_by_admin_id=OLD.authorized_by_admin_id
     AND NEW.authorized_at=OLD.authorized_at
     AND NEW.phase2o_legacy=OLD.phase2o_legacy
  THEN RETURN NEW; END IF;
  IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'signature launch authorization is immutable'; END IF;
  RETURN NEW;
END;
$$;

COMMIT;
