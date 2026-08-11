BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.signature_privacy_disclosure_versions LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.signature_retention_policy_versions LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.signature_launch_authorizations LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.signature_governance_events LIMIT 1)
  THEN RAISE EXCEPTION '0027 rollback refused: signing governance evidence exists'; END IF;
END $$;
DROP TABLE public.signature_governance_events;
DROP TABLE public.signature_launch_authorizations;
DROP TABLE public.signature_retention_policy_versions;
DROP TABLE public.signature_privacy_disclosure_versions;
DROP FUNCTION public.signature_governance_events_immutable();
DROP FUNCTION public.signature_governance_version_immutability();
COMMIT;
