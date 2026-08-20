BEGIN;

ALTER TABLE public.signature_documents
  ADD COLUMN routing_mode text NOT NULL DEFAULT 'parallel',
  ADD COLUMN requires_broker_signature boolean NOT NULL DEFAULT false,
  ADD COLUMN source_template_id uuid NULL,
  ADD COLUMN corrects_document_id uuid NULL REFERENCES public.signature_documents(id) ON DELETE RESTRICT,
  ADD CONSTRAINT signature_documents_routing_mode_check CHECK (
    routing_mode IN ('parallel','sequential','grouped')
  );

ALTER TABLE public.signature_participants
  ADD COLUMN is_broker_final_signer boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX signature_participants_one_broker_final_idx
  ON public.signature_participants (document_version_id)
  WHERE is_broker_final_signer AND removed_at IS NULL;

CREATE OR REPLACE FUNCTION public.signature_enforce_broker_final_routing()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE document_routing_mode text;
BEGIN
  IF TG_OP='UPDATE' AND OLD.is_broker_final_signer AND (
    NOT NEW.is_broker_final_signer OR NEW.removed_at IS DISTINCT FROM OLD.removed_at
  ) THEN RAISE EXCEPTION 'configured final broker cannot be removed from a draft'; END IF;
  IF NEW.removed_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.is_broker_final_signer THEN
    IF NEW.routing_order IS NULL OR EXISTS (
      SELECT 1 FROM public.signature_participants p
       WHERE p.document_version_id=NEW.document_version_id AND p.removed_at IS NULL
         AND p.id IS DISTINCT FROM NEW.id AND NOT p.is_broker_final_signer
         AND coalesce(p.routing_order,1)>=NEW.routing_order
    ) THEN RAISE EXCEPTION 'configured final broker must have a routing group after every transaction party'; END IF;
  ELSIF EXISTS (
    SELECT 1 FROM public.signature_participants broker
     WHERE broker.document_version_id=NEW.document_version_id AND broker.removed_at IS NULL
       AND broker.id IS DISTINCT FROM NEW.id AND broker.is_broker_final_signer
       AND coalesce(NEW.routing_order,1)>=broker.routing_order
  ) THEN RAISE EXCEPTION 'transaction party routing group must precede the configured final broker'; END IF;
  SELECT d.routing_mode INTO document_routing_mode
    FROM public.signature_document_versions v JOIN public.signature_documents d ON d.id=v.document_id
   WHERE v.id=NEW.document_version_id;
  IF NOT NEW.is_broker_final_signer AND document_routing_mode='parallel' AND coalesce(NEW.routing_order,1)<>1 THEN
    RAISE EXCEPTION 'parallel signature routing requires one shared routing group';
  END IF;
  IF NOT NEW.is_broker_final_signer AND document_routing_mode='sequential' AND EXISTS (
    SELECT 1 FROM public.signature_participants p
     WHERE p.document_version_id=NEW.document_version_id AND p.removed_at IS NULL
       AND p.id IS DISTINCT FROM NEW.id AND NOT p.is_broker_final_signer
       AND coalesce(p.routing_order,1)=coalesce(NEW.routing_order,1)
  ) THEN RAISE EXCEPTION 'sequential signature routing requires a unique group per transaction party'; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER signature_participants_broker_final_routing_trigger
BEFORE INSERT OR UPDATE ON public.signature_participants
FOR EACH ROW EXECUTE FUNCTION public.signature_enforce_broker_final_routing();

ALTER TABLE public.signature_fields DROP CONSTRAINT signature_fields_type_check;
ALTER TABLE public.signature_fields ADD CONSTRAINT signature_fields_type_check CHECK (
  field_type IN ('signature','initials','date','date_signed','text')
);

CREATE TABLE public.signature_signing_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  broker_admin_user_id uuid NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  broker_name_snapshot text NULL,
  broker_email_snapshot text NULL,
  updated_by_admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_signing_settings_broker_check CHECK (
    (broker_admin_user_id IS NULL AND broker_name_snapshot IS NULL AND broker_email_snapshot IS NULL)
    OR
    (broker_admin_user_id IS NOT NULL
      AND char_length(btrim(broker_name_snapshot)) BETWEEN 1 AND 200
      AND broker_email_snapshot=lower(btrim(broker_email_snapshot))
      AND position('@' IN broker_email_snapshot)>1)
  )
);

CREATE TABLE public.signature_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  description text NULL CHECK (description IS NULL OR char_length(btrim(description)) BETWEEN 1 AND 500),
  document_type text NOT NULL,
  source_document_version_id uuid NOT NULL REFERENCES public.signature_document_versions(id) ON DELETE RESTRICT,
  locale text NOT NULL DEFAULT 'es-PR' CHECK (locale IN ('es-PR','en-US')),
  routing_mode text NOT NULL DEFAULT 'parallel' CHECK (routing_mode IN ('parallel','sequential','grouped')),
  requires_broker_signature boolean NOT NULL DEFAULT false,
  role_blueprint jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(role_blueprint)='array' AND char_length(role_blueprint::text)<=10000),
  field_blueprint jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(field_blueprint)='array' AND char_length(field_blueprint::text)<=100000),
  snapshot_sha256 text NOT NULL CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by_admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz NULL,
  archived_by_admin_id uuid NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  archive_reason text NULL,
  CONSTRAINT signature_templates_archive_check CHECK (
    (status='active' AND archived_at IS NULL AND archived_by_admin_id IS NULL AND archive_reason IS NULL)
    OR (status='archived' AND archived_at IS NOT NULL AND archived_by_admin_id IS NOT NULL
      AND char_length(btrim(archive_reason)) BETWEEN 1 AND 500)
  )
);

ALTER TABLE public.signature_documents
  ADD CONSTRAINT signature_documents_source_template_fk
  FOREIGN KEY (source_template_id) REFERENCES public.signature_templates(id) ON DELETE RESTRICT;

CREATE INDEX signature_templates_status_created_idx ON public.signature_templates(status,created_at DESC);

CREATE UNIQUE INDEX signature_delivery_one_active_invitation_idx
  ON public.signature_delivery_intents(participant_id,delivery_kind)
  WHERE delivery_kind='invitation' AND status IN ('pending','processing');

CREATE OR REPLACE FUNCTION public.signature_enforce_template_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'signature templates must be archived, not deleted'; END IF;
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

CREATE TRIGGER signature_templates_immutable_trigger
BEFORE UPDATE OR DELETE ON public.signature_templates
FOR EACH ROW EXECUTE FUNCTION public.signature_enforce_template_immutability();

ALTER TABLE public.signature_governance_events DROP CONSTRAINT signature_governance_events_entity_check;
ALTER TABLE public.signature_governance_events ADD CONSTRAINT signature_governance_events_entity_check CHECK (
  entity_type IN ('document_classification','consent_version','privacy_disclosure','retention_policy',
    'launch_authorization','legal_hold','signing_draft','signing_request','risk_acceptance','readiness_snapshot',
    'signing_settings','signature_template')
);
ALTER TABLE public.signature_governance_events DROP CONSTRAINT signature_governance_events_action_check;
ALTER TABLE public.signature_governance_events ADD CONSTRAINT signature_governance_events_action_check CHECK (
  action IN ('created','submitted','approved','activated','retired','restricted','authorized','revoked',
    'placed','released','archived','deleted','workflow_hidden','recipient_removed','updated','duplicated','corrected')
);

CREATE OR REPLACE FUNCTION public.signature_validate_event_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior_sequence bigint; prior_digest text; metadata_key text;
BEGIN
  FOR metadata_key IN SELECT jsonb_object_keys(NEW.controlled_metadata) LOOP
    IF metadata_key <> ALL (ARRAY[
      'consent_version', 'consent_text_sha256', 'locale', 'field_id', 'field_type',
      'capture_method', 'document_status', 'participant_status', 'delivery_id',
      'delivery_channel', 'delivery_status', 'reason_code', 'verification_id',
      'source_sha256', 'final_pdf_sha256', 'certificate_sha256', 'event_note_code',
      'access_type', 'approval_status', 'time_zone'
    ]) THEN RAISE EXCEPTION 'signature event metadata key is not allowlisted'; END IF;
  END LOOP;
  SELECT sequence_number, event_digest INTO prior_sequence, prior_digest
    FROM public.signature_events WHERE document_id=NEW.document_id
    ORDER BY sequence_number DESC LIMIT 1;
  IF prior_sequence IS NULL THEN
    IF NEW.sequence_number<>1 OR NEW.previous_event_digest IS NOT NULL THEN
      RAISE EXCEPTION 'first signature event must start a new chain'; END IF;
  ELSIF NEW.sequence_number<>prior_sequence+1 OR NEW.previous_event_digest IS DISTINCT FROM prior_digest THEN
    RAISE EXCEPTION 'signature event chain predecessor mismatch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.signature_validate_field_value()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_type text;
BEGIN
  SELECT field_type INTO expected_type FROM public.signature_fields
   WHERE id=NEW.signature_field_id AND participant_id=NEW.participant_id;
  IF expected_type IS NULL THEN RAISE EXCEPTION 'signature field value binding is invalid'; END IF;
  IF expected_type='signature' AND NEW.capture_method NOT IN ('drawn_vector','typed') THEN
    RAISE EXCEPTION 'signature capture method is invalid';
  ELSIF expected_type='initials' AND NEW.capture_method NOT IN ('drawn_vector','typed') THEN
    RAISE EXCEPTION 'initials capture method is invalid';
  ELSIF expected_type='date' AND NEW.capture_method<>'text_entry' THEN
    RAISE EXCEPTION 'manual date capture method is invalid';
  ELSIF expected_type='date_signed' AND NEW.capture_method<>'system_date' THEN
    RAISE EXCEPTION 'date signed capture method is invalid';
  ELSIF expected_type='text' AND NEW.capture_method<>'text_entry' THEN
    RAISE EXCEPTION 'text capture method is invalid';
  END IF;
  IF NEW.capture_method='typed' AND expected_type='signature' AND char_length(NEW.sanitized_typed_value)>120 THEN RAISE EXCEPTION 'typed signature exceeds its limit'; END IF;
  IF NEW.capture_method='typed' AND expected_type='initials' AND char_length(NEW.sanitized_typed_value)>8 THEN RAISE EXCEPTION 'typed initials exceeds its limit'; END IF;
  IF expected_type IN ('date','date_signed') AND NEW.sanitized_typed_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'signature date must use ISO format'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.signature_enforce_document_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean := false;
BEGIN
  IF NEW.status=OLD.status THEN allowed:=true;
  ELSIF OLD.status='draft' AND NEW.status IN ('sent','archived') THEN allowed:=true;
  ELSIF OLD.status='sent' AND NEW.status IN ('viewed','partially_signed','completed') THEN allowed:=true;
  ELSIF OLD.status='viewed' AND NEW.status IN ('partially_signed','completed') THEN allowed:=true;
  ELSIF OLD.status='partially_signed' AND NEW.status='completed' THEN allowed:=true;
  ELSIF OLD.status NOT IN ('completed','voided','archived') AND NEW.status='voided' THEN allowed:=true;
  ELSIF OLD.status IN ('sent','viewed','partially_signed') AND NEW.status='expired' THEN allowed:=true;
  END IF;
  IF NOT allowed THEN RAISE EXCEPTION 'illegal signature document state transition: % -> %',OLD.status,NEW.status; END IF;
  IF OLD.status='archived' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'archived signature draft evidence is immutable'; END IF;
  IF OLD.status='draft' AND NEW.status='sent' AND (
    NEW.active_version_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM signature_document_versions v WHERE v.id=NEW.active_version_id AND v.document_id=NEW.id AND v.locked_at IS NOT NULL AND v.field_definition_sha256 IS NOT NULL)
    OR NOT EXISTS (SELECT 1 FROM signature_participants p WHERE p.document_version_id=NEW.active_version_id AND p.removed_at IS NULL)
    OR NOT EXISTS (SELECT 1 FROM signature_fields f WHERE f.document_version_id=NEW.active_version_id)
    OR EXISTS (SELECT 1 FROM signature_participants p WHERE p.document_version_id=NEW.active_version_id AND p.removed_at IS NULL AND NOT EXISTS (SELECT 1 FROM signature_fields f WHERE f.document_version_id=NEW.active_version_id AND f.participant_id=p.id AND f.required))
    OR (NEW.requires_broker_signature AND NOT EXISTS (
      SELECT 1 FROM signature_participants broker
       WHERE broker.document_version_id=NEW.active_version_id AND broker.removed_at IS NULL
         AND broker.is_broker_final_signer
         AND NOT EXISTS (SELECT 1 FROM signature_participants party
           WHERE party.document_version_id=NEW.active_version_id AND party.removed_at IS NULL
             AND NOT party.is_broker_final_signer AND coalesce(party.routing_order,1)>=broker.routing_order)
    ))
  ) THEN RAISE EXCEPTION 'signature send requires locked fields, participants, and the configured final broker'; END IF;
  IF NEW.status='completed' AND OLD.status<>'completed' AND (
    NOT EXISTS (SELECT 1 FROM signature_document_versions v WHERE v.id=NEW.active_version_id AND v.finalized_at IS NOT NULL)
    OR NOT EXISTS (SELECT 1 FROM signature_participants p WHERE p.document_version_id=NEW.active_version_id AND p.removed_at IS NULL)
    OR EXISTS (SELECT 1 FROM signature_participants p WHERE p.document_version_id=NEW.active_version_id AND p.removed_at IS NULL AND p.status<>'completed')
  ) THEN RAISE EXCEPTION 'signature completion requires a finalized version and completed participants'; END IF;
  IF OLD.status<>'draft' AND NEW.active_version_id IS DISTINCT FROM OLD.active_version_id THEN RAISE EXCEPTION 'active signature version is immutable after send'; END IF;
  IF OLD.status<>'draft' AND (
    NEW.canonical_lead_id IS DISTINCT FROM OLD.canonical_lead_id OR NEW.lead_group_id IS DISTINCT FROM OLD.lead_group_id
    OR NEW.title IS DISTINCT FROM OLD.title OR NEW.document_type IS DISTINCT FROM OLD.document_type
    OR NEW.document_type_approval_reference IS DISTINCT FROM OLD.document_type_approval_reference
    OR NEW.created_by_admin_id IS DISTINCT FROM OLD.created_by_admin_id OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    OR NEW.sent_at IS DISTINCT FROM OLD.sent_at OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.routing_mode IS DISTINCT FROM OLD.routing_mode OR NEW.requires_broker_signature IS DISTINCT FROM OLD.requires_broker_signature
    OR NEW.source_template_id IS DISTINCT FROM OLD.source_template_id
    OR NEW.corrects_document_id IS DISTINCT FROM OLD.corrects_document_id
  ) THEN RAISE EXCEPTION 'sent signature document identity is immutable'; END IF;
  IF OLD.completed_at IS NOT NULL AND NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN RAISE EXCEPTION 'signature document completion timestamp is immutable'; END IF;
  IF OLD.voided_at IS NOT NULL AND (NEW.voided_at IS DISTINCT FROM OLD.voided_at OR NEW.void_reason IS DISTINCT FROM OLD.void_reason) THEN RAISE EXCEPTION 'signature document void evidence is immutable'; END IF;
  NEW.row_version:=OLD.row_version+1; NEW.updated_at:=now(); RETURN NEW;
END;
$$;

COMMIT;
