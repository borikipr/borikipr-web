BEGIN;

CREATE TABLE public.signature_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_lead_id uuid NULL
    REFERENCES public.leads(id) ON DELETE RESTRICT,
  lead_group_id uuid NULL
    REFERENCES public.lead_groups(id) ON DELETE RESTRICT,
  title text NOT NULL,
  document_type text NOT NULL,
  document_type_approval_reference text NULL,
  status text NOT NULL DEFAULT 'draft',
  active_version_id uuid NULL,
  created_by_admin_id uuid NOT NULL
    REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  expires_at timestamptz NULL,
  sent_at timestamptz NULL,
  completed_at timestamptz NULL,
  voided_at timestamptz NULL,
  void_reason text NULL,
  row_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_documents_title_check CHECK (
    char_length(btrim(title)) BETWEEN 1 AND 200
  ),
  CONSTRAINT signature_documents_type_check CHECK (
    document_type IN (
      'ordinary_brokerage_agreement',
      'buyer_representation_agreement',
      'listing_related_agreement',
      'ordinary_transaction_addendum',
      'lease',
      'transaction_acknowledgment',
      'ordinary_offer_or_contract',
      'deed',
      'mortgage',
      'power_of_attorney',
      'sworn_statement',
      'affidavit',
      'notarized_document',
      'witnessed_document',
      'property_registry_instrument',
      'foreclosure_default_acceleration_notice',
      'inheritance_or_succession',
      'judicial_filing',
      'externally_controlled_execution'
    )
  ),
  CONSTRAINT signature_documents_approval_reference_check CHECK (
    document_type_approval_reference IS NULL
    OR char_length(btrim(document_type_approval_reference)) BETWEEN 1 AND 200
  ),
  CONSTRAINT signature_documents_status_check CHECK (
    status IN (
      'draft', 'sent', 'viewed', 'partially_signed',
      'completed', 'voided', 'expired'
    )
  ),
  CONSTRAINT signature_documents_row_version_check CHECK (row_version >= 0),
  CONSTRAINT signature_documents_active_state_check CHECK (
    status = 'draft'
    OR (
      active_version_id IS NOT NULL
      AND document_type_approval_reference IS NOT NULL
    )
  ),
  CONSTRAINT signature_documents_sent_at_check CHECK (
    status = 'draft'
    OR status = 'voided'
    OR sent_at IS NOT NULL
  ),
  CONSTRAINT signature_documents_completed_state_check CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status <> 'completed' AND completed_at IS NULL)
  ),
  CONSTRAINT signature_documents_voided_state_check CHECK (
    (
      status = 'voided'
      AND voided_at IS NOT NULL
      AND void_reason IS NOT NULL
      AND char_length(btrim(void_reason)) BETWEEN 1 AND 500
    )
    OR (
      status <> 'voided'
      AND voided_at IS NULL
      AND void_reason IS NULL
    )
  ),
  CONSTRAINT signature_documents_expired_state_check CHECK (
    status <> 'expired' OR expires_at IS NOT NULL
  ),
  CONSTRAINT signature_documents_time_order_check CHECK (
    updated_at >= created_at
    AND (expires_at IS NULL OR expires_at > created_at)
    AND (sent_at IS NULL OR sent_at >= created_at)
    AND (completed_at IS NULL OR completed_at >= sent_at)
    AND (voided_at IS NULL OR voided_at >= created_at)
  )
);

CREATE INDEX signature_documents_status_updated_at_idx
  ON public.signature_documents (status, updated_at DESC);
CREATE INDEX signature_documents_canonical_lead_idx
  ON public.signature_documents (canonical_lead_id, updated_at DESC)
  WHERE canonical_lead_id IS NOT NULL;
CREATE INDEX signature_documents_lead_group_idx
  ON public.signature_documents (lead_group_id, updated_at DESC)
  WHERE lead_group_id IS NOT NULL;

CREATE TABLE public.signature_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL
    REFERENCES public.signature_documents(id) ON DELETE RESTRICT,
  version_number integer NOT NULL,
  source_r2_key text NOT NULL,
  filename_snapshot text NOT NULL,
  mime_type text NOT NULL,
  byte_count bigint NOT NULL,
  page_count integer NOT NULL,
  source_sha256 text NOT NULL,
  page_geometry_manifest jsonb NOT NULL,
  field_definition_sha256 text NULL,
  final_r2_key text NULL,
  final_filename text NULL,
  final_mime_type text NULL,
  final_byte_count bigint NULL,
  final_page_count integer NULL,
  final_pdf_metadata jsonb NULL,
  final_pdf_sha256 text NULL,
  certificate_r2_key text NULL,
  certificate_mime_type text NULL,
  certificate_byte_count bigint NULL,
  certificate_metadata jsonb NULL,
  certificate_sha256 text NULL,
  locked_at timestamptz NULL,
  finalized_at timestamptz NULL,
  created_by_admin_id uuid NOT NULL
    REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_document_versions_number_check CHECK (
    version_number BETWEEN 1 AND 1000
  ),
  CONSTRAINT signature_document_versions_source_key_check CHECK (
    source_r2_key ~ '^signatures/source/[0-9a-f-]{36}/[1-9][0-9]*/[0-9a-f]{64}[.]pdf$'
  ),
  CONSTRAINT signature_document_versions_filename_check CHECK (
    char_length(filename_snapshot) BETWEEN 1 AND 255
    AND position('/' IN filename_snapshot) = 0
    AND position(chr(92) IN filename_snapshot) = 0
    AND position(chr(13) IN filename_snapshot) = 0
    AND position(chr(10) IN filename_snapshot) = 0
  ),
  CONSTRAINT signature_document_versions_mime_check CHECK (
    mime_type = 'application/pdf'
  ),
  CONSTRAINT signature_document_versions_byte_count_check CHECK (
    byte_count BETWEEN 1 AND 3000000
  ),
  CONSTRAINT signature_document_versions_page_count_check CHECK (
    page_count BETWEEN 1 AND 25
  ),
  CONSTRAINT signature_document_versions_source_hash_check CHECK (
    source_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT signature_document_versions_geometry_check CHECK (
    jsonb_typeof(page_geometry_manifest) = 'array'
    AND jsonb_array_length(page_geometry_manifest) = page_count
    AND char_length(page_geometry_manifest::text) <= 50000
  ),
  CONSTRAINT signature_document_versions_field_hash_check CHECK (
    field_definition_sha256 IS NULL
    OR field_definition_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT signature_document_versions_locked_check CHECK (
    locked_at IS NULL OR field_definition_sha256 IS NOT NULL
  ),
  CONSTRAINT signature_document_versions_final_state_check CHECK (
    (
      finalized_at IS NULL
      AND final_r2_key IS NULL
      AND final_filename IS NULL
      AND final_mime_type IS NULL
      AND final_byte_count IS NULL
      AND final_page_count IS NULL
      AND final_pdf_metadata IS NULL
      AND final_pdf_sha256 IS NULL
      AND certificate_r2_key IS NULL
      AND certificate_mime_type IS NULL
      AND certificate_byte_count IS NULL
      AND certificate_metadata IS NULL
      AND certificate_sha256 IS NULL
    )
    OR (
      finalized_at IS NOT NULL
      AND locked_at IS NOT NULL
      AND final_r2_key IS NOT NULL
      AND final_r2_key ~ '^signatures/final/[0-9a-f-]{36}/[1-9][0-9]*/[0-9a-f]{64}[.]pdf$'
      AND final_filename IS NOT NULL
      AND char_length(final_filename) BETWEEN 1 AND 255
      AND position('/' IN final_filename) = 0
      AND position(chr(92) IN final_filename) = 0
      AND position(chr(13) IN final_filename) = 0
      AND position(chr(10) IN final_filename) = 0
      AND final_mime_type = 'application/pdf'
      AND final_byte_count BETWEEN 1 AND 4000000
      AND final_page_count BETWEEN page_count AND page_count + 1
      AND jsonb_typeof(final_pdf_metadata) = 'object'
      AND char_length(final_pdf_metadata::text) <= 10000
      AND final_pdf_sha256 ~ '^[0-9a-f]{64}$'
      AND certificate_r2_key IS NOT NULL
      AND certificate_r2_key ~ '^signatures/certificates/[0-9a-f-]{36}/[1-9][0-9]*/[0-9a-f]{64}[.]pdf$'
      AND certificate_mime_type = 'application/pdf'
      AND certificate_byte_count BETWEEN 1 AND 1000000
      AND jsonb_typeof(certificate_metadata) = 'object'
      AND char_length(certificate_metadata::text) <= 10000
      AND certificate_sha256 ~ '^[0-9a-f]{64}$'
    )
  ),
  CONSTRAINT signature_document_versions_time_check CHECK (
    updated_at >= created_at
    AND (locked_at IS NULL OR locked_at >= created_at)
    AND (finalized_at IS NULL OR finalized_at >= locked_at)
  ),
  CONSTRAINT signature_document_versions_document_version_unique
    UNIQUE (document_id, version_number),
  CONSTRAINT signature_document_versions_document_id_unique
    UNIQUE (document_id, id)
);

CREATE INDEX signature_document_versions_document_created_idx
  ON public.signature_document_versions (document_id, created_at DESC);

ALTER TABLE public.signature_documents
  ADD CONSTRAINT signature_documents_active_version_fk
  FOREIGN KEY (id, active_version_id)
  REFERENCES public.signature_document_versions (document_id, id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.signature_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_id uuid NOT NULL
    REFERENCES public.signature_document_versions(id) ON DELETE RESTRICT,
  canonical_lead_id uuid NULL
    REFERENCES public.leads(id) ON DELETE RESTRICT,
  name_snapshot text NOT NULL,
  email_snapshot text NOT NULL,
  normalized_email text NOT NULL,
  phone_snapshot text NULL,
  role text NOT NULL,
  routing_order integer NULL,
  status text NOT NULL DEFAULT 'pending',
  invited_at timestamptz NULL,
  viewed_at timestamptz NULL,
  consented_at timestamptz NULL,
  completed_at timestamptz NULL,
  delivery_sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_participants_name_check CHECK (
    char_length(btrim(name_snapshot)) BETWEEN 1 AND 200
  ),
  CONSTRAINT signature_participants_email_snapshot_check CHECK (
    char_length(email_snapshot) BETWEEN 3 AND 320
    AND position('@' IN email_snapshot) > 1
  ),
  CONSTRAINT signature_participants_normalized_email_check CHECK (
    normalized_email = lower(btrim(normalized_email))
    AND char_length(normalized_email) BETWEEN 3 AND 320
    AND position('@' IN normalized_email) > 1
  ),
  CONSTRAINT signature_participants_phone_check CHECK (
    phone_snapshot IS NULL OR char_length(phone_snapshot) BETWEEN 1 AND 50
  ),
  CONSTRAINT signature_participants_role_check CHECK (
    role ~ '^[a-z][a-z0-9_]{0,49}$'
  ),
  CONSTRAINT signature_participants_routing_order_check CHECK (
    routing_order IS NULL OR routing_order BETWEEN 1 AND 8
  ),
  CONSTRAINT signature_participants_status_check CHECK (
    status IN (
      'pending', 'invited', 'viewed', 'consented', 'completed',
      'revoked', 'expired', 'declined'
    )
  ),
  CONSTRAINT signature_participants_status_timestamps_check CHECK (
    (status <> 'invited' OR invited_at IS NOT NULL)
    AND (status <> 'viewed' OR viewed_at IS NOT NULL)
    AND (status <> 'consented' OR consented_at IS NOT NULL)
    AND (status <> 'completed' OR completed_at IS NOT NULL)
    AND (completed_at IS NULL OR consented_at IS NOT NULL)
  ),
  CONSTRAINT signature_participants_time_check CHECK (
    updated_at >= created_at
    AND (invited_at IS NULL OR invited_at >= created_at)
    AND (viewed_at IS NULL OR viewed_at >= created_at)
    AND (consented_at IS NULL OR consented_at >= created_at)
    AND (completed_at IS NULL OR completed_at >= created_at)
    AND (delivery_sent_at IS NULL OR delivery_sent_at >= created_at)
  ),
  CONSTRAINT signature_participants_version_id_unique
    UNIQUE (document_version_id, id),
  CONSTRAINT signature_participants_version_email_unique
    UNIQUE (document_version_id, normalized_email)
);

CREATE INDEX signature_participants_version_status_idx
  ON public.signature_participants (document_version_id, status, routing_order);
CREATE INDEX signature_participants_canonical_lead_idx
  ON public.signature_participants (canonical_lead_id, created_at DESC)
  WHERE canonical_lead_id IS NOT NULL;

CREATE TABLE public.signature_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  field_type text NOT NULL,
  page_index integer NOT NULL,
  normalized_x numeric(12, 10) NOT NULL,
  normalized_y numeric(12, 10) NOT NULL,
  normalized_width numeric(12, 10) NOT NULL,
  normalized_height numeric(12, 10) NOT NULL,
  page_geometry_reference jsonb NOT NULL,
  label text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  tab_order integer NOT NULL,
  validation_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  immutable_definition_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signature_fields_participant_fk
    FOREIGN KEY (document_version_id, participant_id)
    REFERENCES public.signature_participants (document_version_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT signature_fields_type_check CHECK (
    field_type IN ('signature', 'initials', 'date', 'text')
  ),
  CONSTRAINT signature_fields_page_index_check CHECK (
    page_index BETWEEN 0 AND 24
  ),
  CONSTRAINT signature_fields_coordinates_check CHECK (
    normalized_x BETWEEN 0 AND 1
    AND normalized_y BETWEEN 0 AND 1
    AND normalized_width > 0 AND normalized_width <= 1
    AND normalized_height > 0 AND normalized_height <= 1
    AND normalized_x + normalized_width <= 1
    AND normalized_y + normalized_height <= 1
  ),
  CONSTRAINT signature_fields_geometry_check CHECK (
    jsonb_typeof(page_geometry_reference) = 'object'
    AND char_length(page_geometry_reference::text) <= 2000
  ),
  CONSTRAINT signature_fields_label_check CHECK (
    char_length(btrim(label)) BETWEEN 1 AND 120
  ),
  CONSTRAINT signature_fields_tab_order_check CHECK (
    tab_order BETWEEN 1 AND 100
  ),
  CONSTRAINT signature_fields_validation_limits_check CHECK (
    jsonb_typeof(validation_limits) = 'object'
    AND char_length(validation_limits::text) <= 1000
  ),
  CONSTRAINT signature_fields_definition_hash_check CHECK (
    immutable_definition_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT signature_fields_id_participant_unique
    UNIQUE (id, participant_id),
  CONSTRAINT signature_fields_version_participant_tab_unique
    UNIQUE (document_version_id, participant_id, tab_order)
);

CREATE INDEX signature_fields_version_page_idx
  ON public.signature_fields (document_version_id, page_index, tab_order);
CREATE INDEX signature_fields_participant_tab_idx
  ON public.signature_fields (participant_id, tab_order);

CREATE TABLE public.signature_signing_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL,
  document_version_id uuid NOT NULL,
  token_digest text NOT NULL,
  purpose text NOT NULL DEFAULT 'sign_document',
  key_version integer NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  revoked_at timestamptz NULL,
  superseded_at timestamptz NULL,
  last_delivery_id uuid NULL,
  CONSTRAINT signature_signing_tokens_participant_fk
    FOREIGN KEY (document_version_id, participant_id)
    REFERENCES public.signature_participants (document_version_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT signature_signing_tokens_digest_check CHECK (
    token_digest ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT signature_signing_tokens_purpose_check CHECK (
    purpose = 'sign_document'
  ),
  CONSTRAINT signature_signing_tokens_key_version_check CHECK (
    key_version BETWEEN 1 AND 1000000
  ),
  CONSTRAINT signature_signing_tokens_expiry_check CHECK (
    expires_at > issued_at
  ),
  CONSTRAINT signature_signing_tokens_revoked_check CHECK (
    revoked_at IS NULL OR revoked_at >= issued_at
  ),
  CONSTRAINT signature_signing_tokens_consumed_check CHECK (
    consumed_at IS NULL OR consumed_at >= issued_at
  ),
  CONSTRAINT signature_signing_tokens_superseded_check CHECK (
    superseded_at IS NULL OR superseded_at >= issued_at
  ),
  CONSTRAINT signature_signing_tokens_digest_unique UNIQUE (token_digest),
  CONSTRAINT signature_signing_tokens_binding_unique
    UNIQUE (id, document_version_id, participant_id)
);

CREATE INDEX signature_signing_tokens_active_idx
  ON public.signature_signing_tokens (participant_id, expires_at DESC)
  WHERE consumed_at IS NULL AND revoked_at IS NULL AND superseded_at IS NULL;

CREATE TABLE public.signature_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  document_version_id uuid NOT NULL,
  session_secret_digest text NOT NULL,
  csrf_nonce_digest text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  idle_expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  completed_at timestamptz NULL,
  CONSTRAINT signature_sessions_token_binding_fk
    FOREIGN KEY (token_id, document_version_id, participant_id)
    REFERENCES public.signature_signing_tokens (
      id, document_version_id, participant_id
    ) ON DELETE RESTRICT,
  CONSTRAINT signature_sessions_secret_digest_check CHECK (
    session_secret_digest ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT signature_sessions_csrf_digest_check CHECK (
    csrf_nonce_digest ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT signature_sessions_expiry_check CHECK (
    expires_at > created_at
    AND idle_expires_at > created_at
    AND idle_expires_at <= expires_at
    AND last_seen_at >= created_at
    AND last_seen_at <= expires_at
  ),
  CONSTRAINT signature_sessions_revoked_check CHECK (
    revoked_at IS NULL OR revoked_at >= created_at
  ),
  CONSTRAINT signature_sessions_completed_check CHECK (
    completed_at IS NULL OR completed_at >= created_at
  ),
  CONSTRAINT signature_sessions_secret_unique UNIQUE (session_secret_digest),
  CONSTRAINT signature_sessions_participant_id_unique
    UNIQUE (participant_id, id),
  CONSTRAINT signature_sessions_binding_unique
    UNIQUE (document_version_id, participant_id, id)
);

CREATE INDEX signature_sessions_active_idx
  ON public.signature_sessions (participant_id, expires_at, idle_expires_at)
  WHERE revoked_at IS NULL AND completed_at IS NULL;

CREATE TABLE public.signature_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_field_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  capture_method text NOT NULL,
  sanitized_typed_value text NULL,
  private_artifact_r2_key text NULL,
  value_artifact_sha256 text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  signer_session_id uuid NOT NULL,
  CONSTRAINT signature_field_values_field_participant_fk
    FOREIGN KEY (signature_field_id, participant_id)
    REFERENCES public.signature_fields (id, participant_id)
    ON DELETE RESTRICT,
  CONSTRAINT signature_field_values_session_participant_fk
    FOREIGN KEY (participant_id, signer_session_id)
    REFERENCES public.signature_sessions (participant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT signature_field_values_capture_method_check CHECK (
    capture_method IN ('drawn_vector', 'typed', 'system_date', 'text_entry')
  ),
  CONSTRAINT signature_field_values_payload_check CHECK (
    (
      capture_method = 'drawn_vector'
      AND sanitized_typed_value IS NULL
      AND private_artifact_r2_key IS NOT NULL
      AND private_artifact_r2_key ~ '^signatures/artifacts/[0-9a-f-]{36}/[1-9][0-9]*/[0-9a-f-]{36}/[0-9a-f]{64}[.]bin$'
    )
    OR (
      capture_method <> 'drawn_vector'
      AND sanitized_typed_value IS NOT NULL
      AND private_artifact_r2_key IS NULL
      AND char_length(sanitized_typed_value) BETWEEN 1 AND 500
      AND sanitized_typed_value !~ '[[:cntrl:]]'
    )
  ),
  CONSTRAINT signature_field_values_hash_check CHECK (
    value_artifact_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT signature_field_values_field_unique UNIQUE (signature_field_id)
);

CREATE INDEX signature_field_values_participant_submitted_idx
  ON public.signature_field_values (participant_id, submitted_at DESC);

CREATE TABLE public.signature_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  document_version_id uuid NOT NULL,
  participant_id uuid NULL,
  session_id uuid NULL,
  event_type text NOT NULL,
  actor_class text NOT NULL,
  actor_admin_id uuid NULL
    REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  server_timestamp timestamptz NOT NULL DEFAULT clock_timestamp(),
  sequence_number bigint NOT NULL,
  version_hash text NOT NULL,
  controlled_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key uuid NOT NULL,
  previous_event_digest text NULL,
  event_digest text NOT NULL,
  key_version integer NOT NULL,
  network_address_digest text NULL,
  user_agent_digest text NULL,
  CONSTRAINT signature_events_document_version_fk
    FOREIGN KEY (document_id, document_version_id)
    REFERENCES public.signature_document_versions (document_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT signature_events_participant_fk
    FOREIGN KEY (document_version_id, participant_id)
    REFERENCES public.signature_participants (document_version_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT signature_events_session_fk
    FOREIGN KEY (document_version_id, participant_id, session_id)
    REFERENCES public.signature_sessions (document_version_id, participant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT signature_events_type_check CHECK (
    event_type IN (
      'document_created', 'version_created', 'participant_added',
      'participant_updated', 'field_added', 'field_updated', 'field_removed',
      'send_prepared', 'document_sent', 'document_viewed',
      'document_partially_signed', 'document_completed', 'document_voided',
      'document_expired', 'participant_invited', 'participant_viewed',
      'participant_consented', 'participant_completed', 'participant_revoked',
      'participant_expired', 'participant_declined', 'field_submitted',
      'token_issued', 'token_revoked', 'token_superseded', 'session_created',
      'session_revoked', 'session_completed', 'finalization_completed',
      'delivery_recorded', 'document_downloaded'
    )
  ),
  CONSTRAINT signature_events_actor_class_check CHECK (
    actor_class IN ('admin', 'participant', 'system', 'delivery')
  ),
  CONSTRAINT signature_events_actor_binding_check CHECK (
    (actor_class = 'admin' AND actor_admin_id IS NOT NULL)
    OR (actor_class = 'participant' AND actor_admin_id IS NULL AND participant_id IS NOT NULL)
    OR (actor_class IN ('system', 'delivery') AND actor_admin_id IS NULL)
  ),
  CONSTRAINT signature_events_session_participant_check CHECK (
    session_id IS NULL OR participant_id IS NOT NULL
  ),
  CONSTRAINT signature_events_sequence_check CHECK (sequence_number > 0),
  CONSTRAINT signature_events_version_hash_check CHECK (
    version_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT signature_events_metadata_check CHECK (
    jsonb_typeof(controlled_metadata) = 'object'
    AND char_length(controlled_metadata::text) <= 4000
  ),
  CONSTRAINT signature_events_previous_digest_check CHECK (
    previous_event_digest IS NULL
    OR previous_event_digest ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT signature_events_digest_check CHECK (
    event_digest ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT signature_events_key_version_check CHECK (
    key_version BETWEEN 1 AND 1000000
  ),
  CONSTRAINT signature_events_network_digest_check CHECK (
    network_address_digest IS NULL
    OR network_address_digest ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT signature_events_user_agent_digest_check CHECK (
    user_agent_digest IS NULL
    OR user_agent_digest ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT signature_events_idempotency_unique
    UNIQUE (document_id, idempotency_key),
  CONSTRAINT signature_events_sequence_unique
    UNIQUE (document_id, sequence_number),
  CONSTRAINT signature_events_document_digest_unique
    UNIQUE (document_id, event_digest)
);

CREATE INDEX signature_events_document_sequence_idx
  ON public.signature_events (document_id, sequence_number);
CREATE INDEX signature_events_participant_time_idx
  ON public.signature_events (participant_id, server_timestamp DESC)
  WHERE participant_id IS NOT NULL;

CREATE FUNCTION public.signature_enforce_participant_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM 1 FROM public.signature_document_versions
   WHERE id = NEW.document_version_id
   FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.signature_document_versions
     WHERE id = NEW.document_version_id AND locked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'cannot add a participant to a locked signature version';
  END IF;
  IF (SELECT count(*) FROM public.signature_participants
       WHERE document_version_id = NEW.document_version_id) >= 8 THEN
    RAISE EXCEPTION 'signature participant limit exceeded';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER signature_participants_limit_trigger
BEFORE INSERT ON public.signature_participants
FOR EACH ROW EXECUTE FUNCTION public.signature_enforce_participant_limit();

CREATE FUNCTION public.signature_enforce_field_limits()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM 1 FROM public.signature_document_versions
   WHERE id = NEW.document_version_id
   FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.signature_document_versions
     WHERE id = NEW.document_version_id
       AND (
         NEW.page_index >= page_count
         OR (TG_OP = 'INSERT' AND locked_at IS NOT NULL)
       )
  ) THEN
    RAISE EXCEPTION 'cannot add an invalid field to a signature version';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF (SELECT count(*) FROM public.signature_fields
         WHERE document_version_id = NEW.document_version_id) >= 100 THEN
      RAISE EXCEPTION 'signature document field limit exceeded';
    END IF;
    IF (SELECT count(*) FROM public.signature_fields
         WHERE participant_id = NEW.participant_id) >= 40 THEN
      RAISE EXCEPTION 'signature participant field limit exceeded';
    END IF;
  ELSIF NEW.participant_id IS DISTINCT FROM OLD.participant_id
        AND (SELECT count(*) FROM public.signature_fields
              WHERE participant_id = NEW.participant_id) >= 40 THEN
    RAISE EXCEPTION 'signature participant field limit exceeded';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER signature_fields_limit_trigger
BEFORE INSERT OR UPDATE ON public.signature_fields
FOR EACH ROW EXECUTE FUNCTION public.signature_enforce_field_limits();

CREATE FUNCTION public.signature_enforce_document_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN
    allowed := true;
  ELSIF OLD.status = 'draft' AND NEW.status = 'sent' THEN
    allowed := true;
  ELSIF OLD.status = 'sent' AND NEW.status IN ('viewed', 'partially_signed', 'completed') THEN
    allowed := true;
  ELSIF OLD.status = 'viewed' AND NEW.status IN ('partially_signed', 'completed') THEN
    allowed := true;
  ELSIF OLD.status = 'partially_signed' AND NEW.status = 'completed' THEN
    allowed := true;
  ELSIF OLD.status NOT IN ('completed', 'voided') AND NEW.status = 'voided' THEN
    allowed := true;
  ELSIF OLD.status IN ('sent', 'viewed', 'partially_signed') AND NEW.status = 'expired' THEN
    allowed := true;
  END IF;
  IF NOT allowed THEN
    RAISE EXCEPTION 'illegal signature document state transition: % -> %', OLD.status, NEW.status;
  END IF;
  IF OLD.status = 'draft' AND NEW.status = 'sent' AND (
    NEW.active_version_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.signature_document_versions v
       WHERE v.id = NEW.active_version_id
         AND v.document_id = NEW.id
         AND v.locked_at IS NOT NULL
         AND v.field_definition_sha256 IS NOT NULL
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.signature_participants p
       WHERE p.document_version_id = NEW.active_version_id
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.signature_fields f
       WHERE f.document_version_id = NEW.active_version_id
    )
    OR EXISTS (
      SELECT 1 FROM public.signature_participants p
       WHERE p.document_version_id = NEW.active_version_id
         AND NOT EXISTS (
           SELECT 1 FROM public.signature_fields f
            WHERE f.document_version_id = NEW.active_version_id
              AND f.participant_id = p.id
              AND f.required
         )
    )
  ) THEN
    RAISE EXCEPTION 'signature send requires a locked version and required fields for every participant';
  END IF;
  IF NEW.status = 'completed' AND OLD.status <> 'completed' AND (
    NOT EXISTS (
      SELECT 1 FROM public.signature_document_versions v
       WHERE v.id = NEW.active_version_id AND v.finalized_at IS NOT NULL
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.signature_participants p
       WHERE p.document_version_id = NEW.active_version_id
    )
    OR EXISTS (
      SELECT 1 FROM public.signature_participants p
       WHERE p.document_version_id = NEW.active_version_id
         AND p.status <> 'completed'
    )
  ) THEN
    RAISE EXCEPTION 'signature completion requires a finalized version and completed participants';
  END IF;
  IF OLD.status <> 'draft' AND NEW.active_version_id IS DISTINCT FROM OLD.active_version_id THEN
    RAISE EXCEPTION 'active signature version is immutable after send';
  END IF;
  IF OLD.status <> 'draft' AND (
    NEW.canonical_lead_id IS DISTINCT FROM OLD.canonical_lead_id
    OR NEW.lead_group_id IS DISTINCT FROM OLD.lead_group_id
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.document_type IS DISTINCT FROM OLD.document_type
    OR NEW.document_type_approval_reference IS DISTINCT FROM OLD.document_type_approval_reference
    OR NEW.created_by_admin_id IS DISTINCT FROM OLD.created_by_admin_id
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'sent signature document identity is immutable';
  END IF;
  IF OLD.completed_at IS NOT NULL
     AND NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    RAISE EXCEPTION 'signature document completion timestamp is immutable';
  END IF;
  IF OLD.voided_at IS NOT NULL AND (
    NEW.voided_at IS DISTINCT FROM OLD.voided_at
    OR NEW.void_reason IS DISTINCT FROM OLD.void_reason
  ) THEN
    RAISE EXCEPTION 'signature document void evidence is immutable';
  END IF;
  NEW.row_version := OLD.row_version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER signature_documents_transition_trigger
BEFORE UPDATE ON public.signature_documents
FOR EACH ROW EXECUTE FUNCTION public.signature_enforce_document_transition();

CREATE FUNCTION public.signature_enforce_participant_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN
    allowed := true;
  ELSIF OLD.status = 'pending' AND NEW.status = 'invited' THEN
    allowed := true;
  ELSIF OLD.status = 'invited' AND NEW.status = 'viewed' THEN
    allowed := true;
  ELSIF OLD.status = 'viewed' AND NEW.status = 'consented' THEN
    allowed := true;
  ELSIF OLD.status = 'consented' AND NEW.status = 'completed' THEN
    allowed := true;
  ELSIF OLD.status IN ('pending', 'invited', 'viewed', 'consented')
        AND NEW.status IN ('revoked', 'expired', 'declined') THEN
    allowed := true;
  END IF;
  IF NOT allowed THEN
    RAISE EXCEPTION 'illegal signature participant state transition: % -> %', OLD.status, NEW.status;
  END IF;
  IF NEW.status = 'completed' AND OLD.status <> 'completed' AND EXISTS (
    SELECT 1 FROM public.signature_fields f
     WHERE f.document_version_id = OLD.document_version_id
       AND f.participant_id = OLD.id
       AND f.required
       AND NOT EXISTS (
         SELECT 1 FROM public.signature_field_values fv
          WHERE fv.signature_field_id = f.id
       )
  ) THEN
    RAISE EXCEPTION 'signature participant completion requires every required field';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.signature_document_versions
     WHERE id = OLD.document_version_id AND locked_at IS NOT NULL
  ) AND (
    NEW.document_version_id IS DISTINCT FROM OLD.document_version_id
    OR NEW.canonical_lead_id IS DISTINCT FROM OLD.canonical_lead_id
    OR NEW.name_snapshot IS DISTINCT FROM OLD.name_snapshot
    OR NEW.email_snapshot IS DISTINCT FROM OLD.email_snapshot
    OR NEW.normalized_email IS DISTINCT FROM OLD.normalized_email
    OR NEW.phone_snapshot IS DISTINCT FROM OLD.phone_snapshot
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.routing_order IS DISTINCT FROM OLD.routing_order
  ) THEN
    RAISE EXCEPTION 'signature participant identity snapshot is immutable after send';
  END IF;
  IF (OLD.invited_at IS NOT NULL AND NEW.invited_at IS DISTINCT FROM OLD.invited_at)
     OR (OLD.viewed_at IS NOT NULL AND NEW.viewed_at IS DISTINCT FROM OLD.viewed_at)
     OR (OLD.consented_at IS NOT NULL AND NEW.consented_at IS DISTINCT FROM OLD.consented_at)
     OR (OLD.completed_at IS NOT NULL AND NEW.completed_at IS DISTINCT FROM OLD.completed_at)
     OR (OLD.delivery_sent_at IS NOT NULL
         AND NEW.delivery_sent_at IS DISTINCT FROM OLD.delivery_sent_at) THEN
    RAISE EXCEPTION 'signature participant lifecycle evidence is immutable';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER signature_participants_transition_trigger
BEFORE UPDATE ON public.signature_participants
FOR EACH ROW EXECUTE FUNCTION public.signature_enforce_participant_transition();

CREATE FUNCTION public.signature_enforce_version_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.finalized_at IS NOT NULL THEN
    RAISE EXCEPTION 'finalized signature document versions are immutable';
  END IF;
  IF OLD.locked_at IS NOT NULL AND (
    NEW.document_id IS DISTINCT FROM OLD.document_id
    OR NEW.version_number IS DISTINCT FROM OLD.version_number
    OR NEW.source_r2_key IS DISTINCT FROM OLD.source_r2_key
    OR NEW.filename_snapshot IS DISTINCT FROM OLD.filename_snapshot
    OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
    OR NEW.byte_count IS DISTINCT FROM OLD.byte_count
    OR NEW.page_count IS DISTINCT FROM OLD.page_count
    OR NEW.source_sha256 IS DISTINCT FROM OLD.source_sha256
    OR NEW.page_geometry_manifest IS DISTINCT FROM OLD.page_geometry_manifest
    OR NEW.field_definition_sha256 IS DISTINCT FROM OLD.field_definition_sha256
    OR NEW.locked_at IS DISTINCT FROM OLD.locked_at
    OR NEW.created_by_admin_id IS DISTINCT FROM OLD.created_by_admin_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'sent signature document version definitions are immutable';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER signature_document_versions_immutable_trigger
BEFORE UPDATE ON public.signature_document_versions
FOR EACH ROW EXECUTE FUNCTION public.signature_enforce_version_immutability();

CREATE FUNCTION public.signature_enforce_field_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_version_id uuid;
BEGIN
  target_version_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.document_version_id
    ELSE NEW.document_version_id
  END;
  IF EXISTS (
    SELECT 1 FROM public.signature_document_versions
     WHERE id = target_version_id
       AND locked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'signature field definitions are immutable after send';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER signature_fields_update_immutable_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.signature_fields
FOR EACH ROW EXECUTE FUNCTION public.signature_enforce_field_immutability();

CREATE FUNCTION public.signature_validate_field_value()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  expected_type text;
BEGIN
  SELECT field_type INTO expected_type
    FROM public.signature_fields
   WHERE id = NEW.signature_field_id
     AND participant_id = NEW.participant_id;
  IF expected_type IS NULL THEN
    RAISE EXCEPTION 'signature field value binding is invalid';
  END IF;
  IF expected_type = 'signature' AND NEW.capture_method NOT IN ('drawn_vector', 'typed') THEN
    RAISE EXCEPTION 'signature capture method is invalid';
  ELSIF expected_type = 'initials' AND NEW.capture_method NOT IN ('drawn_vector', 'typed') THEN
    RAISE EXCEPTION 'initials capture method is invalid';
  ELSIF expected_type = 'date' AND NEW.capture_method <> 'system_date' THEN
    RAISE EXCEPTION 'date capture method is invalid';
  ELSIF expected_type = 'text' AND NEW.capture_method <> 'text_entry' THEN
    RAISE EXCEPTION 'text capture method is invalid';
  END IF;
  IF NEW.capture_method = 'typed'
     AND expected_type = 'signature'
     AND char_length(NEW.sanitized_typed_value) > 120 THEN
    RAISE EXCEPTION 'typed signature exceeds its limit';
  END IF;
  IF NEW.capture_method = 'typed'
     AND expected_type = 'initials'
     AND char_length(NEW.sanitized_typed_value) > 8 THEN
    RAISE EXCEPTION 'typed initials exceeds its limit';
  END IF;
  IF NEW.capture_method = 'system_date'
     AND NEW.sanitized_typed_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'signature date must use ISO format';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER signature_field_values_validate_trigger
BEFORE INSERT ON public.signature_field_values
FOR EACH ROW EXECUTE FUNCTION public.signature_validate_field_value();

CREATE FUNCTION public.signature_reject_field_value_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'submitted signature field values are immutable';
END;
$$;

CREATE TRIGGER signature_field_values_immutable_trigger
BEFORE UPDATE OR DELETE ON public.signature_field_values
FOR EACH ROW EXECUTE FUNCTION public.signature_reject_field_value_mutation();

CREATE FUNCTION public.signature_enforce_token_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.participant_id IS DISTINCT FROM OLD.participant_id
     OR NEW.document_version_id IS DISTINCT FROM OLD.document_version_id
     OR NEW.token_digest IS DISTINCT FROM OLD.token_digest
     OR NEW.purpose IS DISTINCT FROM OLD.purpose
     OR NEW.key_version IS DISTINCT FROM OLD.key_version
     OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'signature token binding is immutable';
  END IF;
  IF OLD.consumed_at IS NOT NULL
     AND NEW.consumed_at IS DISTINCT FROM OLD.consumed_at THEN
    RAISE EXCEPTION 'consumed signature tokens cannot be replayed';
  END IF;
  IF (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at)
     OR (OLD.superseded_at IS NOT NULL
         AND NEW.superseded_at IS DISTINCT FROM OLD.superseded_at) THEN
    RAISE EXCEPTION 'signature token terminal evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER signature_signing_tokens_immutable_trigger
BEFORE UPDATE ON public.signature_signing_tokens
FOR EACH ROW EXECUTE FUNCTION public.signature_enforce_token_immutability();

CREATE FUNCTION public.signature_enforce_session_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.token_id IS DISTINCT FROM OLD.token_id
     OR NEW.participant_id IS DISTINCT FROM OLD.participant_id
     OR NEW.document_version_id IS DISTINCT FROM OLD.document_version_id
     OR NEW.session_secret_digest IS DISTINCT FROM OLD.session_secret_digest
     OR NEW.csrf_nonce_digest IS DISTINCT FROM OLD.csrf_nonce_digest
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'signature session binding is immutable';
  END IF;
  IF NEW.last_seen_at < OLD.last_seen_at
     OR NEW.idle_expires_at < OLD.idle_expires_at THEN
    RAISE EXCEPTION 'signature session activity cannot move backward';
  END IF;
  IF (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at)
     OR (OLD.completed_at IS NOT NULL AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    RAISE EXCEPTION 'signature session terminal evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER signature_sessions_immutable_trigger
BEFORE UPDATE ON public.signature_sessions
FOR EACH ROW EXECUTE FUNCTION public.signature_enforce_session_immutability();

CREATE FUNCTION public.signature_validate_event_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  prior_sequence bigint;
  prior_digest text;
  metadata_key text;
BEGIN
  FOR metadata_key IN SELECT jsonb_object_keys(NEW.controlled_metadata)
  LOOP
    IF metadata_key <> ALL (ARRAY[
      'consent_version', 'field_id', 'field_type', 'document_status',
      'participant_status', 'delivery_id', 'delivery_channel', 'reason_code',
      'verification_id', 'source_sha256', 'final_pdf_sha256',
      'certificate_sha256', 'event_note_code'
    ]) THEN
      RAISE EXCEPTION 'signature event metadata key is not allowlisted';
    END IF;
  END LOOP;

  SELECT sequence_number, event_digest
    INTO prior_sequence, prior_digest
    FROM public.signature_events
   WHERE document_id = NEW.document_id
   ORDER BY sequence_number DESC
   LIMIT 1;

  IF prior_sequence IS NULL THEN
    IF NEW.sequence_number <> 1 OR NEW.previous_event_digest IS NOT NULL THEN
      RAISE EXCEPTION 'first signature event must start a new chain';
    END IF;
  ELSIF NEW.sequence_number <> prior_sequence + 1
     OR NEW.previous_event_digest IS DISTINCT FROM prior_digest THEN
    RAISE EXCEPTION 'signature event chain predecessor mismatch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER signature_events_chain_trigger
BEFORE INSERT ON public.signature_events
FOR EACH ROW EXECUTE FUNCTION public.signature_validate_event_insert();

CREATE FUNCTION public.signature_reject_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'signature events are append-only';
END;
$$;

CREATE TRIGGER signature_events_immutable_trigger
BEFORE UPDATE OR DELETE ON public.signature_events
FOR EACH ROW EXECUTE FUNCTION public.signature_reject_event_mutation();

COMMIT;
