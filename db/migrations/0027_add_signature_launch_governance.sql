BEGIN;

CREATE TABLE public.signature_privacy_disclosure_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_identifier text NOT NULL UNIQUE,
  es_pr_text text NOT NULL,
  en_us_text text NOT NULL,
  es_pr_sha256 text NOT NULL,
  en_us_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  approval_reference text NULL,
  effective_from timestamptz NULL,
  approved_at timestamptz NULL,
  retired_at timestamptz NULL,
  created_by_admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  approved_by_admin_id uuid NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_privacy_versions_identifier_check CHECK (version_identifier ~ '^[a-z0-9][a-z0-9._-]{0,99}$'),
  CONSTRAINT signature_privacy_versions_text_check CHECK (char_length(es_pr_text) BETWEEN 20 AND 10000 AND char_length(en_us_text) BETWEEN 20 AND 10000),
  CONSTRAINT signature_privacy_versions_hash_check CHECK (es_pr_sha256 ~ '^[0-9a-f]{64}$' AND en_us_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT signature_privacy_versions_status_check CHECK (status IN ('draft','approved','retired')),
  CONSTRAINT signature_privacy_versions_approval_check CHECK (status <> 'approved' OR (approval_reference IS NOT NULL AND effective_from IS NOT NULL AND approved_at IS NOT NULL AND approved_by_admin_id IS NOT NULL)),
  CONSTRAINT signature_privacy_versions_retired_check CHECK (status <> 'retired' OR retired_at IS NOT NULL)
);
CREATE UNIQUE INDEX signature_privacy_versions_active_unique ON public.signature_privacy_disclosure_versions ((true)) WHERE status='approved';

CREATE TABLE public.signature_retention_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_identifier text NOT NULL UNIQUE,
  approval_reference text NULL,
  privacy_reference text NULL,
  source_pdf_days integer NOT NULL,
  completed_pdf_days integer NULL,
  certificate_days integer NULL,
  evidence_manifest_days integer NULL,
  token_days integer NOT NULL,
  session_hours integer NOT NULL,
  network_evidence_days integer NOT NULL,
  failed_cancelled_draft_days integer NOT NULL,
  audit_event_days integer NULL,
  completed_cleanup_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  activated_at timestamptz NULL,
  retired_at timestamptz NULL,
  created_by_admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  activated_by_admin_id uuid NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_retention_versions_identifier_check CHECK (version_identifier ~ '^[a-z0-9][a-z0-9._-]{0,99}$'),
  CONSTRAINT signature_retention_versions_status_check CHECK (status IN ('draft','active','retired')),
  CONSTRAINT signature_retention_versions_ranges_check CHECK (source_pdf_days BETWEEN 1 AND 36500 AND token_days BETWEEN 1 AND 365 AND session_hours BETWEEN 1 AND 168 AND network_evidence_days BETWEEN 1 AND 3650 AND failed_cancelled_draft_days BETWEEN 1 AND 3650 AND (completed_pdf_days IS NULL OR completed_pdf_days BETWEEN 1 AND 36500) AND (certificate_days IS NULL OR certificate_days BETWEEN 1 AND 36500) AND (evidence_manifest_days IS NULL OR evidence_manifest_days BETWEEN 1 AND 36500) AND (audit_event_days IS NULL OR audit_event_days BETWEEN 1 AND 36500)),
  CONSTRAINT signature_retention_versions_cleanup_check CHECK (NOT completed_cleanup_enabled OR (completed_pdf_days IS NOT NULL AND certificate_days IS NOT NULL AND evidence_manifest_days IS NOT NULL AND audit_event_days IS NOT NULL)),
  CONSTRAINT signature_retention_versions_active_check CHECK (status <> 'active' OR (approval_reference IS NOT NULL AND privacy_reference IS NOT NULL AND activated_at IS NOT NULL AND activated_by_admin_id IS NOT NULL)),
  CONSTRAINT signature_retention_versions_retired_check CHECK (status <> 'retired' OR retired_at IS NOT NULL)
);
CREATE UNIQUE INDEX signature_retention_versions_active_unique ON public.signature_retention_policy_versions ((true)) WHERE status='active';

CREATE TABLE public.signature_launch_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL,
  authorization_type text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  readiness_snapshot_sha256 text NOT NULL,
  notes text NULL,
  explicit_confirmation boolean NOT NULL,
  authorized_by_admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  authorized_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NULL,
  revoked_at timestamptz NULL,
  CONSTRAINT signature_launch_auth_environment_check CHECK (environment IN ('isolated','preview','production')),
  CONSTRAINT signature_launch_auth_type_check CHECK (authorization_type IN ('internal_canary','production_public_launch')),
  CONSTRAINT signature_launch_auth_status_check CHECK (status IN ('active','revoked','expired')),
  CONSTRAINT signature_launch_auth_hash_check CHECK (readiness_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT signature_launch_auth_confirmation_check CHECK (explicit_confirmation),
  CONSTRAINT signature_launch_auth_expiry_check CHECK (authorization_type <> 'internal_canary' OR expires_at IS NOT NULL),
  CONSTRAINT signature_launch_auth_revoked_check CHECK (status <> 'revoked' OR revoked_at IS NOT NULL)
);
CREATE UNIQUE INDEX signature_launch_auth_active_unique ON public.signature_launch_authorizations (environment, authorization_type) WHERE status='active';

CREATE TABLE public.signature_governance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  actor_admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  snapshot_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_governance_events_entity_check CHECK (entity_type IN ('privacy_disclosure','retention_policy','launch_authorization')),
  CONSTRAINT signature_governance_events_action_check CHECK (action IN ('created','approved','activated','retired','authorized','revoked')),
  CONSTRAINT signature_governance_events_hash_check CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$')
);
CREATE INDEX signature_governance_events_entity_idx ON public.signature_governance_events (entity_type, entity_id, created_at);

CREATE OR REPLACE FUNCTION public.signature_governance_version_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='signature_privacy_disclosure_versions' AND OLD.status IN ('approved','retired') AND NEW IS DISTINCT FROM OLD THEN
    IF OLD.status='approved' AND NEW.status='retired' AND NEW.retired_at IS NOT NULL THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'approved signature privacy disclosure is immutable';
  END IF;
  IF TG_TABLE_NAME='signature_retention_policy_versions' AND OLD.status IN ('active','retired') AND NEW IS DISTINCT FROM OLD THEN
    IF OLD.status='active' AND NEW.status='retired' AND NEW.retired_at IS NOT NULL THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'active signature retention policy is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER signature_privacy_versions_immutable_trigger BEFORE UPDATE ON public.signature_privacy_disclosure_versions FOR EACH ROW EXECUTE FUNCTION public.signature_governance_version_immutability();
CREATE TRIGGER signature_retention_versions_immutable_trigger BEFORE UPDATE ON public.signature_retention_policy_versions FOR EACH ROW EXECUTE FUNCTION public.signature_governance_version_immutability();

CREATE OR REPLACE FUNCTION public.signature_governance_events_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'signature governance events are immutable'; END; $$;
CREATE TRIGGER signature_governance_events_immutable_trigger BEFORE UPDATE OR DELETE ON public.signature_governance_events FOR EACH ROW EXECUTE FUNCTION public.signature_governance_events_immutable();

COMMIT;
