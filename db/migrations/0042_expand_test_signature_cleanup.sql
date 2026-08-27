BEGIN;

-- Historical local-development requests predate the canary authorization model.
-- They remain eligible only when the service independently verifies that they
-- have no business linkage, active access, hold, or protected dependency.
ALTER TABLE public.signature_test_cleanup_events
  ALTER COLUMN internal_canary_authorization_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.signature_enforce_template_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  source_document_id uuid;
BEGIN
  IF TG_OP='DELETE' THEN
    SELECT document_id INTO source_document_id
      FROM public.signature_document_versions WHERE id=OLD.source_document_version_id;
    IF source_document_id IS NOT NULL
      AND public.signature_test_cleanup_permitted(source_document_id) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'signature templates must be archived, not deleted';
  END IF;
  IF OLD.status='active' AND NEW.status='archived'
    AND NEW.id=OLD.id AND NEW.name=OLD.name AND NEW.description IS NOT DISTINCT FROM OLD.description
    AND NEW.document_type=OLD.document_type AND NEW.source_document_version_id=OLD.source_document_version_id
    AND NEW.locale=OLD.locale AND NEW.routing_mode=OLD.routing_mode
    AND NEW.requires_broker_signature=OLD.requires_broker_signature
    AND NEW.role_blueprint=OLD.role_blueprint AND NEW.field_blueprint=OLD.field_blueprint
    AND NEW.snapshot_sha256=OLD.snapshot_sha256 AND NEW.created_by_admin_id=OLD.created_by_admin_id
    AND NEW.created_at=OLD.created_at AND NEW.archived_at IS NOT NULL
    AND NEW.archived_by_admin_id IS NOT NULL AND NEW.archive_reason IS NOT NULL THEN RETURN NEW;
  END IF;
  RAISE EXCEPTION 'signature template snapshots are immutable';
END;
$$;

COMMIT;
