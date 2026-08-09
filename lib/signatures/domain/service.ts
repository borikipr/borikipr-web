import { hashSignatureFieldDefinition } from "../field-definition";
import { getSignatureDocumentTypeDefinition } from "../document-classification";
import {
  canonicalSignatureJson,
  constantTimeDigestMatch,
  hashPseudonymousEvidence,
  sha256SignatureValue,
} from "./crypto";
import {
  createSignatureEventDigest,
  verifySignatureEventChain,
} from "./event-chain";
import { signatureSourceR2Key } from "./r2-keys";
import {
  SIGNER_SESSION_IDLE_MINUTES,
  SIGNER_SESSION_MAX_MINUTES,
  createSignerSessionMaterial,
  verifySignerSession,
} from "./session";
import { normalizeSignerCapture, type SignerCaptureInput } from "../signer/capture";
import {
  assertAllowedDocumentTransition,
  assertAllowedParticipantTransition,
} from "./state";
import { createSigningTokenMaterial, verifySigningToken } from "./token";
import type {
  SignatureActorClass,
  SignatureClock,
  SignatureDatabase,
  SignatureDocumentStatus,
  SignatureEventMetadata,
  SignatureEventRecord,
  SignatureEventType,
  SignatureFieldType,
  SignatureParticipantStatus,
  SignatureQueryExecutor,
} from "./types";

const ACTIVE_DOCUMENT_STATUSES = new Set<SignatureDocumentStatus>([
  "sent",
  "viewed",
  "partially_signed",
]);

type DocumentRow = {
  id: string;
  document_type: string;
  status: SignatureDocumentStatus;
  active_version_id: string | null;
  row_version: number;
};

type VersionRow = {
  id: string;
  document_id: string;
  version_number: number;
  source_sha256: string;
  field_definition_sha256: string | null;
  locked_at: string | Date | null;
};

type ParticipantRow = {
  id: string;
  document_version_id: string;
  status: SignatureParticipantStatus;
};

type EventRow = {
  id: string;
  document_id: string;
  document_version_id: string;
  participant_id: string | null;
  session_id: string | null;
  event_type: SignatureEventType;
  actor_class: SignatureActorClass;
  actor_admin_id: string | null;
  server_timestamp: string | Date;
  sequence_number: number | bigint;
  version_hash: string;
  controlled_metadata: SignatureEventMetadata | string;
  idempotency_key: string;
  previous_event_digest: string | null;
  event_digest: string;
  key_version: number;
  network_address_digest: string | null;
  user_agent_digest: string | null;
};

function iso(date: Date) {
  return date.toISOString();
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function derivedIdempotencyKey(base: string, purpose: string) {
  const hex = sha256SignatureValue(`${base}:${purpose}`);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function normalizeEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < 3 ||
    normalized.length > 320 ||
    !normalized.includes("@")
  ) {
    throw new Error("signature_participant_email_invalid");
  }
  return normalized;
}

function mapEvent(row: EventRow): SignatureEventRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    documentVersionId: row.document_version_id,
    participantId: row.participant_id,
    sessionId: row.session_id,
    eventType: row.event_type,
    actorClass: row.actor_class,
    actorAdminId: row.actor_admin_id,
    serverTimestamp: iso(new Date(row.server_timestamp)),
    sequenceNumber: Number(row.sequence_number),
    versionHash: row.version_hash,
    controlledMetadata:
      typeof row.controlled_metadata === "string"
        ? JSON.parse(row.controlled_metadata)
        : row.controlled_metadata,
    idempotencyKey: row.idempotency_key,
    previousEventDigest: row.previous_event_digest,
    eventDigest: row.event_digest,
    keyVersion: row.key_version,
    networkAddressDigest: row.network_address_digest,
    userAgentDigest: row.user_agent_digest,
  };
}

export function createSignatureDomainServices({
  database,
  eventHmacKey,
  eventHmacKeyVersion,
  resolveEventHmacKey,
  networkEvidenceHmacKey,
  clock = () => new Date(),
}: {
  database: SignatureDatabase;
  eventHmacKey: Uint8Array | string;
  eventHmacKeyVersion: number;
  resolveEventHmacKey?: (
    keyVersion: number
  ) => Uint8Array | string | null;
  networkEvidenceHmacKey: Uint8Array | string;
  clock?: SignatureClock;
}) {
  if (eventHmacKeyVersion < 1 || eventHmacKeyVersion > 1_000_000) {
    throw new Error("signature_event_key_version_invalid");
  }
  const resolveVerificationKey =
    resolveEventHmacKey ??
    ((keyVersion: number) =>
      keyVersion === eventHmacKeyVersion ? eventHmacKey : null);

  async function appendEventInTransaction(
    transaction: SignatureQueryExecutor,
    input: {
      documentId: string;
      documentVersionId: string;
      participantId?: string | null;
      sessionId?: string | null;
      eventType: SignatureEventType;
      actorClass: SignatureActorClass;
      actorAdminId?: string | null;
      versionHash: string;
      controlledMetadata?: SignatureEventMetadata;
      idempotencyKey: string;
      networkAddress?: string | null;
      userAgent?: string | null;
    }
  ) {
    await transaction.unsafe(
      `SELECT id FROM public.signature_documents WHERE id = $1::uuid FOR UPDATE`,
      [input.documentId]
    );
    const controlledMetadata = input.controlledMetadata ?? {};
    const networkAddressDigest = hashPseudonymousEvidence(
      networkEvidenceHmacKey,
      input.networkAddress
    );
    const userAgentDigest = hashPseudonymousEvidence(
      networkEvidenceHmacKey,
      input.userAgent
    );
    const existing = await transaction.unsafe<EventRow>(
      `SELECT id::text, document_id::text, document_version_id::text,
              participant_id::text, session_id::text, event_type, actor_class,
              actor_admin_id::text, server_timestamp, sequence_number,
              version_hash, controlled_metadata, idempotency_key::text,
              previous_event_digest, event_digest, key_version,
              network_address_digest, user_agent_digest
         FROM public.signature_events
        WHERE document_id = $1::uuid AND idempotency_key = $2::uuid`,
      [input.documentId, input.idempotencyKey]
    );
    if (existing[0]) {
      const mapped = mapEvent(existing[0]);
      if (
        mapped.documentVersionId !== input.documentVersionId ||
        mapped.eventType !== input.eventType ||
        mapped.participantId !== (input.participantId ?? null) ||
        mapped.sessionId !== (input.sessionId ?? null) ||
        mapped.actorClass !== input.actorClass ||
        mapped.actorAdminId !== (input.actorAdminId ?? null) ||
        mapped.versionHash !== input.versionHash ||
        canonicalSignatureJson(mapped.controlledMetadata) !==
          canonicalSignatureJson(controlledMetadata) ||
        mapped.networkAddressDigest !== networkAddressDigest ||
        mapped.userAgentDigest !== userAgentDigest
      ) {
        throw new Error("signature_event_idempotency_conflict");
      }
      return mapped;
    }

    const previous = await transaction.unsafe<{
      sequence_number: number | bigint;
      event_digest: string;
    }>(
      `SELECT sequence_number, event_digest
         FROM public.signature_events
        WHERE document_id = $1::uuid
        ORDER BY sequence_number DESC
        LIMIT 1`,
      [input.documentId]
    );
    const sequenceNumber = previous[0]
      ? Number(previous[0].sequence_number) + 1
      : 1;
    const previousEventDigest = previous[0]?.event_digest ?? null;
    const serverTimestamp = iso(clock());
    const digestInput = {
      documentId: input.documentId,
      documentVersionId: input.documentVersionId,
      participantId: input.participantId ?? null,
      sessionId: input.sessionId ?? null,
      eventType: input.eventType,
      actorClass: input.actorClass,
      actorAdminId: input.actorAdminId ?? null,
      serverTimestamp,
      sequenceNumber,
      versionHash: input.versionHash,
      controlledMetadata,
      idempotencyKey: input.idempotencyKey,
      previousEventDigest,
      keyVersion: eventHmacKeyVersion,
      networkAddressDigest,
      userAgentDigest,
    } as const;
    const eventDigest = createSignatureEventDigest(eventHmacKey, digestInput);
    const rows = await transaction.unsafe<EventRow>(
      `INSERT INTO public.signature_events (
         document_id, document_version_id, participant_id, session_id,
         event_type, actor_class, actor_admin_id, server_timestamp,
         sequence_number, version_hash, controlled_metadata, idempotency_key,
         previous_event_digest, event_digest, key_version,
         network_address_digest, user_agent_digest
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7::uuid, $8::timestamptz,
         $9, $10, $11::text::jsonb, $12::uuid, $13, $14, $15, $16, $17
       )
       RETURNING id::text, document_id::text, document_version_id::text,
                 participant_id::text, session_id::text, event_type, actor_class,
                 actor_admin_id::text, server_timestamp, sequence_number,
                 version_hash, controlled_metadata, idempotency_key::text,
                 previous_event_digest, event_digest, key_version,
                 network_address_digest, user_agent_digest`,
      [
        input.documentId,
        input.documentVersionId,
        input.participantId ?? null,
        input.sessionId ?? null,
        input.eventType,
        input.actorClass,
        input.actorAdminId ?? null,
        serverTimestamp,
        sequenceNumber,
        input.versionHash,
        canonicalSignatureJson(controlledMetadata),
        input.idempotencyKey,
        previousEventDigest,
        eventDigest,
        eventHmacKeyVersion,
        networkAddressDigest,
        userAgentDigest,
      ]
    );
    return mapEvent(rows[0]);
  }

  async function createDraftDocument(input: {
    title: string;
    documentType: string;
    createdByAdminId: string;
    canonicalLeadId?: string | null;
    leadGroupId?: string | null;
    expiresAt?: Date | null;
  }) {
    if (!getSignatureDocumentTypeDefinition(input.documentType)) {
      throw new Error("signature_document_type_unknown");
    }
    return database.begin(async (transaction) => {
      const rows = await transaction.unsafe<{ id: string }>(
        `INSERT INTO public.signature_documents (
           canonical_lead_id, lead_group_id, title, document_type,
           created_by_admin_id, expires_at
         ) VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6::timestamptz)
         RETURNING id::text`,
        [
          input.canonicalLeadId ?? null,
          input.leadGroupId ?? null,
          input.title,
          input.documentType,
          input.createdByAdminId,
          input.expiresAt ? iso(input.expiresAt) : null,
        ]
      );
      return { documentId: rows[0].id, status: "draft" as const };
    });
  }

  async function createDraftWithVersion(input: {
    documentId: string;
    title: string;
    documentType: string;
    createdByAdminId: string;
    canonicalLeadId?: string | null;
    leadGroupId?: string | null;
    expiresAt?: Date | null;
    filename: string;
    byteCount: number;
    pageCount: number;
    sourceSha256: string;
    pageGeometryManifest: unknown;
    documentCreatedIdempotencyKey: string;
    versionCreatedIdempotencyKey: string;
  }) {
    if (!getSignatureDocumentTypeDefinition(input.documentType)) {
      throw new Error("signature_document_type_unknown");
    }
    const sourceR2Key = signatureSourceR2Key(
      input.documentId,
      1,
      input.sourceSha256
    );
    return database.begin(async (transaction) => {
      await transaction.unsafe(
        `INSERT INTO public.signature_documents (
           id, canonical_lead_id, lead_group_id, title, document_type,
           created_by_admin_id, expires_at
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::uuid, $7::timestamptz)`,
        [
          input.documentId,
          input.canonicalLeadId ?? null,
          input.leadGroupId ?? null,
          input.title,
          input.documentType,
          input.createdByAdminId,
          input.expiresAt ? iso(input.expiresAt) : null,
        ]
      );
      const versions = await transaction.unsafe<{ id: string }>(
        `INSERT INTO public.signature_document_versions (
           document_id, version_number, source_r2_key, filename_snapshot,
           mime_type, byte_count, page_count, source_sha256,
           page_geometry_manifest, created_by_admin_id
         ) VALUES ($1::uuid, 1, $2, $3, 'application/pdf', $4, $5, $6,
                   $7::text::jsonb, $8::uuid)
         RETURNING id::text`,
        [
          input.documentId,
          sourceR2Key,
          input.filename,
          input.byteCount,
          input.pageCount,
          input.sourceSha256,
          canonicalSignatureJson(input.pageGeometryManifest),
          input.createdByAdminId,
        ]
      );
      await transaction.unsafe(
        `UPDATE public.signature_documents SET active_version_id=$2::uuid
          WHERE id=$1::uuid`,
        [input.documentId, versions[0].id]
      );
      await appendEventInTransaction(transaction, {
        documentId: input.documentId,
        documentVersionId: versions[0].id,
        eventType: "document_created",
        actorClass: "admin",
        actorAdminId: input.createdByAdminId,
        versionHash: input.sourceSha256,
        idempotencyKey: input.documentCreatedIdempotencyKey,
      });
      await appendEventInTransaction(transaction, {
        documentId: input.documentId,
        documentVersionId: versions[0].id,
        eventType: "version_created",
        actorClass: "admin",
        actorAdminId: input.createdByAdminId,
        versionHash: input.sourceSha256,
        controlledMetadata: { source_sha256: input.sourceSha256 },
        idempotencyKey: input.versionCreatedIdempotencyKey,
      });
      return {
        documentId: input.documentId,
        documentVersionId: versions[0].id,
        versionNumber: 1,
        sourceR2Key,
      };
    });
  }

  async function createVersion(input: {
    documentId: string;
    createdByAdminId: string;
    filename: string;
    byteCount: number;
    pageCount: number;
    sourceSha256: string;
    pageGeometryManifest: unknown;
    idempotencyKey: string;
  }) {
    return database.begin(async (transaction) => {
      const documents = await transaction.unsafe<DocumentRow>(
        `SELECT id::text, document_type, status, active_version_id::text, row_version
           FROM public.signature_documents WHERE id = $1::uuid FOR UPDATE`,
        [input.documentId]
      );
      if (!documents[0] || documents[0].status !== "draft") {
        throw new Error("signature_version_requires_draft");
      }
      const next = await transaction.unsafe<{ version_number: number }>(
        `SELECT coalesce(max(version_number), 0)::integer + 1 AS version_number
           FROM public.signature_document_versions
          WHERE document_id = $1::uuid`,
        [input.documentId]
      );
      const versionNumber = next[0].version_number;
      const sourceR2Key = signatureSourceR2Key(
        input.documentId,
        versionNumber,
        input.sourceSha256
      );
      const versions = await transaction.unsafe<{ id: string }>(
        `INSERT INTO public.signature_document_versions (
           document_id, version_number, source_r2_key, filename_snapshot,
           mime_type, byte_count, page_count, source_sha256,
           page_geometry_manifest, created_by_admin_id
         ) VALUES (
           $1::uuid, $2, $3, $4, 'application/pdf', $5, $6, $7,
           $8::text::jsonb, $9::uuid
         ) RETURNING id::text`,
        [
          input.documentId,
          versionNumber,
          sourceR2Key,
          input.filename,
          input.byteCount,
          input.pageCount,
          input.sourceSha256,
          canonicalSignatureJson(input.pageGeometryManifest),
          input.createdByAdminId,
        ]
      );
      await transaction.unsafe(
        `UPDATE public.signature_documents SET active_version_id = $2::uuid
          WHERE id = $1::uuid`,
        [input.documentId, versions[0].id]
      );
      await appendEventInTransaction(transaction, {
        documentId: input.documentId,
        documentVersionId: versions[0].id,
        eventType: "version_created",
        actorClass: "admin",
        actorAdminId: input.createdByAdminId,
        versionHash: input.sourceSha256,
        controlledMetadata: { source_sha256: input.sourceSha256 },
        idempotencyKey: input.idempotencyKey,
      });
      return {
        documentId: input.documentId,
        documentVersionId: versions[0].id,
        versionNumber,
        sourceR2Key,
      };
    });
  }

  async function addParticipant(input: {
    documentVersionId: string;
    canonicalLeadId?: string | null;
    nameSnapshot: string;
    emailSnapshot: string;
    phoneSnapshot?: string | null;
    role: string;
    routingOrder?: number | null;
    actorAdminId: string;
    idempotencyKey: string;
  }) {
    return database.begin(async (transaction) => {
      const versions = await transaction.unsafe<VersionRow>(
        `SELECT id::text, document_id::text, version_number, source_sha256,
                field_definition_sha256, locked_at
           FROM public.signature_document_versions
          WHERE id = $1::uuid FOR UPDATE`,
        [input.documentVersionId]
      );
      if (!versions[0] || versions[0].locked_at) {
        throw new Error("signature_participant_requires_unlocked_version");
      }
      const normalizedEmail = normalizeEmail(input.emailSnapshot);
      const participants = await transaction.unsafe<{ id: string }>(
        `INSERT INTO public.signature_participants (
           document_version_id, canonical_lead_id, name_snapshot,
           email_snapshot, normalized_email, phone_snapshot, role, routing_order
         ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8)
         RETURNING id::text`,
        [
          input.documentVersionId,
          input.canonicalLeadId ?? null,
          input.nameSnapshot,
          input.emailSnapshot,
          normalizedEmail,
          input.phoneSnapshot ?? null,
          input.role,
          input.routingOrder ?? null,
        ]
      );
      await appendEventInTransaction(transaction, {
        documentId: versions[0].document_id,
        documentVersionId: input.documentVersionId,
        participantId: participants[0].id,
        eventType: "participant_added",
        actorClass: "admin",
        actorAdminId: input.actorAdminId,
        versionHash: versions[0].source_sha256,
        idempotencyKey: input.idempotencyKey,
      });
      return { participantId: participants[0].id, normalizedEmail };
    });
  }

  async function addField(input: {
    documentVersionId: string;
    participantId: string;
    fieldType: SignatureFieldType;
    pageIndex: number;
    rect: Readonly<{ x: number; y: number; width: number; height: number }>;
    pageGeometryReference: unknown;
    label: string;
    required?: boolean;
    tabOrder: number;
    validationLimits?: Readonly<Record<string, number>>;
    actorAdminId: string;
    idempotencyKey: string;
  }) {
    return database.begin(async (transaction) => {
      const versions = await transaction.unsafe<VersionRow>(
        `SELECT id::text, document_id::text, version_number, source_sha256,
                field_definition_sha256, locked_at
           FROM public.signature_document_versions
          WHERE id = $1::uuid FOR UPDATE`,
        [input.documentVersionId]
      );
      if (!versions[0] || versions[0].locked_at) {
        throw new Error("signature_field_requires_unlocked_version");
      }
      const definition = {
        documentVersionId: input.documentVersionId,
        participantId: input.participantId,
        fieldType: input.fieldType,
        pageIndex: input.pageIndex,
        rect: input.rect,
        pageGeometryReference: input.pageGeometryReference,
        label: input.label,
        required: input.required ?? true,
        tabOrder: input.tabOrder,
        validationLimits: input.validationLimits ?? {},
      };
      const definitionHash = sha256SignatureValue(
        canonicalSignatureJson(definition)
      );
      const fields = await transaction.unsafe<{ id: string }>(
        `INSERT INTO public.signature_fields (
           document_version_id, participant_id, field_type, page_index,
           normalized_x, normalized_y, normalized_width, normalized_height,
           page_geometry_reference, label, required, tab_order,
           validation_limits, immutable_definition_sha256
         ) VALUES (
           $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8,
           $9::text::jsonb, $10, $11, $12, $13::text::jsonb, $14
         ) RETURNING id::text`,
        [
          input.documentVersionId,
          input.participantId,
          input.fieldType,
          input.pageIndex,
          input.rect.x,
          input.rect.y,
          input.rect.width,
          input.rect.height,
          canonicalSignatureJson(input.pageGeometryReference),
          input.label,
          input.required ?? true,
          input.tabOrder,
          canonicalSignatureJson(input.validationLimits ?? {}),
          definitionHash,
        ]
      );
      await appendEventInTransaction(transaction, {
        documentId: versions[0].document_id,
        documentVersionId: input.documentVersionId,
        participantId: input.participantId,
        eventType: "field_added",
        actorClass: "admin",
        actorAdminId: input.actorAdminId,
        versionHash: versions[0].source_sha256,
        controlledMetadata: {
          field_id: fields[0].id,
          field_type: input.fieldType,
        },
        idempotencyKey: input.idempotencyKey,
      });
      return { fieldId: fields[0].id, definitionHash };
    });
  }

  async function updateParticipant(input: {
    participantId: string;
    nameSnapshot: string;
    emailSnapshot: string;
    phoneSnapshot?: string | null;
    role: string;
    routingOrder?: number | null;
    actorAdminId: string;
    idempotencyKey: string;
  }) {
    return database.begin(async (transaction) => {
      const rows = await transaction.unsafe<{
        document_version_id: string;
        document_id: string;
        source_sha256: string;
        locked_at: string | Date | null;
      }>(
        `SELECT p.document_version_id::text, v.document_id::text,
                v.source_sha256, v.locked_at
           FROM public.signature_participants p
           JOIN public.signature_document_versions v ON v.id=p.document_version_id
          WHERE p.id=$1::uuid FOR UPDATE OF p, v`,
        [input.participantId]
      );
      if (!rows[0] || rows[0].locked_at) {
        throw new Error("signature_participant_requires_unlocked_version");
      }
      const normalizedEmail = normalizeEmail(input.emailSnapshot);
      await transaction.unsafe(
        `UPDATE public.signature_participants SET
           name_snapshot=$2, email_snapshot=$3, normalized_email=$4,
           phone_snapshot=$5, role=$6, routing_order=$7
         WHERE id=$1::uuid`,
        [
          input.participantId,
          input.nameSnapshot,
          input.emailSnapshot,
          normalizedEmail,
          input.phoneSnapshot ?? null,
          input.role,
          input.routingOrder ?? null,
        ]
      );
      await appendEventInTransaction(transaction, {
        documentId: rows[0].document_id,
        documentVersionId: rows[0].document_version_id,
        participantId: input.participantId,
        eventType: "participant_updated",
        actorClass: "admin",
        actorAdminId: input.actorAdminId,
        versionHash: rows[0].source_sha256,
        idempotencyKey: input.idempotencyKey,
      });
      return { participantId: input.participantId, normalizedEmail };
    });
  }

  async function updateField(input: {
    fieldId: string;
    participantId: string;
    fieldType: SignatureFieldType;
    pageIndex: number;
    rect: Readonly<{ x: number; y: number; width: number; height: number }>;
    pageGeometryReference: unknown;
    label: string;
    required: boolean;
    tabOrder: number;
    validationLimits?: Readonly<Record<string, number>>;
    actorAdminId: string;
    idempotencyKey: string;
  }) {
    return database.begin(async (transaction) => {
      const rows = await transaction.unsafe<{
        document_version_id: string;
        document_id: string;
        source_sha256: string;
        locked_at: string | Date | null;
      }>(
        `SELECT f.document_version_id::text, v.document_id::text,
                v.source_sha256, v.locked_at
           FROM public.signature_fields f
           JOIN public.signature_document_versions v ON v.id=f.document_version_id
          WHERE f.id=$1::uuid FOR UPDATE OF f, v`,
        [input.fieldId]
      );
      if (!rows[0] || rows[0].locked_at) {
        throw new Error("signature_field_requires_unlocked_version");
      }
      const definition = {
        documentVersionId: rows[0].document_version_id,
        participantId: input.participantId,
        fieldType: input.fieldType,
        pageIndex: input.pageIndex,
        rect: input.rect,
        pageGeometryReference: input.pageGeometryReference,
        label: input.label,
        required: input.required,
        tabOrder: input.tabOrder,
        validationLimits: input.validationLimits ?? {},
      };
      const definitionHash = sha256SignatureValue(canonicalSignatureJson(definition));
      await transaction.unsafe(
        `UPDATE public.signature_fields SET
           participant_id=$2::uuid, field_type=$3, page_index=$4,
           normalized_x=$5, normalized_y=$6,
           normalized_width=$7, normalized_height=$8,
           page_geometry_reference=$9::text::jsonb, label=$10, required=$11,
           tab_order=$12, validation_limits=$13::text::jsonb,
           immutable_definition_sha256=$14
         WHERE id=$1::uuid`,
        [
          input.fieldId,
          input.participantId,
          input.fieldType,
          input.pageIndex,
          input.rect.x,
          input.rect.y,
          input.rect.width,
          input.rect.height,
          canonicalSignatureJson(input.pageGeometryReference),
          input.label,
          input.required,
          input.tabOrder,
          canonicalSignatureJson(input.validationLimits ?? {}),
          definitionHash,
        ]
      );
      await appendEventInTransaction(transaction, {
        documentId: rows[0].document_id,
        documentVersionId: rows[0].document_version_id,
        participantId: input.participantId,
        eventType: "field_updated",
        actorClass: "admin",
        actorAdminId: input.actorAdminId,
        versionHash: rows[0].source_sha256,
        controlledMetadata: { field_id: input.fieldId, field_type: input.fieldType },
        idempotencyKey: input.idempotencyKey,
      });
      return { fieldId: input.fieldId, definitionHash };
    });
  }

  async function removeField(input: {
    fieldId: string;
    actorAdminId: string;
    idempotencyKey: string;
  }) {
    return database.begin(async (transaction) => {
      const rows = await transaction.unsafe<{
        document_version_id: string;
        participant_id: string;
        document_id: string;
        source_sha256: string;
        field_type: SignatureFieldType;
        locked_at: string | Date | null;
      }>(
        `SELECT f.document_version_id::text, f.participant_id::text,
                f.field_type, v.document_id::text, v.source_sha256, v.locked_at
           FROM public.signature_fields f
           JOIN public.signature_document_versions v ON v.id=f.document_version_id
          WHERE f.id=$1::uuid FOR UPDATE OF f, v`,
        [input.fieldId]
      );
      if (!rows[0] || rows[0].locked_at) {
        throw new Error("signature_field_requires_unlocked_version");
      }
      await transaction.unsafe(`DELETE FROM public.signature_fields WHERE id=$1::uuid`, [
        input.fieldId,
      ]);
      await appendEventInTransaction(transaction, {
        documentId: rows[0].document_id,
        documentVersionId: rows[0].document_version_id,
        participantId: rows[0].participant_id,
        eventType: "field_removed",
        actorClass: "admin",
        actorAdminId: input.actorAdminId,
        versionHash: rows[0].source_sha256,
        controlledMetadata: { field_id: input.fieldId, field_type: rows[0].field_type },
        idempotencyKey: input.idempotencyKey,
      });
      return { removed: true };
    });
  }

  async function prepareDocumentForSend(input: {
    documentId: string;
    actorAdminId: string;
    idempotencyKey: string;
    locale?: "es-PR" | "en-US";
    publicSigningEnabled?: boolean;
    privacyDisclosure: Readonly<{
      version: string;
      approvalReference: string;
      effectiveFrom: string;
      esPRSha256: string;
      enUSSha256: string;
    }>;
  }) {
    return database.begin(async (transaction) => {
      const documents = await transaction.unsafe<DocumentRow>(
        `SELECT id::text, document_type, status, active_version_id::text, row_version
           FROM public.signature_documents WHERE id = $1::uuid FOR UPDATE`,
        [input.documentId]
      );
      const document = documents[0];
      if (!document || document.status !== "draft" || !document.active_version_id) {
        throw new Error("signature_send_requires_complete_draft");
      }
      if (!input.publicSigningEnabled) {
        throw new Error("public_signing_disabled");
      }
      if (
        !/^[a-z0-9][a-z0-9._-]{0,99}$/.test(input.privacyDisclosure.version) ||
        !/^[0-9a-f]{64}$/.test(input.privacyDisclosure.esPRSha256) ||
        !/^[0-9a-f]{64}$/.test(input.privacyDisclosure.enUSSha256) ||
        !input.privacyDisclosure.approvalReference.trim() ||
        Number.isNaN(Date.parse(input.privacyDisclosure.effectiveFrom)) ||
        new Date(input.privacyDisclosure.effectiveFrom).getTime() > clock().getTime()
      ) {
        throw new Error("signature_privacy_disclosure_invalid");
      }
      const approvalRows = await transaction.unsafe<{
        id: string; approval_reference: string;
      }>(
        `SELECT id::text, approval_reference
           FROM public.signature_document_type_approvals
          WHERE document_type=$1 AND status='approved' AND revoked_at IS NULL
            AND effective_from <= $2::timestamptz
          ORDER BY effective_from DESC LIMIT 1 FOR UPDATE`,
        [document.document_type, iso(clock())]
      );
      if (!approvalRows[0]) {
        throw new Error("signature_document_type_not_counsel_approved");
      }
      const locale = input.locale ?? "es-PR";
      const consentRows = await transaction.unsafe<{
        id: string; version_identifier: string; consent_text_sha256: string;
      }>(
        `SELECT id::text, version_identifier, consent_text_sha256
           FROM public.signature_consent_versions
          WHERE locale=$1 AND status='approved' AND effective_from <= $2::timestamptz
          ORDER BY effective_from DESC LIMIT 1 FOR UPDATE`,
        [locale, iso(clock())]
      );
      if (!consentRows[0]) throw new Error("signature_approved_consent_missing");
      const versions = await transaction.unsafe<VersionRow>(
        `SELECT id::text, document_id::text, version_number, source_sha256,
                field_definition_sha256, locked_at
           FROM public.signature_document_versions
          WHERE id = $1::uuid FOR UPDATE`,
        [document.active_version_id]
      );
      const fieldRows = await transaction.unsafe<{
        participant_id: string;
        field_type: SignatureFieldType;
        page_index: number;
        normalized_x: string | number;
        normalized_y: string | number;
        normalized_width: string | number;
        normalized_height: string | number;
        required: boolean;
        tab_order: number;
        validation_limits: Record<string, number> | string;
      }>(
        `SELECT participant_id::text, field_type, page_index,
                normalized_x, normalized_y, normalized_width, normalized_height,
                required, tab_order, validation_limits
           FROM public.signature_fields
          WHERE document_version_id = $1::uuid
          ORDER BY tab_order, id`,
        [document.active_version_id]
      );
      const participantCount = await transaction.unsafe<{
        count: number | bigint; invalid_emails: number | bigint; without_required_fields: number | bigint;
      }>(
        `SELECT count(*) AS count,
                count(*) FILTER (WHERE normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') AS invalid_emails,
                count(*) FILTER (WHERE NOT EXISTS (
                  SELECT 1 FROM public.signature_fields f
                   WHERE f.participant_id=p.id AND f.required
                )) AS without_required_fields
           FROM public.signature_participants p
          WHERE document_version_id = $1::uuid`,
        [document.active_version_id]
      );
      if (!versions[0] || fieldRows.length === 0 || Number(participantCount[0].count) === 0) {
        throw new Error("signature_send_requires_participants_and_fields");
      }
      if (Number(participantCount[0].invalid_emails) > 0) {
        throw new Error("signature_send_participant_email_invalid");
      }
      if (Number(participantCount[0].without_required_fields) > 0) {
        throw new Error("signature_send_required_fields_missing");
      }
      const expirationRows = await transaction.unsafe<{ expires_at: string | Date | null }>(
        `SELECT expires_at FROM public.signature_documents WHERE id=$1::uuid`,
        [input.documentId]
      );
      if (!expirationRows[0]?.expires_at || new Date(expirationRows[0].expires_at).getTime() <= clock().getTime()) {
        throw new Error("signature_send_expiration_invalid");
      }
      const fieldDefinitionSha256 = hashSignatureFieldDefinition({
        documentVersionId: document.active_version_id,
        fields: fieldRows.map((row) => ({
          participantId: row.participant_id,
          fieldType: row.field_type,
          pageIndex: row.page_index,
          normalizedX: Number(row.normalized_x),
          normalizedY: Number(row.normalized_y),
          normalizedWidth: Number(row.normalized_width),
          normalizedHeight: Number(row.normalized_height),
          required: row.required,
          tabOrder: row.tab_order,
          validationLimits:
            typeof row.validation_limits === "string"
              ? JSON.parse(row.validation_limits)
              : row.validation_limits,
        })),
      });
      const sentAt = iso(clock());
      await transaction.unsafe(
        `UPDATE public.signature_document_versions
            SET field_definition_sha256 = $2, locked_at = $3::timestamptz
          WHERE id = $1::uuid`,
        [document.active_version_id, fieldDefinitionSha256, sentAt]
      );
      await transaction.unsafe(
        `UPDATE public.signature_documents
            SET document_type_approval_reference = $2,
                document_type_approval_id = $5::uuid,
                consent_version_id = $6::uuid,
                privacy_disclosure_version = $7,
                privacy_disclosure_es_pr_sha256 = $8,
                privacy_disclosure_en_us_sha256 = $9,
                privacy_disclosure_effective_from = $10::timestamptz,
                privacy_disclosure_approval_reference = $11,
                status = 'sent', sent_at = $3::timestamptz
          WHERE id = $1::uuid AND row_version = $4`,
        [
          input.documentId,
          approvalRows[0].approval_reference,
          sentAt,
          document.row_version,
          approvalRows[0].id,
          consentRows[0].id,
          input.privacyDisclosure.version,
          input.privacyDisclosure.esPRSha256,
          input.privacyDisclosure.enUSSha256,
          input.privacyDisclosure.effectiveFrom,
          input.privacyDisclosure.approvalReference,
        ]
      );
      await appendEventInTransaction(transaction, {
        documentId: input.documentId,
        documentVersionId: document.active_version_id,
        eventType: "send_prepared",
        actorClass: "admin",
        actorAdminId: input.actorAdminId,
        versionHash: versions[0].source_sha256,
        controlledMetadata: {
          document_status: "sent",
          consent_version: consentRows[0].version_identifier,
          consent_text_sha256: consentRows[0].consent_text_sha256,
          locale,
          approval_status: "approved",
        },
        idempotencyKey: input.idempotencyKey,
      });
      await appendEventInTransaction(transaction, {
        documentId: input.documentId,
        documentVersionId: document.active_version_id,
        eventType: "document_sent",
        actorClass: "admin",
        actorAdminId: input.actorAdminId,
        versionHash: versions[0].source_sha256,
        controlledMetadata: { document_status: "sent" },
        idempotencyKey: derivedIdempotencyKey(input.idempotencyKey, "document_sent"),
      });
      return {
        status: "sent" as const,
        fieldDefinitionSha256,
        approvalReference: approvalRows[0].approval_reference,
        consentVersionId: consentRows[0].id,
        consentVersion: consentRows[0].version_identifier,
        consentTextSha256: consentRows[0].consent_text_sha256,
        locale,
      };
    });
  }

  async function transitionDocumentState(input: {
    documentId: string;
    targetStatus: Exclude<SignatureDocumentStatus, "draft" | "sent">;
    actorClass: SignatureActorClass;
    actorAdminId?: string | null;
    participantId?: string | null;
    sessionId?: string | null;
    reason?: string | null;
    idempotencyKey: string;
  }) {
    return database.begin(async (transaction) => {
      const documents = await transaction.unsafe<DocumentRow>(
        `SELECT id::text, document_type, status, active_version_id::text, row_version
           FROM public.signature_documents WHERE id = $1::uuid FOR UPDATE`,
        [input.documentId]
      );
      const document = documents[0];
      if (!document?.active_version_id) {
        throw new Error("signature_document_not_found");
      }
      assertAllowedDocumentTransition(document.status, input.targetStatus);
      const versions = await transaction.unsafe<VersionRow>(
        `SELECT id::text, document_id::text, version_number, source_sha256,
                field_definition_sha256, locked_at
           FROM public.signature_document_versions WHERE id = $1::uuid`,
        [document.active_version_id]
      );
      const now = iso(clock());
      await transaction.unsafe(
        `UPDATE public.signature_documents SET
           status = $2,
           completed_at = CASE WHEN $2 = 'completed' THEN $3::timestamptz ELSE completed_at END,
           voided_at = CASE WHEN $2 = 'voided' THEN $3::timestamptz ELSE voided_at END,
           void_reason = CASE WHEN $2 = 'voided' THEN $4 ELSE void_reason END
         WHERE id = $1::uuid AND row_version = $5`,
        [
          input.documentId,
          input.targetStatus,
          now,
          input.reason ?? null,
          document.row_version,
        ]
      );
      const eventType: SignatureEventType =
        input.targetStatus === "viewed"
          ? "document_viewed"
          : input.targetStatus === "partially_signed"
            ? "document_partially_signed"
            : input.targetStatus === "completed"
              ? "document_completed"
              : input.targetStatus === "voided"
                ? "document_voided"
                : "document_expired";
      await appendEventInTransaction(transaction, {
        documentId: input.documentId,
        documentVersionId: document.active_version_id,
        participantId: input.participantId ?? null,
        sessionId: input.sessionId ?? null,
        eventType,
        actorClass: input.actorClass,
        actorAdminId: input.actorAdminId ?? null,
        versionHash: versions[0].source_sha256,
        controlledMetadata: {
          document_status: input.targetStatus,
          ...(input.reason ? { reason_code: input.reason } : {}),
        },
        idempotencyKey: input.idempotencyKey,
      });
      return { status: input.targetStatus };
    });
  }

  async function transitionParticipantState(input: {
    participantId: string;
    targetStatus: Exclude<SignatureParticipantStatus, "pending">;
    actorClass: SignatureActorClass;
    actorAdminId?: string | null;
    sessionId?: string | null;
    idempotencyKey: string;
  }) {
    return database.begin(async (transaction) => {
      const participants = await transaction.unsafe<ParticipantRow>(
        `SELECT id::text, document_version_id::text, status
           FROM public.signature_participants WHERE id = $1::uuid FOR UPDATE`,
        [input.participantId]
      );
      const participant = participants[0];
      if (!participant) throw new Error("signature_participant_not_found");
      assertAllowedParticipantTransition(participant.status, input.targetStatus);
      const versions = await transaction.unsafe<VersionRow>(
        `SELECT id::text, document_id::text, version_number, source_sha256,
                field_definition_sha256, locked_at
           FROM public.signature_document_versions WHERE id = $1::uuid`,
        [participant.document_version_id]
      );
      const now = iso(clock());
      const timestampColumn =
        input.targetStatus === "invited"
          ? "invited_at"
          : input.targetStatus === "viewed"
            ? "viewed_at"
            : input.targetStatus === "consented"
              ? "consented_at"
              : input.targetStatus === "completed"
                ? "completed_at"
                : null;
      await transaction.unsafe(
        `UPDATE public.signature_participants SET
           status = $2,
           invited_at = CASE WHEN $3 = 'invited_at' THEN $4::timestamptz ELSE invited_at END,
           viewed_at = CASE WHEN $3 = 'viewed_at' THEN $4::timestamptz ELSE viewed_at END,
           consented_at = CASE WHEN $3 = 'consented_at' THEN $4::timestamptz ELSE consented_at END,
           completed_at = CASE WHEN $3 = 'completed_at' THEN $4::timestamptz ELSE completed_at END
         WHERE id = $1::uuid`,
        [input.participantId, input.targetStatus, timestampColumn, now]
      );
      const eventType = `participant_${input.targetStatus}` as SignatureEventType;
      await appendEventInTransaction(transaction, {
        documentId: versions[0].document_id,
        documentVersionId: participant.document_version_id,
        participantId: input.participantId,
        sessionId: input.sessionId ?? null,
        eventType,
        actorClass: input.actorClass,
        actorAdminId: input.actorAdminId ?? null,
        versionHash: versions[0].source_sha256,
        controlledMetadata: { participant_status: input.targetStatus },
        idempotencyKey: input.idempotencyKey,
      });
      return { status: input.targetStatus };
    });
  }

  async function appendEvent(input: Parameters<typeof appendEventInTransaction>[1]) {
    return database.begin((transaction) => appendEventInTransaction(transaction, input));
  }

  async function issueSigningToken(input: {
    participantId: string;
    documentVersionId: string;
    expiresAt: Date;
    keyVersion: number;
    actorAdminId: string;
    idempotencyKey: string;
    supersedeExisting?: boolean;
    purpose?: "sign_document" | "completed_document_access";
  }) {
    const material = createSigningTokenMaterial();
    return database.begin(async (transaction) => {
      const rows = await transaction.unsafe<{
        document_id: string;
        source_sha256: string;
        status: SignatureDocumentStatus;
        active_version_id: string;
      }>(
        `SELECT v.document_id::text, v.source_sha256, d.status,
                d.active_version_id::text
           FROM public.signature_participants p
           JOIN public.signature_document_versions v ON v.id = p.document_version_id
           JOIN public.signature_documents d ON d.id = v.document_id
          WHERE p.id = $1::uuid AND p.document_version_id = $2::uuid
          FOR UPDATE OF p, d`,
        [input.participantId, input.documentVersionId]
      );
      const binding = rows[0];
      const purpose = input.purpose ?? "sign_document";
      const statusEligible = purpose === "sign_document"
        ? ACTIVE_DOCUMENT_STATUSES.has(binding?.status)
        : binding?.status === "completed";
      if (!binding || !statusEligible || binding.active_version_id !== input.documentVersionId) {
        throw new Error("signature_token_binding_not_active");
      }
      const active = await transaction.unsafe<{ id: string }>(
        `SELECT id::text FROM public.signature_signing_tokens
          WHERE participant_id = $1::uuid AND document_version_id = $2::uuid
            AND purpose=$4 AND consumed_at IS NULL AND revoked_at IS NULL AND superseded_at IS NULL
            AND expires_at > $3::timestamptz
          FOR UPDATE`,
        [input.participantId, input.documentVersionId, iso(clock()), purpose]
      );
      if (active.length > 0 && !input.supersedeExisting) {
        throw new Error("signature_active_token_exists");
      }
      if (active.length > 0) {
        await transaction.unsafe(
          `UPDATE public.signature_signing_tokens SET superseded_at = $2::timestamptz
            WHERE participant_id = $1::uuid AND consumed_at IS NULL
              AND revoked_at IS NULL AND purpose=$3
              AND superseded_at IS NULL`,
          [input.participantId, iso(clock()), purpose]
        );
      }
      const tokenRows = await transaction.unsafe<{ id: string }>(
        `INSERT INTO public.signature_signing_tokens (
           participant_id, document_version_id, token_digest, purpose, key_version,
           issued_at, expires_at
         ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::timestamptz, $7::timestamptz)
         RETURNING id::text`,
        [
          input.participantId,
          input.documentVersionId,
          material.digest,
          purpose,
          input.keyVersion,
          iso(clock()),
          iso(input.expiresAt),
        ]
      );
      await appendEventInTransaction(transaction, {
        documentId: binding.document_id,
        documentVersionId: input.documentVersionId,
        participantId: input.participantId,
        eventType: active.length ? "token_superseded" : "token_issued",
        actorClass: "admin",
        actorAdminId: input.actorAdminId,
        versionHash: binding.source_sha256,
        idempotencyKey: input.idempotencyKey,
      });
      return {
        tokenId: tokenRows[0].id,
        plaintextToken: material.plaintext,
        expiresAt: iso(input.expiresAt),
      };
    });
  }

  async function revokeSigningToken(input: {
    tokenId: string;
    actorAdminId: string;
    idempotencyKey: string;
  }) {
    return database.begin(async (transaction) => {
      const tokens = await transaction.unsafe<{
        participant_id: string;
        document_version_id: string;
        document_id: string;
        source_sha256: string;
      }>(
        `SELECT t.participant_id::text, t.document_version_id::text,
                v.document_id::text, v.source_sha256
           FROM public.signature_signing_tokens t
           JOIN public.signature_document_versions v ON v.id = t.document_version_id
          WHERE t.id = $1::uuid FOR UPDATE OF t`,
        [input.tokenId]
      );
      if (!tokens[0]) throw new Error("signature_token_not_found");
      await transaction.unsafe(
        `UPDATE public.signature_signing_tokens SET revoked_at = coalesce(revoked_at, $2::timestamptz)
          WHERE id = $1::uuid`,
        [input.tokenId, iso(clock())]
      );
      await appendEventInTransaction(transaction, {
        documentId: tokens[0].document_id,
        documentVersionId: tokens[0].document_version_id,
        participantId: tokens[0].participant_id,
        eventType: "token_revoked",
        actorClass: "admin",
        actorAdminId: input.actorAdminId,
        versionHash: tokens[0].source_sha256,
        idempotencyKey: input.idempotencyKey,
      });
      return { revoked: true };
    });
  }

  async function createSignerSession(input: {
    plaintextToken: string;
    participantId: string;
    documentVersionId: string;
    idempotencyKey: string;
    networkAddress?: string | null;
    userAgent?: string | null;
    purpose?: "sign_document" | "completed_document_access";
  }) {
    const material = createSignerSessionMaterial();
    return database.begin(async (transaction) => {
      const digest = sha256SignatureValue(input.plaintextToken);
      const tokens = await transaction.unsafe<{
        id: string;
        participant_id: string;
        document_version_id: string;
        token_digest: string;
        expires_at: string | Date;
        consumed_at: string | Date | null;
        revoked_at: string | Date | null;
        superseded_at: string | Date | null;
        document_id: string;
        source_sha256: string;
        participant_status: SignatureParticipantStatus;
        document_status: SignatureDocumentStatus;
        purpose: "sign_document" | "completed_document_access";
      }>(
        `SELECT t.id::text, t.participant_id::text, t.document_version_id::text,
                t.token_digest, t.expires_at, t.consumed_at,
                t.revoked_at, t.superseded_at,
                v.document_id::text, v.source_sha256,
                p.status AS participant_status, d.status AS document_status, t.purpose
           FROM public.signature_signing_tokens t
           JOIN public.signature_participants p ON p.id = t.participant_id
           JOIN public.signature_document_versions v ON v.id = t.document_version_id
           JOIN public.signature_documents d ON d.id = v.document_id
          WHERE t.token_digest = $1 FOR UPDATE OF t`,
        [digest]
      );
      const token = tokens[0];
      const now = clock();
      const purpose = input.purpose ?? "sign_document";
      if (
        !token ||
        token.purpose !== purpose ||
        !verifySigningToken({
          plaintext: input.plaintextToken,
          stored: {
            participantId: token.participant_id,
            documentVersionId: token.document_version_id,
            tokenDigest: token.token_digest,
            expiresAt: token.expires_at,
            consumedAt: token.consumed_at,
            revokedAt: token.revoked_at,
            supersededAt: token.superseded_at,
          },
          expectedParticipantId: input.participantId,
          expectedDocumentVersionId: input.documentVersionId,
          now,
        })
      ) {
        throw new Error("signature_token_verification_failed");
      }
      await transaction.unsafe(
        `UPDATE public.signature_signing_tokens
            SET consumed_at = $2::timestamptz
          WHERE id = $1::uuid AND consumed_at IS NULL`,
        [token.id, iso(now)]
      );
      const tokenExpiry = new Date(token.expires_at);
      const expiresAt = new Date(
        Math.min(tokenExpiry.getTime(), addMinutes(now, SIGNER_SESSION_MAX_MINUTES).getTime())
      );
      const idleExpiresAt = new Date(
        Math.min(expiresAt.getTime(), addMinutes(now, SIGNER_SESSION_IDLE_MINUTES).getTime())
      );
      const sessions = await transaction.unsafe<{ id: string }>(
        `INSERT INTO public.signature_sessions (
           token_id, participant_id, document_version_id,
           session_secret_digest, csrf_nonce_digest, created_at, last_seen_at,
           expires_at, idle_expires_at, purpose
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4, $5, $6::timestamptz,
           $6::timestamptz, $7::timestamptz, $8::timestamptz, $9
         ) RETURNING id::text`,
        [
          token.id,
          input.participantId,
          input.documentVersionId,
          material.sessionSecretDigest,
          material.csrfNonceDigest,
          iso(now),
          iso(expiresAt),
          iso(idleExpiresAt),
          purpose,
        ]
      );
      await appendEventInTransaction(transaction, {
        documentId: token.document_id,
        documentVersionId: input.documentVersionId,
        participantId: input.participantId,
        sessionId: sessions[0].id,
        eventType: "session_created",
        actorClass: "participant",
        versionHash: token.source_sha256,
        idempotencyKey: input.idempotencyKey,
        networkAddress: input.networkAddress,
        userAgent: input.userAgent,
      });
      if (purpose === "sign_document" && token.participant_status === "invited") {
        await transaction.unsafe(
          `UPDATE public.signature_participants SET status='viewed', viewed_at=$2::timestamptz WHERE id=$1::uuid`,
          [input.participantId, iso(now)]
        );
        await appendEventInTransaction(transaction, {
          documentId: token.document_id,
          documentVersionId: input.documentVersionId,
          participantId: input.participantId,
          sessionId: sessions[0].id,
          eventType: "participant_viewed",
          actorClass: "participant",
          versionHash: token.source_sha256,
          idempotencyKey: derivedIdempotencyKey(input.idempotencyKey, "participant_viewed"),
        });
      }
      if (purpose === "sign_document" && token.document_status === "sent") {
        await transaction.unsafe(
          `UPDATE public.signature_documents SET status='viewed' WHERE id=$1::uuid`,
          [token.document_id]
        );
        await appendEventInTransaction(transaction, {
          documentId: token.document_id,
          documentVersionId: input.documentVersionId,
          participantId: input.participantId,
          sessionId: sessions[0].id,
          eventType: "document_viewed",
          actorClass: "participant",
          versionHash: token.source_sha256,
          idempotencyKey: derivedIdempotencyKey(input.idempotencyKey, "document_viewed"),
        });
      }
      return {
        sessionId: sessions[0].id,
        sessionSecret: material.sessionSecret,
        csrfNonce: material.csrfNonce,
        expiresAt: iso(expiresAt),
        idleExpiresAt: iso(idleExpiresAt),
      };
    });
  }

  async function inspectSigningToken(plaintextToken: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(plaintextToken)) return { eligible: false as const };
    const rows = await database.unsafe<{ participant_id: string; document_version_id: string }>(
      `SELECT t.participant_id::text, t.document_version_id::text
         FROM public.signature_signing_tokens t
         JOIN public.signature_participants p ON p.id=t.participant_id
         JOIN public.signature_document_versions v ON v.id=t.document_version_id
         JOIN public.signature_documents d ON d.id=v.document_id
        WHERE t.token_digest=$1 AND t.consumed_at IS NULL AND t.revoked_at IS NULL
          AND t.superseded_at IS NULL AND t.expires_at>$2::timestamptz
          AND t.purpose='sign_document'
          AND p.status IN ('invited','viewed','consented') AND d.status IN ('sent','viewed','partially_signed')
          AND d.active_version_id=t.document_version_id`,
      [sha256SignatureValue(plaintextToken), iso(clock())]
    );
    return rows[0]
      ? { eligible: true as const, participantId: rows[0].participant_id, documentVersionId: rows[0].document_version_id }
      : { eligible: false as const };
  }

  async function redeemSigningToken(input: {
    plaintextToken: string;
    idempotencyKey: string;
    networkAddress?: string | null;
    userAgent?: string | null;
  }) {
    const eligibility = await inspectSigningToken(input.plaintextToken);
    if (!eligibility.eligible) throw new Error("signature_token_verification_failed");
    return createSignerSession({
      plaintextToken: input.plaintextToken,
      participantId: eligibility.participantId,
      documentVersionId: eligibility.documentVersionId,
      idempotencyKey: input.idempotencyKey,
      networkAddress: input.networkAddress,
      userAgent: input.userAgent,
    });
  }

  async function inspectCompletionAccessToken(plaintextToken: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(plaintextToken)) return { eligible: false as const };
    const rows = await database.unsafe<{ participant_id: string; document_version_id: string }>(
      `SELECT t.participant_id::text, t.document_version_id::text
         FROM public.signature_signing_tokens t
         JOIN public.signature_participants p ON p.id=t.participant_id
         JOIN public.signature_document_versions v ON v.id=t.document_version_id
         JOIN public.signature_documents d ON d.id=v.document_id
        WHERE t.token_digest=$1 AND t.purpose='completed_document_access'
          AND t.consumed_at IS NULL AND t.revoked_at IS NULL AND t.superseded_at IS NULL
          AND t.expires_at>$2::timestamptz AND p.status='completed' AND d.status='completed'
          AND d.active_version_id=t.document_version_id`,
      [sha256SignatureValue(plaintextToken), iso(clock())]
    );
    return rows[0]
      ? { eligible: true as const, participantId: rows[0].participant_id, documentVersionId: rows[0].document_version_id }
      : { eligible: false as const };
  }

  async function redeemCompletionAccessToken(input: {
    plaintextToken: string;
    idempotencyKey: string;
    networkAddress?: string | null;
    userAgent?: string | null;
  }) {
    const eligibility = await inspectCompletionAccessToken(input.plaintextToken);
    if (!eligibility.eligible) throw new Error("signature_token_verification_failed");
    return createSignerSession({
      ...input,
      participantId: eligibility.participantId,
      documentVersionId: eligibility.documentVersionId,
      purpose: "completed_document_access",
    });
  }

  async function getSessionContext(input: {
    sessionId: string;
    sessionSecret: string;
    csrfNonce?: string;
    touch?: boolean;
    purpose?: "sign_document" | "completed_document_access";
  }) {
    const rows = await database.unsafe<{
      participant_id: string; document_version_id: string; session_secret_digest: string;
      csrf_nonce_digest: string; expires_at: string | Date; idle_expires_at: string | Date;
      revoked_at: string | Date | null; completed_at: string | Date | null;
      document_id: string; source_sha256: string; field_definition_sha256: string;
      title: string; role: string; participant_status: SignatureParticipantStatus;
      purpose: "sign_document" | "completed_document_access";
      bound_consent_version: string | null; bound_consent_sha256: string | null;
      bound_consent_locale: "es-PR" | "en-US" | null;
    }>(
      `SELECT s.participant_id::text, s.document_version_id::text, s.session_secret_digest,
              s.csrf_nonce_digest, s.expires_at, s.idle_expires_at, s.revoked_at, s.completed_at,
              v.document_id::text, v.source_sha256, v.field_definition_sha256,
              d.title, p.role, p.status AS participant_status, s.purpose,
              cv.version_identifier AS bound_consent_version,
              cv.consent_text_sha256 AS bound_consent_sha256,
              cv.locale AS bound_consent_locale
         FROM public.signature_sessions s
         JOIN public.signature_participants p ON p.id=s.participant_id
         JOIN public.signature_document_versions v ON v.id=s.document_version_id
         JOIN public.signature_documents d ON d.id=v.document_id
         LEFT JOIN public.signature_consent_versions cv ON cv.id=d.consent_version_id
        WHERE s.id=$1::uuid`,
      [input.sessionId]
    );
    const row = rows[0];
    if (!row) throw new Error("signature_session_invalid");
    if (row.purpose !== (input.purpose ?? "sign_document")) {
      throw new Error("signature_session_invalid");
    }
    const csrf = input.csrfNonce ?? "invalid";
    const valid = verifySignerSession({
      sessionSecret: input.sessionSecret,
      csrfNonce: csrf,
      stored: {
        participantId: row.participant_id, documentVersionId: row.document_version_id,
        sessionSecretDigest: row.session_secret_digest, csrfNonceDigest: row.csrf_nonce_digest,
        expiresAt: row.expires_at, idleExpiresAt: row.idle_expires_at,
        revokedAt: row.revoked_at, completedAt: row.completed_at,
      },
      expectedParticipantId: row.participant_id,
      expectedDocumentVersionId: row.document_version_id,
      now: clock(),
    });
    if (!valid && input.csrfNonce) throw new Error("signature_session_invalid");
    if (!input.csrfNonce) {
      const secretOnly = constantTimeDigestMatch(sha256SignatureValue(input.sessionSecret), row.session_secret_digest)
        && !row.revoked_at && !row.completed_at
        && new Date(row.expires_at).getTime() > clock().getTime()
        && new Date(row.idle_expires_at).getTime() > clock().getTime();
      if (!secretOnly) throw new Error("signature_session_invalid");
    }
    if (input.touch) {
      const idle = new Date(Math.min(new Date(row.expires_at).getTime(), addMinutes(clock(), SIGNER_SESSION_IDLE_MINUTES).getTime()));
      await database.unsafe(`UPDATE public.signature_sessions SET last_seen_at=$2::timestamptz, idle_expires_at=$3::timestamptz WHERE id=$1::uuid`, [input.sessionId, iso(clock()), iso(idle)]);
    }
    return {
      documentId: row.document_id, documentVersionId: row.document_version_id,
      participantId: row.participant_id, sourceSha256: row.source_sha256,
      fieldDefinitionSha256: row.field_definition_sha256, title: row.title,
      role: row.role, participantStatus: row.participant_status,
      purpose: row.purpose,
      consentVersion: row.bound_consent_version,
      consentTextSha256: row.bound_consent_sha256,
      consentLocale: row.bound_consent_locale,
    };
  }

  async function assertActiveSessionInTransaction(
    transaction: SignatureQueryExecutor,
    input: { sessionId: string; sessionSecret: string; csrfNonce: string },
    expected: { participantId: string; documentVersionId: string }
  ) {
    const rows = await transaction.unsafe<{
      participant_id: string; document_version_id: string; session_secret_digest: string;
      csrf_nonce_digest: string; expires_at: string | Date; idle_expires_at: string | Date;
      revoked_at: string | Date | null; completed_at: string | Date | null;
    }>(`SELECT participant_id::text, document_version_id::text, session_secret_digest,
              csrf_nonce_digest, expires_at, idle_expires_at, revoked_at, completed_at
         FROM public.signature_sessions WHERE id=$1::uuid FOR UPDATE`, [input.sessionId]);
    const row = rows[0];
    if (!row || !verifySignerSession({
      sessionSecret: input.sessionSecret, csrfNonce: input.csrfNonce,
      stored: { participantId: row.participant_id, documentVersionId: row.document_version_id,
        sessionSecretDigest: row.session_secret_digest, csrfNonceDigest: row.csrf_nonce_digest,
        expiresAt: row.expires_at, idleExpiresAt: row.idle_expires_at,
        revokedAt: row.revoked_at, completedAt: row.completed_at },
      expectedParticipantId: expected.participantId,
      expectedDocumentVersionId: expected.documentVersionId,
      now: clock(),
    })) throw new Error("signature_session_invalid");
  }

  async function acceptSignerConsent(input: {
    sessionId: string; sessionSecret: string; csrfNonce: string;
    consentVersion: string; consentTextSha256: string; locale: "es-PR" | "en-US";
    idempotencyKey: string;
  }) {
    const context = await getSessionContext(input);
    if (!context.consentVersion || !context.consentTextSha256 || !context.consentLocale
      || context.consentVersion !== input.consentVersion
      || context.consentTextSha256 !== input.consentTextSha256
      || context.consentLocale !== input.locale) {
      throw new Error("signature_consent_version_mismatch");
    }
    return database.begin(async (transaction) => {
      await assertActiveSessionInTransaction(transaction, input, context);
      const locked = await transaction.unsafe<{ status: SignatureParticipantStatus }>(
        `SELECT status FROM public.signature_participants WHERE id=$1::uuid FOR UPDATE`,
        [context.participantId]
      );
      if (locked[0]?.status === "consented") return { accepted: true as const };
      if (locked[0]?.status !== "viewed") throw new Error("signature_consent_not_eligible");
      const now = iso(clock());
      await appendEventInTransaction(transaction, {
        documentId: context.documentId, documentVersionId: context.documentVersionId,
        participantId: context.participantId, sessionId: input.sessionId,
        eventType: "consent_presented", actorClass: "participant", versionHash: context.sourceSha256,
        controlledMetadata: { consent_version: input.consentVersion },
        idempotencyKey: derivedIdempotencyKey(input.idempotencyKey, "consent_presented"),
      });
      await transaction.unsafe(
        `UPDATE public.signature_participants SET status='consented', consented_at=$2::timestamptz,
           consent_version=$3, consent_text_sha256=$4, consent_source_sha256=$5, consent_locale=$6
         WHERE id=$1::uuid`,
        [context.participantId, now, input.consentVersion, input.consentTextSha256, context.sourceSha256, input.locale]
      );
      await appendEventInTransaction(transaction, {
        documentId: context.documentId, documentVersionId: context.documentVersionId,
        participantId: context.participantId, sessionId: input.sessionId,
        eventType: "consent_accepted", actorClass: "participant", versionHash: context.sourceSha256,
        controlledMetadata: { consent_version: input.consentVersion, consent_text_sha256: input.consentTextSha256, locale: input.locale },
        idempotencyKey: input.idempotencyKey,
      });
      await appendEventInTransaction(transaction, {
        documentId: context.documentId, documentVersionId: context.documentVersionId,
        participantId: context.participantId, sessionId: input.sessionId,
        eventType: "participant_consented", actorClass: "participant", versionHash: context.sourceSha256,
        controlledMetadata: { participant_status: "consented" },
        idempotencyKey: derivedIdempotencyKey(input.idempotencyKey, "participant_consented"),
      });
      return { accepted: true as const };
    });
  }

  async function submitSignerField(input: {
    sessionId: string; sessionSecret: string; csrfNonce: string;
    fieldId: string; value: SignerCaptureInput; idempotencyKey: string;
  }) {
    const context = await getSessionContext(input);
    return database.begin(async (transaction) => {
      await assertActiveSessionInTransaction(transaction, input, context);
      const rows = await transaction.unsafe<{ field_type: SignatureFieldType; participant_id: string }>(
        `SELECT f.field_type, f.participant_id::text FROM public.signature_fields f
         JOIN public.signature_participants p ON p.id=f.participant_id
         WHERE f.id=$1::uuid AND f.document_version_id=$2::uuid AND p.status='consented' FOR UPDATE OF f`,
        [input.fieldId, context.documentVersionId]
      );
      const field = rows[0];
      if (!field || field.participant_id !== context.participantId) throw new Error("signature_field_not_owned");
      const normalized = normalizeSignerCapture(field.field_type, input.value);
      const inserted = await transaction.unsafe<{ id: string }>(
        `INSERT INTO public.signature_field_values (
           signature_field_id, participant_id, capture_method, sanitized_typed_value,
           sanitized_value_payload, value_artifact_sha256, signer_session_id
         ) VALUES ($1::uuid,$2::uuid,$3,$4,$5::text::jsonb,$6,$7::uuid)
         ON CONFLICT (signature_field_id) DO NOTHING RETURNING id::text`,
        [input.fieldId, context.participantId, normalized.captureMethod, normalized.typedValue,
          normalized.valuePayload ? JSON.stringify(normalized.valuePayload) : null,
          normalized.valueSha256, input.sessionId]
      );
      if (!inserted[0]) throw new Error("signature_field_already_completed");
      const eventType = field.field_type === "signature" || field.field_type === "initials"
        ? "signature_submitted" : "field_completed";
      await appendEventInTransaction(transaction, {
        documentId: context.documentId, documentVersionId: context.documentVersionId,
        participantId: context.participantId, sessionId: input.sessionId,
        eventType, actorClass: "participant", versionHash: context.sourceSha256,
        controlledMetadata: { field_type: field.field_type, capture_method: normalized.captureMethod },
        idempotencyKey: input.idempotencyKey,
      });
      await appendEventInTransaction(transaction, {
        documentId: context.documentId, documentVersionId: context.documentVersionId,
        participantId: context.participantId, sessionId: input.sessionId,
        eventType: "field_submitted", actorClass: "participant", versionHash: context.sourceSha256,
        controlledMetadata: { field_type: field.field_type },
        idempotencyKey: derivedIdempotencyKey(input.idempotencyKey, "field_submitted"),
      });
      return { completed: true as const, valueSha256: normalized.valueSha256 };
    });
  }

  async function completeSignerParticipant(input: {
    sessionId: string; sessionSecret: string; csrfNonce: string; idempotencyKey: string;
  }) {
    const context = await getSessionContext(input);
    return database.begin(async (transaction) => {
      await assertActiveSessionInTransaction(transaction, input, context);
      const missing = await transaction.unsafe<{ count: number }>(
        `SELECT count(*)::integer AS count FROM public.signature_fields f
          WHERE f.participant_id=$1::uuid AND f.required
            AND NOT EXISTS (SELECT 1 FROM public.signature_field_values fv WHERE fv.signature_field_id=f.id)`,
        [context.participantId]
      );
      if (missing[0].count > 0) throw new Error("signature_required_fields_incomplete");
      const updated = await transaction.unsafe<{ id: string }>(
        `UPDATE public.signature_participants SET status='completed', completed_at=$2::timestamptz
          WHERE id=$1::uuid AND status='consented' RETURNING id::text`,
        [context.participantId, iso(clock())]
      );
      if (!updated[0]) throw new Error("signature_participant_completion_rejected");
      await transaction.unsafe(`UPDATE public.signature_sessions SET completed_at=$2::timestamptz WHERE id=$1::uuid AND completed_at IS NULL`, [input.sessionId, iso(clock())]);
      await appendEventInTransaction(transaction, {
        documentId: context.documentId, documentVersionId: context.documentVersionId,
        participantId: context.participantId, sessionId: input.sessionId,
        eventType: "participant_completed", actorClass: "participant", versionHash: context.sourceSha256,
        controlledMetadata: { participant_status: "completed" }, idempotencyKey: input.idempotencyKey,
      });
      await appendEventInTransaction(transaction, {
        documentId: context.documentId, documentVersionId: context.documentVersionId,
        participantId: context.participantId, sessionId: input.sessionId,
        eventType: "session_completed", actorClass: "participant", versionHash: context.sourceSha256,
        idempotencyKey: derivedIdempotencyKey(input.idempotencyKey, "session_completed"),
      });
      const remaining = await transaction.unsafe<{ count: number }>(
        `SELECT count(*)::integer AS count FROM public.signature_participants WHERE document_version_id=$1::uuid AND status<>'completed'`,
        [context.documentVersionId]
      );
      if (remaining[0].count > 0) {
        await transaction.unsafe(`UPDATE public.signature_documents SET status='partially_signed' WHERE id=$1::uuid AND status IN ('sent','viewed')`, [context.documentId]);
      }
      return { completed: true as const, allParticipantsCompleted: remaining[0].count === 0, documentId: context.documentId, documentVersionId: context.documentVersionId };
    });
  }

  async function revokeSignerSession(input: {
    sessionId: string;
    actorClass: "admin" | "participant" | "system";
    actorAdminId?: string | null;
    idempotencyKey: string;
  }) {
    return database.begin(async (transaction) => {
      const sessions = await transaction.unsafe<{
        participant_id: string;
        document_version_id: string;
        document_id: string;
        source_sha256: string;
      }>(
        `SELECT s.participant_id::text, s.document_version_id::text,
                v.document_id::text, v.source_sha256
           FROM public.signature_sessions s
           JOIN public.signature_document_versions v ON v.id = s.document_version_id
          WHERE s.id = $1::uuid FOR UPDATE OF s`,
        [input.sessionId]
      );
      if (!sessions[0]) throw new Error("signature_session_not_found");
      await transaction.unsafe(
        `UPDATE public.signature_sessions SET revoked_at = coalesce(revoked_at, $2::timestamptz)
          WHERE id = $1::uuid`,
        [input.sessionId, iso(clock())]
      );
      await appendEventInTransaction(transaction, {
        documentId: sessions[0].document_id,
        documentVersionId: sessions[0].document_version_id,
        participantId: sessions[0].participant_id,
        sessionId: input.sessionId,
        eventType: "session_revoked",
        actorClass: input.actorClass,
        actorAdminId: input.actorAdminId ?? null,
        versionHash: sessions[0].source_sha256,
        idempotencyKey: input.idempotencyKey,
      });
      return { revoked: true };
    });
  }

  async function expireSignatureDocument(input: {
    documentId: string;
    idempotencyKey: string;
  }) {
    return database.begin(async (transaction) => {
      const documents = await transaction.unsafe<{
        id: string; active_version_id: string; status: SignatureDocumentStatus;
        expires_at: string | Date; source_sha256: string;
      }>(`SELECT d.id::text, d.active_version_id::text, d.status, d.expires_at, v.source_sha256
             FROM public.signature_documents d
             JOIN public.signature_document_versions v ON v.id=d.active_version_id
            WHERE d.id=$1::uuid FOR UPDATE OF d`, [input.documentId]);
      const document = documents[0];
      if (!document || !["sent","viewed","partially_signed"].includes(document.status)
        || new Date(document.expires_at).getTime() > clock().getTime()) {
        throw new Error("signature_document_not_expirable");
      }
      const participants = await transaction.unsafe<{ id: string }>(
        `SELECT id::text FROM public.signature_participants
          WHERE document_version_id=$1::uuid AND status IN ('pending','invited','viewed','consented')
          FOR UPDATE`, [document.active_version_id]);
      const now = iso(clock());
      for (const participant of participants) {
        await transaction.unsafe(`UPDATE public.signature_participants SET status='expired'
          WHERE id=$1::uuid`, [participant.id]);
        await appendEventInTransaction(transaction, {
          documentId: input.documentId, documentVersionId: document.active_version_id,
          participantId: participant.id, eventType: "participant_expired", actorClass: "system",
          versionHash: document.source_sha256, controlledMetadata: { participant_status: "expired" },
          idempotencyKey: derivedIdempotencyKey(input.idempotencyKey, `participant:${participant.id}`),
        });
      }
      await transaction.unsafe(`UPDATE public.signature_signing_tokens SET revoked_at=coalesce(revoked_at,$2::timestamptz)
        WHERE document_version_id=$1::uuid AND revoked_at IS NULL`, [document.active_version_id, now]);
      await transaction.unsafe(`UPDATE public.signature_sessions SET revoked_at=coalesce(revoked_at,$2::timestamptz)
        WHERE document_version_id=$1::uuid AND revoked_at IS NULL AND completed_at IS NULL`, [document.active_version_id, now]);
      await transaction.unsafe(`UPDATE public.signature_delivery_intents SET status='cancelled', cancelled_at=$2::timestamptz,
        locked_at=NULL, locked_by=NULL, updated_at=$2::timestamptz
        WHERE document_version_id=$1::uuid AND status IN ('pending','processing')`, [document.active_version_id, now]);
      await transaction.unsafe(`UPDATE public.signature_documents SET status='expired' WHERE id=$1::uuid`, [input.documentId]);
      await appendEventInTransaction(transaction, {
        documentId: input.documentId, documentVersionId: document.active_version_id,
        eventType: "document_expired", actorClass: "system", versionHash: document.source_sha256,
        controlledMetadata: { document_status: "expired" }, idempotencyKey: input.idempotencyKey,
      });
      return { status: "expired" as const, participantsExpired: participants.length };
    });
  }

  async function verifyEventChain(documentId: string) {
    const rows = await database.unsafe<EventRow>(
      `SELECT id::text, document_id::text, document_version_id::text,
              participant_id::text, session_id::text, event_type, actor_class,
              actor_admin_id::text, server_timestamp, sequence_number,
              version_hash, controlled_metadata, idempotency_key::text,
              previous_event_digest, event_digest, key_version,
              network_address_digest, user_agent_digest
         FROM public.signature_events WHERE document_id = $1::uuid
        ORDER BY sequence_number`,
      [documentId]
    );
    return verifySignatureEventChain(rows.map(mapEvent), resolveVerificationKey);
  }

  async function voidSignatureDocument(input: {
    documentId: string;
    actorAdminId: string;
    reason: string;
    idempotencyKey: string;
  }) {
    const reason = input.reason.trim();
    if (reason.length < 1 || reason.length > 500) {
      throw new Error("signature_void_reason_invalid");
    }
    return database.begin(async (transaction) => {
      const rows = await transaction.unsafe<{
        id: string;
        active_version_id: string;
        status: SignatureDocumentStatus;
        source_sha256: string;
      }>(
        `SELECT d.id::text, d.active_version_id::text, d.status, v.source_sha256
           FROM public.signature_documents d
           JOIN public.signature_document_versions v ON v.id=d.active_version_id
          WHERE d.id=$1::uuid FOR UPDATE OF d`,
        [input.documentId]
      );
      const document = rows[0];
      if (!document || ["completed", "expired"].includes(document.status)) {
        throw new Error("signature_document_not_voidable");
      }
      if (document.status === "voided") {
        return { status: "voided" as const, participantsRevoked: 0 };
      }
      const participants = await transaction.unsafe<{ id: string }>(
        `SELECT id::text FROM public.signature_participants
          WHERE document_version_id=$1::uuid
            AND status IN ('pending','invited','viewed','consented')
          FOR UPDATE`,
        [document.active_version_id]
      );
      const now = iso(clock());
      for (const participant of participants) {
        await transaction.unsafe(
          `UPDATE public.signature_participants SET status='revoked' WHERE id=$1::uuid`,
          [participant.id]
        );
        await appendEventInTransaction(transaction, {
          documentId: input.documentId,
          documentVersionId: document.active_version_id,
          participantId: participant.id,
          eventType: "participant_revoked",
          actorClass: "admin",
          actorAdminId: input.actorAdminId,
          versionHash: document.source_sha256,
          controlledMetadata: { participant_status: "revoked" },
          idempotencyKey: derivedIdempotencyKey(input.idempotencyKey, `participant:${participant.id}`),
        });
      }
      await transaction.unsafe(
        `UPDATE public.signature_signing_tokens
            SET revoked_at=coalesce(revoked_at,$2::timestamptz)
          WHERE document_version_id=$1::uuid AND revoked_at IS NULL`,
        [document.active_version_id, now]
      );
      await transaction.unsafe(
        `UPDATE public.signature_sessions
            SET revoked_at=coalesce(revoked_at,$2::timestamptz)
          WHERE document_version_id=$1::uuid AND revoked_at IS NULL AND completed_at IS NULL`,
        [document.active_version_id, now]
      );
      await transaction.unsafe(
        `UPDATE public.signature_delivery_intents
            SET status='cancelled', cancelled_at=$2::timestamptz,
                locked_at=NULL, locked_by=NULL, updated_at=$2::timestamptz
          WHERE document_version_id=$1::uuid AND status IN ('pending','processing')`,
        [document.active_version_id, now]
      );
      await transaction.unsafe(
        `UPDATE public.signature_documents
            SET status='voided', voided_at=$2::timestamptz, void_reason=$3
          WHERE id=$1::uuid`,
        [input.documentId, now, reason]
      );
      await appendEventInTransaction(transaction, {
        documentId: input.documentId,
        documentVersionId: document.active_version_id,
        eventType: "document_voided",
        actorClass: "admin",
        actorAdminId: input.actorAdminId,
        versionHash: document.source_sha256,
        controlledMetadata: { document_status: "voided", reason_code: "admin_requested" },
        idempotencyKey: input.idempotencyKey,
      });
      return { status: "voided" as const, participantsRevoked: participants.length };
    });
  }

  return {
    createDraftDocument,
    createDraftWithVersion,
    createVersion,
    addParticipant,
    updateParticipant,
    addField,
    updateField,
    removeField,
    prepareDocumentForSend,
    transitionDocumentState,
    transitionParticipantState,
    appendEvent,
    verifyEventChain,
    issueSigningToken,
    revokeSigningToken,
    createSignerSession,
    inspectSigningToken,
    redeemSigningToken,
    inspectCompletionAccessToken,
    redeemCompletionAccessToken,
    getSessionContext,
    acceptSignerConsent,
    submitSignerField,
    completeSignerParticipant,
    revokeSignerSession,
    expireSignatureDocument,
    voidSignatureDocument,
  };
}
