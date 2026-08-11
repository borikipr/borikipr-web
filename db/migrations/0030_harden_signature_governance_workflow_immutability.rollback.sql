BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.signature_document_type_approvals WHERE status='retired')
  THEN RAISE EXCEPTION '0030 rollback blocked: retired classification evidence requires preservation'; END IF;
END $$;
ALTER TABLE public.signature_document_type_approvals DROP CONSTRAINT signature_type_approvals_retired_check, DROP COLUMN retired_at;
CREATE OR REPLACE FUNCTION public.signature_enforce_approval_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('approved','restricted','revoked','retired') THEN
    IF OLD.status='approved' AND NEW.status IN ('revoked','retired')
       AND NEW.document_type=OLD.document_type AND NEW.version_number=OLD.version_number
       AND NEW.approval_reference=OLD.approval_reference AND NEW.approval_date=OLD.approval_date
       AND NEW.reviewed_by=OLD.reviewed_by AND NEW.source_reference=OLD.source_reference
       AND NEW.effective_from=OLD.effective_from AND NEW.approved_at=OLD.approved_at
       AND NEW.entered_by_admin_id=OLD.entered_by_admin_id AND NEW.counsel_name=OLD.counsel_name
       AND NEW.counsel_law_firm=OLD.counsel_law_firm
    THEN RETURN NEW; END IF;
    IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'signature counsel approval evidence is immutable'; END IF;
  END IF;
  IF OLD.status='draft' AND NEW.status NOT IN ('draft','pending') THEN RAISE EXCEPTION 'signature counsel approval transition rejected'; END IF;
  IF OLD.status='pending' AND NEW.status NOT IN ('pending','approved','restricted') THEN RAISE EXCEPTION 'signature counsel approval transition rejected'; END IF;
  RETURN NEW;
END;
$$;
COMMIT;
