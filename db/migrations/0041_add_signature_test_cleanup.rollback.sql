BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.signature_test_cleanup_events LIMIT 1) THEN
    RAISE EXCEPTION '0041 rollback blocked: immutable test cleanup evidence exists';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.signature_enforce_field_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_version_id uuid;
BEGIN
  target_version_id := CASE WHEN TG_OP='DELETE' THEN OLD.document_version_id ELSE NEW.document_version_id END;
  IF EXISTS (SELECT 1 FROM public.signature_document_versions WHERE id=target_version_id AND locked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'signature field definitions are immutable after send';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.signature_reject_field_value_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'submitted signature field values are immutable'; END; $$;
CREATE OR REPLACE FUNCTION public.signature_reject_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'signature events are append-only'; END; $$;

DROP FUNCTION public.signature_test_cleanup_permitted(uuid);
DROP TRIGGER signature_test_cleanup_events_immutable_trigger ON public.signature_test_cleanup_events;
DROP FUNCTION public.signature_test_cleanup_events_immutable();
DROP TABLE public.signature_test_cleanup_events;
ALTER TABLE public.signature_documents DROP CONSTRAINT signature_documents_active_version_fk;
ALTER TABLE public.signature_documents
  ADD CONSTRAINT signature_documents_active_version_fk
  FOREIGN KEY (id,active_version_id)
  REFERENCES public.signature_document_versions(document_id,id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
COMMIT;
