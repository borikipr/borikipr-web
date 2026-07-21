import { sql } from "@/lib/db";
import { isSafePrivateObjectKey } from "@/lib/r2";

export const LEAD_DOCUMENT_SOURCE_LABELS = {
  property_buyer_profile: "Perfil comprador de propiedad",
  open_house_registration: "Registro Open House",
} as const;

export const LEAD_DOCUMENT_CATEGORY_LABELS = {
  prequalification_letter: "Carta de precalificación",
  proof_of_funds: "Evidencia de fondos",
  buyer_document: "Documento del comprador",
  open_house_document: "Documento de Open House",
  other: "Otro documento",
} as const;

export const LEAD_DOCUMENT_STATE_LABELS = {
  available: "Documento disponible",
  pending: "Carga pendiente",
  failed: "No se pudo completar la carga",
  metadata_incomplete: "Metadatos incompletos",
} as const;

export type LeadDocumentSource = keyof typeof LEAD_DOCUMENT_SOURCE_LABELS;
export type LeadDocumentCategory = keyof typeof LEAD_DOCUMENT_CATEGORY_LABELS;
export type LeadDocumentState = keyof typeof LEAD_DOCUMENT_STATE_LABELS;

export type Lead360Document = {
  submissionId: string;
  source: LeadDocumentSource;
  sourceLabel: string;
  category: LeadDocumentCategory;
  categoryLabel: string;
  originalName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  status: string | null;
  state: LeadDocumentState;
  propertyTitle: string | null;
  propertySlug: string | null;
  submittedAt: string;
  previewable: boolean;
};

export type ResolvedLeadDocument = Lead360Document & {
  objectKey: string | null;
};

export type SqlQuery = { text: string; values: unknown[] };

export const PREVIEWABLE_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isPreviewableDocumentType(contentType: string | null) {
  return Boolean(contentType && PREVIEWABLE_DOCUMENT_TYPES.has(contentType.toLowerCase()));
}

function category(value: string | null, source: LeadDocumentSource): LeadDocumentCategory {
  if (value === "prequalification_letter") return "prequalification_letter";
  if (value === "proof_of_funds") return "proof_of_funds";
  return source === "open_house_registration" ? "open_house_document" : "buyer_document";
}

export function deriveLeadDocumentState(input: {
  status: string | null;
  objectKey: string | null;
  originalName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
}): LeadDocumentState {
  if (input.status === "pending") return "pending";
  if (input.status === "failed") return "failed";
  if (
    input.status === "uploaded" &&
    input.objectKey &&
    isSafePrivateObjectKey(input.objectKey) &&
    input.originalName &&
    input.contentType &&
    input.sizeBytes !== null &&
    input.sizeBytes >= 0
  ) return "available";
  return "metadata_incomplete";
}

export function formatDocumentSize(sizeBytes: number | null) {
  if (sizeBytes === null || !Number.isFinite(sizeBytes) || sizeBytes < 0) return "Tamaño no disponible";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(sizeBytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function sanitizeDocumentFilename(value: string | null) {
  const cleaned = (value ?? "documento")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "-")
    .replace(/\.{2,}/g, ".")
    .trim()
    .slice(0, 180);
  return cleaned || "documento";
}

export function buildContentDisposition(filename: string, inline: boolean) {
  const safe = sanitizeDocumentFilename(filename);
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "documento";
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

export function buildLead360DocumentsQuery(leadId: string): SqlQuery {
  return {
    text: `SELECT * FROM (
      SELECT
        pbp.id::text AS submission_id,
        'property_buyer_profile'::text AS source_type,
        pbp.document_type,
        pbp.document_object_key AS object_key,
        pbp.document_original_name AS original_name,
        pbp.document_content_type AS content_type,
        pbp.document_size_bytes AS size_bytes,
        pbp.document_status AS status,
        pbp.created_at,
        p.titulo AS property_title,
        p.slug AS property_slug
      FROM public.property_buyer_profiles pbp
      INNER JOIN public.propiedades p ON p.id = pbp.property_id
      WHERE pbp.lead_id = $1::uuid
        AND (
          pbp.document_status <> 'none'
          OR pbp.document_object_key IS NOT NULL
          OR pbp.document_original_name IS NOT NULL
        )

      UNION ALL

      SELECT
        cp.id::text,
        'open_house_registration'::text,
        CASE
          WHEN cp.carta_precalificacion_key IS NOT NULL OR cp.carta_precalificacion_url IS NOT NULL
            THEN 'prequalification_letter'
          WHEN cp.evidencia_fondos_key IS NOT NULL OR cp.evidencia_fondos IS NOT NULL
            THEN 'proof_of_funds'
          ELSE NULL
        END,
        COALESCE(cp.carta_precalificacion_key, cp.evidencia_fondos_key),
        cp.respuestas_personalizadas->'document_metadata'->>'original_name',
        cp.respuestas_personalizadas->'document_metadata'->>'content_type',
        CASE
          WHEN (cp.respuestas_personalizadas->'document_metadata'->>'size_bytes') ~ '^[0-9]+$'
            THEN (cp.respuestas_personalizadas->'document_metadata'->>'size_bytes')::bigint
          ELSE NULL
        END,
        CASE
          WHEN cp.carta_precalificacion_key IS NOT NULL THEN cp.carta_precalificacion_status
          WHEN cp.evidencia_fondos_key IS NOT NULL THEN cp.evidencia_fondos_status
          ELSE NULL
        END,
        cp.created_at,
        p.titulo,
        p.slug
      FROM public.consultas_propiedad cp
      INNER JOIN public.propiedades p ON p.id = cp.propiedad_id
      WHERE cp.lead_id = $1::uuid
        AND (
          cp.carta_precalificacion_key IS NOT NULL
          OR cp.evidencia_fondos_key IS NOT NULL
          OR cp.carta_precalificacion_url IS NOT NULL
          OR cp.evidencia_fondos IS NOT NULL
          OR cp.carta_precalificacion_status IN ('pending', 'failed', 'uploaded')
          OR cp.evidencia_fondos_status IN ('pending', 'failed', 'uploaded')
        )
    ) documents
    ORDER BY created_at DESC, source_type, submission_id`,
    values: [leadId],
  };
}

export function buildLeadDocumentAccessQuery(
  leadId: string,
  source: LeadDocumentSource,
  submissionId: string
): SqlQuery {
  if (source === "property_buyer_profile") {
    return {
      text: `SELECT
        pbp.id::text AS submission_id,
        'property_buyer_profile'::text AS source_type,
        pbp.document_type,
        pbp.document_object_key AS object_key,
        pbp.document_original_name AS original_name,
        pbp.document_content_type AS content_type,
        pbp.document_size_bytes AS size_bytes,
        pbp.document_status AS status,
        pbp.created_at,
        p.titulo AS property_title,
        p.slug AS property_slug
      FROM public.property_buyer_profiles pbp
      INNER JOIN public.propiedades p ON p.id = pbp.property_id
      WHERE pbp.id = $2::uuid AND pbp.lead_id = $1::uuid
      LIMIT 1`,
      values: [leadId, submissionId],
    };
  }
  return {
    text: `SELECT
      cp.id::text AS submission_id,
      'open_house_registration'::text AS source_type,
      CASE WHEN cp.carta_precalificacion_key IS NOT NULL THEN 'prequalification_letter'
           WHEN cp.evidencia_fondos_key IS NOT NULL THEN 'proof_of_funds'
           ELSE NULL END AS document_type,
      COALESCE(cp.carta_precalificacion_key, cp.evidencia_fondos_key) AS object_key,
      cp.respuestas_personalizadas->'document_metadata'->>'original_name' AS original_name,
      cp.respuestas_personalizadas->'document_metadata'->>'content_type' AS content_type,
      CASE WHEN (cp.respuestas_personalizadas->'document_metadata'->>'size_bytes') ~ '^[0-9]+$'
        THEN (cp.respuestas_personalizadas->'document_metadata'->>'size_bytes')::bigint ELSE NULL END AS size_bytes,
      CASE WHEN cp.carta_precalificacion_key IS NOT NULL THEN cp.carta_precalificacion_status
           WHEN cp.evidencia_fondos_key IS NOT NULL THEN cp.evidencia_fondos_status ELSE NULL END AS status,
      cp.created_at, p.titulo AS property_title, p.slug AS property_slug
    FROM public.consultas_propiedad cp
    INNER JOIN public.propiedades p ON p.id = cp.propiedad_id
    WHERE cp.id = $2::uuid AND cp.lead_id = $1::uuid
    LIMIT 1`,
    values: [leadId, submissionId],
  };
}

type DocumentRow = {
  submission_id: string;
  source_type: LeadDocumentSource;
  document_type: string | null;
  object_key: string | null;
  original_name: string | null;
  content_type: string | null;
  size_bytes: number | string | null;
  status: string | null;
  created_at: string | Date;
  property_title: string | null;
  property_slug: string | null;
};

export function mapLeadDocumentRow(row: DocumentRow): ResolvedLeadDocument {
  const sizeBytes = row.size_bytes === null ? null : Number(row.size_bytes);
  const documentCategory = category(row.document_type, row.source_type);
  return {
    submissionId: row.submission_id,
    source: row.source_type,
    sourceLabel: LEAD_DOCUMENT_SOURCE_LABELS[row.source_type],
    category: documentCategory,
    categoryLabel: LEAD_DOCUMENT_CATEGORY_LABELS[documentCategory],
    objectKey: row.object_key,
    originalName: row.original_name,
    contentType: row.content_type,
    sizeBytes,
    status: row.status,
    state: deriveLeadDocumentState({
      status: row.status,
      objectKey: row.object_key,
      originalName: row.original_name,
      contentType: row.content_type,
      sizeBytes,
    }),
    propertyTitle: row.property_title,
    propertySlug: row.property_slug,
    submittedAt: new Date(row.created_at).toISOString(),
    previewable: isPreviewableDocumentType(row.content_type),
  };
}

async function execute(query: SqlQuery) {
  return (await sql.unsafe(query.text, query.values as never[])) as unknown as DocumentRow[];
}

export async function getLead360Documents(leadId: string): Promise<Lead360Document[]> {
  return (await execute(buildLead360DocumentsQuery(leadId))).map((row) => {
    const resolved = mapLeadDocumentRow(row);
    return {
      submissionId: resolved.submissionId,
      source: resolved.source,
      sourceLabel: resolved.sourceLabel,
      category: resolved.category,
      categoryLabel: resolved.categoryLabel,
      originalName: resolved.originalName,
      contentType: resolved.contentType,
      sizeBytes: resolved.sizeBytes,
      status: resolved.status,
      state: resolved.state,
      propertyTitle: resolved.propertyTitle,
      propertySlug: resolved.propertySlug,
      submittedAt: resolved.submittedAt,
      previewable: resolved.previewable,
    };
  });
}

export async function resolveLeadDocument(
  leadId: string,
  source: LeadDocumentSource,
  submissionId: string
): Promise<ResolvedLeadDocument | null> {
  const rows = await execute(buildLeadDocumentAccessQuery(leadId, source, submissionId));
  return rows[0] ? mapLeadDocumentRow(rows[0]) : null;
}
