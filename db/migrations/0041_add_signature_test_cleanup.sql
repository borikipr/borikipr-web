BEGIN;

ALTER TABLE public.signature_documents DROP CONSTRAINT signature_documents_active_version_fk;
ALTER TABLE public.signature_documents
  ADD CONSTRAINT signature_documents_active_version_fk
  FOREIGN KEY (id,active_version_id)
  REFERENCES public.signature_document_versions(document_id,id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.signature_test_cleanup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  document_version_id uuid NOT NULL,
  internal_canary_authorization_id uuid NOT NULL
    REFERENCES public.signature_launch_authorizations(id) ON DELETE RESTRICT,
  actor_admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  title_sha256 text NOT NULL,
  source_sha256 text NOT NULL,
  final_pdf_sha256 text NULL,
  certificate_sha256 text NULL,
  eligibility_snapshot_sha256 text NOT NULL,
  removed_row_counts jsonb NOT NULL,
  removed_artifact_count integer NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_test_cleanup_document_unique UNIQUE (document_id),
  CONSTRAINT signature_test_cleanup_reason_check CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  CONSTRAINT signature_test_cleanup_hashes_check CHECK (
    title_sha256 ~ '^[0-9a-f]{64}$'
    AND source_sha256 ~ '^[0-9a-f]{64}$'
    AND eligibility_snapshot_sha256 ~ '^[0-9a-f]{64}$'
    AND (final_pdf_sha256 IS NULL OR final_pdf_sha256 ~ '^[0-9a-f]{64}$')
    AND (certificate_sha256 IS NULL OR certificate_sha256 ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT signature_test_cleanup_counts_check CHECK (
    jsonb_typeof(removed_row_counts)='object'
    AND char_length(removed_row_counts::text)<=4000
    AND removed_artifact_count BETWEEN 1 AND 4
  )
);

CREATE INDEX signature_test_cleanup_events_deleted_idx
  ON public.signature_test_cleanup_events (deleted_at DESC);

CREATE FUNCTION public.signature_test_cleanup_events_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'signature test cleanup evidence is immutable';
END;
$$;

CREATE TRIGGER signature_test_cleanup_events_immutable_trigger
BEFORE UPDATE OR DELETE ON public.signature_test_cleanup_events
FOR EACH ROW EXECUTE FUNCTION public.signature_test_cleanup_events_immutable();

CREATE FUNCTION public.signature_test_cleanup_permitted(target_document_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.signature_test_cleanup_events cleanup
    WHERE cleanup.document_id=target_document_id
  );
$$;

CREATE OR REPLACE FUNCTION public.signature_enforce_field_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_version_id uuid;
  target_document_id uuid;
BEGIN
  target_version_id := CASE WHEN TG_OP='DELETE' THEN OLD.document_version_id ELSE NEW.document_version_id END;
  SELECT document_id INTO target_document_id FROM public.signature_document_versions WHERE id=target_version_id;
  IF TG_OP='DELETE' AND public.signature_test_cleanup_permitted(target_document_id) THEN
    RETURN OLD;
  END IF;
  IF EXISTS (SELECT 1 FROM public.signature_document_versions WHERE id=target_version_id AND locked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'signature field definitions are immutable after send';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.signature_reject_field_value_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_document_id uuid;
BEGIN
  IF TG_OP='DELETE' THEN
    SELECT v.document_id INTO target_document_id
      FROM public.signature_fields f
      JOIN public.signature_document_versions v ON v.id=f.document_version_id
     WHERE f.id=OLD.signature_field_id;
    IF public.signature_test_cleanup_permitted(target_document_id) THEN RETURN OLD; END IF;
  END IF;
  RAISE EXCEPTION 'submitted signature field values are immutable';
END;
$$;

CREATE OR REPLACE FUNCTION public.signature_reject_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' AND public.signature_test_cleanup_permitted(OLD.document_id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'signature events are append-only';
END;
$$;

COMMIT;
