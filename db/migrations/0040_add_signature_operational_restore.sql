BEGIN;

ALTER TABLE public.signature_documents
  ADD COLUMN operationally_restored_at timestamptz NULL,
  ADD COLUMN operationally_restored_by_admin_id uuid NULL
    REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  ADD COLUMN operationally_restore_reason text NULL,
  ADD CONSTRAINT signature_documents_operational_restore_check CHECK (
    (operationally_restored_at IS NULL
      AND operationally_restored_by_admin_id IS NULL
      AND operationally_restore_reason IS NULL)
    OR
    (operationally_hidden_at IS NOT NULL
      AND operationally_restored_at IS NOT NULL
      AND operationally_restored_at >= operationally_hidden_at
      AND operationally_restored_by_admin_id IS NOT NULL
      AND char_length(btrim(operationally_restore_reason)) BETWEEN 1 AND 500)
  );

CREATE INDEX signature_documents_operational_restored_idx
  ON public.signature_documents (operationally_restored_at, operationally_hidden_at, updated_at DESC);

ALTER TABLE public.signature_governance_events
  DROP CONSTRAINT signature_governance_events_action_check;
ALTER TABLE public.signature_governance_events
  ADD CONSTRAINT signature_governance_events_action_check CHECK (
    action IN ('created','submitted','approved','activated','retired','restricted','authorized','revoked',
      'placed','released','archived','deleted','workflow_hidden','workflow_restored','recipient_removed',
      'updated','duplicated','corrected')
  );

CREATE OR REPLACE FUNCTION public.signature_enforce_operational_restore_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.operationally_restored_at IS NOT NULL AND (
    NEW.operationally_restored_at IS DISTINCT FROM OLD.operationally_restored_at
    OR NEW.operationally_restored_by_admin_id IS DISTINCT FROM OLD.operationally_restored_by_admin_id
    OR NEW.operationally_restore_reason IS DISTINCT FROM OLD.operationally_restore_reason
  ) THEN
    RAISE EXCEPTION 'signature operational restoration evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER signature_documents_operational_restore_immutable_trigger
BEFORE UPDATE ON public.signature_documents
FOR EACH ROW EXECUTE FUNCTION public.signature_enforce_operational_restore_immutability();

COMMIT;
