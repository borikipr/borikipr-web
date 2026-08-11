BEGIN;
DROP TRIGGER signature_launch_authorizations_immutable_trigger ON public.signature_launch_authorizations;
DROP FUNCTION public.signature_launch_authorization_immutability();
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
COMMIT;
