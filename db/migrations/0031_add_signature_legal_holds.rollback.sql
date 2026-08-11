BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.signature_legal_holds LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.signature_governance_events WHERE entity_type='legal_hold' LIMIT 1)
  THEN RAISE EXCEPTION '0031 rollback blocked: signature legal hold evidence exists'; END IF;
END $$;
ALTER TABLE public.signature_governance_events DROP CONSTRAINT signature_governance_events_entity_check;
ALTER TABLE public.signature_governance_events ADD CONSTRAINT signature_governance_events_entity_check
  CHECK (entity_type IN ('document_classification','consent_version','privacy_disclosure','retention_policy','launch_authorization'));
ALTER TABLE public.signature_governance_events DROP CONSTRAINT signature_governance_events_action_check;
ALTER TABLE public.signature_governance_events ADD CONSTRAINT signature_governance_events_action_check
  CHECK (action IN ('created','submitted','approved','activated','retired','restricted','authorized','revoked'));
DROP TRIGGER signature_legal_holds_immutable_trigger ON public.signature_legal_holds;
DROP FUNCTION public.signature_legal_hold_immutability();
DROP TABLE public.signature_legal_holds;
COMMIT;
