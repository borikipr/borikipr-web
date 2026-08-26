BEGIN;
DROP TRIGGER IF EXISTS signature_documents_operational_restore_immutable_trigger ON public.signature_documents;
DROP FUNCTION IF EXISTS public.signature_enforce_operational_restore_immutability();
DROP INDEX IF EXISTS public.signature_documents_operational_restored_idx;
ALTER TABLE public.signature_documents
  DROP CONSTRAINT IF EXISTS signature_documents_operational_restore_check,
  DROP COLUMN IF EXISTS operationally_restore_reason,
  DROP COLUMN IF EXISTS operationally_restored_by_admin_id,
  DROP COLUMN IF EXISTS operationally_restored_at;
ALTER TABLE public.signature_governance_events DROP CONSTRAINT signature_governance_events_action_check;
ALTER TABLE public.signature_governance_events ADD CONSTRAINT signature_governance_events_action_check CHECK (
  action IN ('created','submitted','approved','activated','retired','restricted','authorized','revoked',
    'placed','released','archived','deleted','workflow_hidden','recipient_removed',
    'updated','duplicated','corrected')
);
COMMIT;
