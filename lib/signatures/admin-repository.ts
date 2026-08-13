import { hashSignatureFieldDefinition } from "./field-definition";
import type { SignatureQueryExecutor } from "./domain/types";
import type { PdfPageGeometry } from "./prototype/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSignatureUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function json<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

export type SignatureDraftDetail = Readonly<{
  id: string;
  title: string;
  documentType: string;
  documentTypeApprovalReference: string | null;
  status: string;
  canonicalLeadId: string | null;
  leadGroupId: string | null;
  expiresAt: string | Date | null;
  createdAt: string | Date;
  operationallyHiddenAt: string | Date | null;
  version: Readonly<{
    id: string;
    number: number;
    filename: string;
    byteCount: number;
    pageCount: number;
    sourceSha256: string;
    sourceDeleted: boolean;
    pageGeometry: readonly PdfPageGeometry[];
    persistedFieldDefinitionSha256: string | null;
    locked: boolean;
  }>;
  participants: readonly Readonly<{
    id: string;
    canonicalLeadId: string | null;
    name: string;
    email: string;
    role: string;
    routingOrder: number | null;
    status: string;
    invitedAt: string | Date | null;
    viewedAt: string | Date | null;
    consentedAt: string | Date | null;
    completedAt: string | Date | null;
    lastDeliveryStatus: string | null;
    lastDeliveryAt: string | Date | null;
  }>[];
  fields: readonly Readonly<{
    id: string;
    participantId: string;
    fieldType: "signature" | "initials" | "date" | "text";
    pageIndex: number;
    normalizedX: number;
    normalizedY: number;
    normalizedWidth: number;
    normalizedHeight: number;
    pageGeometryReference: unknown;
    label: string;
    required: boolean;
    tabOrder: number;
    validationLimits: Record<string, number>;
  }>[];
  currentFieldDefinitionSha256: string;
  events: readonly Readonly<{ id: string; eventType: string; actorClass: string; createdAt: string | Date }>[];
}>;

export function createSignatureAdminRepository(database: SignatureQueryExecutor) {
  return {
    async list(input: {
      search?: string;
      status?: string;
      documentType?: string;
      view?: string;
    }) {
      const search = input.search?.trim() || "";
      const status = input.status?.trim() || "all";
      const documentType = input.documentType?.trim() || "all";
      const view = input.view?.trim() || "active";
      return database.unsafe<{
        id: string;
        title: string;
        document_type: string;
        status: string;
        created_at: string | Date;
        updated_at: string | Date;
        participant_count: number | bigint;
        completed_participant_count: number | bigint;
        last_delivery_status: string | null;
        page_count: number;
        expires_at: string | Date | null;
        operationally_hidden_at: string | Date | null;
      }>(
        `SELECT d.id::text, d.title, d.document_type, d.status,
                d.created_at, d.updated_at, d.expires_at, d.operationally_hidden_at, v.page_count,
                count(p.id)::integer AS participant_count,
                count(p.id) FILTER (WHERE p.status='completed')::integer AS completed_participant_count,
                (SELECT di.status FROM public.signature_delivery_intents di
                  WHERE di.document_version_id=v.id ORDER BY di.created_at DESC LIMIT 1) AS last_delivery_status
           FROM public.signature_documents d
           JOIN public.signature_document_versions v ON v.id=d.active_version_id
           LEFT JOIN public.signature_participants p ON p.document_version_id=v.id
          WHERE ($1 = '' OR d.title ILIKE '%' || $1 || '%'
                 OR EXISTS (SELECT 1 FROM public.signature_participants sp
                             WHERE sp.document_version_id=v.id
                               AND (sp.name_snapshot ILIKE '%' || $1 || '%'
                                    OR sp.normalized_email ILIKE '%' || $1 || '%')))
            AND ($4 = 'all'
              OR ($4 = 'active' AND d.status NOT IN ('completed','archived') AND d.operationally_hidden_at IS NULL)
              OR ($4 = 'completed' AND d.status='completed')
              OR ($4 = 'archived' AND (d.status='archived' OR d.operationally_hidden_at IS NOT NULL)))
            AND ($2 = 'all' OR d.status=$2)
            AND ($3 = 'all' OR d.document_type=$3)
          GROUP BY d.id, v.id, v.page_count
          ORDER BY d.updated_at DESC
          LIMIT 100`,
        [search, status, documentType, view]
      );
    },

    async detail(documentId: string) {
      if (!isSignatureUuid(documentId)) return null;
      const documents = await database.unsafe<{
        id: string;
        title: string;
        document_type: string;
        document_type_approval_reference: string | null;
        status: string;
        canonical_lead_id: string | null;
        lead_group_id: string | null;
        expires_at: string | Date | null;
        created_at: string | Date;
        operationally_hidden_at: string | Date | null;
        version_id: string;
        version_number: number;
        filename_snapshot: string;
        byte_count: number | bigint;
        page_count: number;
        source_sha256: string;
        page_geometry_manifest: unknown;
        field_definition_sha256: string | null;
        locked_at: string | Date | null;
        source_deleted_at: string | Date | null;
      }>(
        `SELECT d.id::text, d.title, d.document_type,
                d.document_type_approval_reference, d.status,
                d.canonical_lead_id::text, d.lead_group_id::text,
                d.expires_at, d.created_at, d.operationally_hidden_at,
                v.id::text AS version_id, v.version_number, v.filename_snapshot,
                v.byte_count, v.page_count, v.source_sha256,
                v.page_geometry_manifest, v.field_definition_sha256, v.locked_at, v.source_deleted_at
           FROM public.signature_documents d
           JOIN public.signature_document_versions v ON v.id=d.active_version_id
          WHERE d.id=$1::uuid`,
        [documentId]
      );
      if (!documents[0]) return null;
      const participants = await database.unsafe<{
        id: string;
        canonical_lead_id: string | null;
        name_snapshot: string;
        email_snapshot: string;
        role: string;
        routing_order: number | null;
        status: string;
        invited_at: string | Date | null;
        viewed_at: string | Date | null;
        consented_at: string | Date | null;
        completed_at: string | Date | null;
        last_delivery_status: string | null;
        last_delivery_at: string | Date | null;
      }>(
        `SELECT p.id::text, p.canonical_lead_id::text, p.name_snapshot,
                p.email_snapshot, p.role, p.routing_order, p.status,
                p.invited_at, p.viewed_at, p.consented_at, p.completed_at,
                last_delivery.status AS last_delivery_status,
                last_delivery.delivered_at AS last_delivery_at
           FROM public.signature_participants p
           LEFT JOIN LATERAL (
             SELECT di.status, di.delivered_at
               FROM public.signature_delivery_intents di
              WHERE di.participant_id=p.id ORDER BY di.created_at DESC LIMIT 1
           ) last_delivery ON true
          WHERE p.document_version_id=$1::uuid AND p.removed_at IS NULL
          ORDER BY p.routing_order NULLS LAST, p.created_at, p.id`,
        [documents[0].version_id]
      );
      const fields = await database.unsafe<{
        id: string;
        participant_id: string;
        field_type: "signature" | "initials" | "date" | "text";
        page_index: number;
        normalized_x: string | number;
        normalized_y: string | number;
        normalized_width: string | number;
        normalized_height: string | number;
        page_geometry_reference: unknown;
        label: string;
        required: boolean;
        tab_order: number;
        validation_limits: Record<string, number> | string;
      }>(
        `SELECT id::text, participant_id::text, field_type, page_index,
                normalized_x, normalized_y, normalized_width, normalized_height,
                page_geometry_reference, label, required, tab_order,
                validation_limits
           FROM public.signature_fields
          WHERE document_version_id=$1::uuid
          ORDER BY tab_order, id`,
        [documents[0].version_id]
      );
      const normalizedFields = fields.map((field) => ({
        id: field.id,
        participantId: field.participant_id,
        fieldType: field.field_type,
        pageIndex: field.page_index,
        normalizedX: Number(field.normalized_x),
        normalizedY: Number(field.normalized_y),
        normalizedWidth: Number(field.normalized_width),
        normalizedHeight: Number(field.normalized_height),
        pageGeometryReference: json<unknown>(field.page_geometry_reference),
        label: field.label,
        required: field.required,
        tabOrder: field.tab_order,
        validationLimits: json<Record<string, number>>(field.validation_limits),
      }));
      const document = documents[0];
      const events = await database.unsafe<{ id:string; event_type:string; actor_class:string; created_at:string | Date }>(
        `SELECT id::text,event_type,actor_class,server_timestamp AS created_at FROM public.signature_events
          WHERE document_id=$1::uuid ORDER BY sequence_number DESC LIMIT 50`, [documentId]
      );
      return {
        id: document.id,
        title: document.title,
        documentType: document.document_type,
        documentTypeApprovalReference: document.document_type_approval_reference,
        status: document.status,
        canonicalLeadId: document.canonical_lead_id,
        leadGroupId: document.lead_group_id,
        expiresAt: document.expires_at,
        createdAt: document.created_at,
        operationallyHiddenAt: document.operationally_hidden_at,
        version: {
          id: document.version_id,
          number: document.version_number,
          filename: document.filename_snapshot,
          byteCount: Number(document.byte_count),
          pageCount: document.page_count,
          sourceSha256: document.source_sha256,
          sourceDeleted: Boolean(document.source_deleted_at),
          pageGeometry: json<readonly PdfPageGeometry[]>(document.page_geometry_manifest),
          persistedFieldDefinitionSha256: document.field_definition_sha256,
          locked: Boolean(document.locked_at),
        },
        participants: participants.map((participant) => ({
          id: participant.id,
          canonicalLeadId: participant.canonical_lead_id,
          name: participant.name_snapshot,
          email: participant.email_snapshot,
          role: participant.role,
          routingOrder: participant.routing_order,
          status: participant.status,
          invitedAt: participant.invited_at,
          viewedAt: participant.viewed_at,
          consentedAt: participant.consented_at,
          completedAt: participant.completed_at,
          lastDeliveryStatus: participant.last_delivery_status,
          lastDeliveryAt: participant.last_delivery_at,
        })),
        fields: normalizedFields,
        currentFieldDefinitionSha256: hashSignatureFieldDefinition({
          documentVersionId: document.version_id,
          fields: normalizedFields,
        }),
        events: events.map((event) => ({ id:event.id, eventType:event.event_type, actorClass:event.actor_class, createdAt:event.created_at })),
      } satisfies SignatureDraftDetail;
    },

    async sourceDescriptor(documentId: string) {
      if (!isSignatureUuid(documentId)) return null;
      const rows = await database.unsafe<{
        source_r2_key: string;
        filename_snapshot: string;
        byte_count: number | bigint;
        source_sha256: string;
      }>(
        `SELECT v.source_r2_key, v.filename_snapshot, v.byte_count, v.source_sha256
           FROM public.signature_documents d
           JOIN public.signature_document_versions v ON v.id=d.active_version_id
          WHERE d.id=$1::uuid AND v.source_deleted_at IS NULL`,
        [documentId]
      );
      return rows[0]
        ? {
            key: rows[0].source_r2_key,
            filename: rows[0].filename_snapshot,
            byteCount: Number(rows[0].byte_count),
            sourceSha256: rows[0].source_sha256,
          }
        : null;
    },

    async completedDescriptor(documentId: string) {
      if (!isSignatureUuid(documentId)) return null;
      const rows = await database.unsafe<{
        id: string; title: string; source_sha256: string; field_definition_sha256: string;
        final_r2_key: string; final_filename: string; final_byte_count: number | bigint;
        final_pdf_sha256: string; certificate_r2_key: string;
        certificate_byte_count: number | bigint; certificate_sha256: string;
        certificate_metadata: unknown;
      }>(`SELECT d.id::text, d.title, v.source_sha256, v.field_definition_sha256,
                  v.final_r2_key, v.final_filename, v.final_byte_count, v.final_pdf_sha256,
                  v.certificate_r2_key, v.certificate_byte_count, v.certificate_sha256,
                  v.certificate_metadata
             FROM public.signature_documents d
             JOIN public.signature_document_versions v ON v.id=d.active_version_id
            WHERE d.id=$1::uuid AND d.status='completed' AND v.finalized_at IS NOT NULL`,
        [documentId]);
      return rows[0] ? {
        documentId: rows[0].id, title: rows[0].title, sourceSha256: rows[0].source_sha256,
        fieldDefinitionSha256: rows[0].field_definition_sha256,
        final: { key: rows[0].final_r2_key, filename: rows[0].final_filename,
          byteCount: Number(rows[0].final_byte_count), sha256: rows[0].final_pdf_sha256 },
        certificate: { key: rows[0].certificate_r2_key,
          filename: `${rows[0].title.slice(0, 180)} - certificado.pdf`,
          byteCount: Number(rows[0].certificate_byte_count), sha256: rows[0].certificate_sha256 },
        evidence: json<Record<string, unknown>>(rows[0].certificate_metadata),
      } : null;
    },

    async linkageOptions() {
      const [leads, groups] = await Promise.all([
        database.unsafe<{ id: string; label: string }>(
          `SELECT id::text, name AS label FROM public.leads
            WHERE merged_into_lead_id IS NULL
            ORDER BY last_activity_at DESC LIMIT 100`
        ),
        database.unsafe<{ id: string; label: string }>(
          `SELECT id::text, title AS label FROM public.lead_groups
            WHERE status <> 'archived' ORDER BY updated_at DESC LIMIT 100`
        ),
      ]);
      return { leads, groups };
    },
  };
}
