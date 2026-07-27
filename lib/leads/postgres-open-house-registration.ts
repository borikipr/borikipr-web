import { randomUUID } from "crypto";
import type postgres from "postgres";
import { sql } from "@/lib/db";
import { createPostgresLeadResolverInTransaction } from "./postgres-resolver";
import {
  buildOpenHouseDocumentObjectKey,
  buildOpenHouseShowingEventKey,
  type CanonicalOpenHouseProperty,
  OpenHouseValidationError,
  type OpenHouseDocumentStatus,
  type ParsedOpenHouseRegistration,
  validateOpenHouseForProperty,
} from "./open-house-registration";
import type { ReusableFinancialDocument } from "./financial-document-reuse";

type PropertyRow = {
  id: string;
  slug: string;
  titulo: string;
  estado: string;
  origen_listado: string;
  permiso_publicar_web: boolean | null;
  formulario_showing_activo: boolean | null;
  showing_at: Date | string | null;
  requiere_precalificacion: boolean | null;
  open_house_solar_question_enabled: boolean;
  pregunta_personalizada: string | null;
  pregunta_personalizada_requerida: boolean;
};

type RegistrationRow = {
  id: string;
  lead_id: string;
  propiedad_id: string;
  property_slug: string;
  property_title: string;
  showing_at: Date | string;
  showing_event_key: string;
  nombre: string;
  telefono: string;
  email: string | null;
  metodo_compra: "Financiamiento" | "Cash" | "Otro";
  fondos_gastos_cierre: string | null;
  trabajando_con_corredor: "Sí" | "No";
  nombre_corredor: string | null;
  telefono_corredor: string | null;
  disponibilidad_visita: string;
  respuestas_personalizadas: OpenHouseAnswers | null;
  carta_precalificacion_key: string | null;
  carta_precalificacion_status: OpenHouseDocumentStatus;
  evidencia_fondos_key: string | null;
  evidencia_fondos_status: OpenHouseDocumentStatus;
  reused_property_buyer_profile_id: string | null;
};

type OpenHouseAnswers = {
  pregunta_personalizada: string | null;
  respuesta_personalizada: string | null;
  purchase_method_other: string | null;
  solar_contract_acceptance: "yes" | "no" | null;
  document_metadata: {
    kind: "prequalification_letter" | "proof_of_funds";
    content_type: string;
    size_bytes: number;
    original_name: string;
  } | null;
};

export type PersistedOpenHouseRegistration = {
  id: string;
  leadId: string;
  created: boolean;
  property: {
    id: string;
    slug: string;
    title: string;
  };
  showingAt: Date;
  showingEventKey: string;
  name: string;
  phone: string;
  email: string | null;
  purchaseMethod: "Financiamiento" | "Cash" | "Otro";
  purchaseMethodOther: string | null;
  attendanceAvailability: string;
  closingFunds: string | null;
  workingWithBroker: "Sí" | "No";
  brokerName: string | null;
  brokerPhone: string | null;
  customQuestion: string | null;
  customAnswer: string | null;
  solarContractAcceptance: "yes" | "no" | null;
  prequalificationKey: string | null;
  prequalificationStatus: OpenHouseDocumentStatus;
  proofOfFundsKey: string | null;
  proofOfFundsStatus: OpenHouseDocumentStatus;
  documentOriginalName: string | null;
  documentContentType: string | null;
  documentSizeBytes: number | null;
  reusedPropertyBuyerProfileId: string | null;
};

export async function getCanonicalOpenHouseShowingAt(propertyId: string) {
  const rows = await sql<{ showing_at: Date | string | null }[]>`
    SELECT fecha_showing AT TIME ZONE 'America/Puerto_Rico' AS showing_at
    FROM public.propiedades
    WHERE id = ${propertyId}
    LIMIT 1
  `;
  const value = rows[0]?.showing_at;
  return value ? new Date(value).toISOString() : null;
}

export async function persistOpenHouseRegistration(
  input: ParsedOpenHouseRegistration,
  options: { reusableDocument?: ReusableFinancialDocument | null } = {}
): Promise<PersistedOpenHouseRegistration> {
  try {
    const result = await sql.begin(async (transaction) => {
      const existing = await findByIdempotencyKey(
        transaction,
        input.idempotencyKey
      );
      if (existing) return mapRegistration(existing, false);

      const propertyRows = await transaction.unsafe<PropertyRow[]>(
        `SELECT
           id::text,
           slug,
           titulo,
           estado,
           origen_listado,
           permiso_publicar_web,
           formulario_showing_activo,
           fecha_showing AT TIME ZONE 'America/Puerto_Rico' AS showing_at,
           requiere_precalificacion,
           open_house_solar_question_enabled,
           pregunta_personalizada,
           COALESCE(
             configuracion_formulario->>'pregunta_personalizada_requerida' = 'true',
             false
           ) AS pregunta_personalizada_requerida
         FROM public.propiedades
         WHERE id = $1::uuid
         LIMIT 1
         FOR UPDATE`,
        [input.propertyId]
      );
      const propertyRow = propertyRows[0];
      if (!propertyRow) {
        throw new OpenHouseValidationError(
          "No encontramos la propiedad seleccionada.",
          400,
          "property_not_found"
        );
      }

      const property = mapProperty(propertyRow);
      const resolver = createPostgresLeadResolverInTransaction(transaction);
      const resolved = await resolver.resolveOrCreate({
        name: input.name,
        email: input.email,
        phone: input.phone,
      });
      const reusableDocument = options.reusableDocument
        ? await validateReusableDocumentInTransaction(
            transaction,
            options.reusableDocument,
            resolved.lead.id,
            input.purchaseMethod
          )
        : null;
      validateOpenHouseForProperty(
        input,
        property,
        new Date(),
        Boolean(reusableDocument)
      );

      const registrationId = randomUUID();
      const showingAt = property.showingAt!;
      const showingEventKey = buildOpenHouseShowingEventKey(
        property.id,
        showingAt
      );
      const uploadedObjectKey =
        input.documentKind && input.documentExtension
          ? buildOpenHouseDocumentObjectKey(
              registrationId,
              input.documentKind,
              input.documentExtension
            )
          : null;
      const effectiveDocumentType =
        input.documentKind || reusableDocument?.documentType || null;
      const objectKey =
        uploadedObjectKey || reusableDocument?.objectKey || null;
      const prequalificationKey =
        effectiveDocumentType === "prequalification_letter" ? objectKey : null;
      const proofOfFundsKey =
        effectiveDocumentType === "proof_of_funds" ? objectKey : null;
      const documentOriginalName =
        input.documentFile?.name || reusableDocument?.originalName || null;
      const documentContentType =
        input.documentFile?.type || reusableDocument?.contentType || null;
      const documentSizeBytes =
        input.documentFile?.size ?? reusableDocument?.sizeBytes ?? null;
      const answers: OpenHouseAnswers = {
        pregunta_personalizada: null,
        respuesta_personalizada: null,
        purchase_method_other: input.purchaseMethodOther,
        solar_contract_acceptance: property.hasSolarLease
          ? input.solarContractAcceptance
          : null,
        document_metadata:
          effectiveDocumentType &&
          documentOriginalName &&
          documentContentType &&
          documentSizeBytes !== null
            ? {
                kind: effectiveDocumentType,
                content_type: documentContentType,
                size_bytes: documentSizeBytes,
                original_name: documentOriginalName,
              }
            : null,
      };

      const inserted = await transaction.unsafe<RegistrationRow[]>(
        `INSERT INTO public.consultas_propiedad (
           id,
           propiedad_id,
           lead_id,
           idempotency_key,
           source_path,
           showing_at,
           showing_event_key,
           nombre,
           telefono,
           email,
           metodo_compra,
           fondos_gastos_cierre,
           trabajando_con_corredor,
           nombre_corredor,
           telefono_corredor,
           disponibilidad_visita,
           respuestas_personalizadas,
           carta_precalificacion_key,
           carta_precalificacion_status,
           evidencia_fondos_key,
           evidencia_fondos_status,
           reused_property_buyer_profile_id
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::timestamptz,
           $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb,
           $18, $19, $20, $21, $22::uuid
         )
         RETURNING
           id::text,
           lead_id::text,
           propiedad_id::text,
           $23::text AS property_slug,
           $24::text AS property_title,
           showing_at,
           showing_event_key,
           nombre,
           telefono,
           email,
           metodo_compra,
           fondos_gastos_cierre,
           trabajando_con_corredor,
           nombre_corredor,
           telefono_corredor,
           disponibilidad_visita,
           respuestas_personalizadas,
           carta_precalificacion_key,
           carta_precalificacion_status,
           evidencia_fondos_key,
           evidencia_fondos_status,
           reused_property_buyer_profile_id::text`,
        [
          registrationId,
          property.id,
          resolved.lead.id,
          input.idempotencyKey,
          `/listados/${property.slug}/registro-openhouse`,
          showingAt.toISOString(),
          showingEventKey,
          input.name,
          input.phone,
          input.email,
          input.purchaseMethod,
          input.closingFunds,
          input.workingWithBroker,
          input.brokerName,
          input.brokerPhone,
          input.attendanceAvailability,
          JSON.stringify(answers),
          prequalificationKey,
          prequalificationKey
            ? reusableDocument
              ? "uploaded"
              : "pending"
            : "none",
          proofOfFundsKey,
          proofOfFundsKey
            ? reusableDocument
              ? "uploaded"
              : "pending"
            : "none",
          reusableDocument?.sourceProfileId || null,
          property.slug,
          property.title,
        ]
      );

      return mapRegistration(inserted[0], true);
    });
    return result as PersistedOpenHouseRegistration;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await findExistingOutsideTransaction(input.idempotencyKey);
    if (existing) return mapRegistration(existing, false);
    throw error;
  }
}

export async function updateOpenHouseDocumentStatus(
  registrationId: string,
  kind: "prequalification_letter" | "proof_of_funds",
  objectKey: string,
  status: "uploaded" | "failed"
) {
  const statusColumn =
    kind === "prequalification_letter"
      ? "carta_precalificacion_status"
      : "evidencia_fondos_status";
  const keyColumn =
    kind === "prequalification_letter"
      ? "carta_precalificacion_key"
      : "evidencia_fondos_key";
  const rows = await sql.unsafe<{ id: string }[]>(
    `UPDATE public.consultas_propiedad
       SET ${statusColumn} = $1
     WHERE id = $2::uuid
       AND ${keyColumn} = $3
       AND ${statusColumn} = 'pending'
     RETURNING id::text`,
    [status, registrationId, objectKey]
  );
  return rows.length === 1;
}

async function findByIdempotencyKey(
  transaction: postgres.TransactionSql,
  idempotencyKey: string
) {
  const rows = await transaction.unsafe<RegistrationRow[]>(registrationLookupSql, [
    idempotencyKey,
  ]);
  return rows[0] || null;
}

async function findExistingOutsideTransaction(idempotencyKey: string) {
  const rows = await sql.unsafe<RegistrationRow[]>(registrationLookupSql, [
    idempotencyKey,
  ]);
  return rows[0] || null;
}

const registrationLookupSql = `SELECT
   registration.id::text,
   registration.lead_id::text,
   registration.propiedad_id::text,
   property.slug AS property_slug,
   property.titulo AS property_title,
   registration.showing_at,
   registration.showing_event_key,
   registration.nombre,
   registration.telefono,
   registration.email,
   registration.metodo_compra,
   registration.fondos_gastos_cierre,
   registration.trabajando_con_corredor,
   registration.nombre_corredor,
   registration.telefono_corredor,
   registration.disponibilidad_visita,
   registration.respuestas_personalizadas,
   registration.carta_precalificacion_key,
   registration.carta_precalificacion_status,
   registration.evidencia_fondos_key,
   registration.evidencia_fondos_status,
   registration.reused_property_buyer_profile_id::text
 FROM public.consultas_propiedad registration
 JOIN public.propiedades property ON property.id = registration.propiedad_id
 WHERE registration.idempotency_key = $1::uuid
 LIMIT 1`;

function mapProperty(row: PropertyRow): CanonicalOpenHouseProperty {
  return {
    id: row.id,
    slug: row.slug,
    title: row.titulo,
    status: row.estado,
    origin: row.origen_listado,
    mayPublishOnWeb: row.permiso_publicar_web === true,
    showingFormActive: row.formulario_showing_activo === true,
    showingAt: row.showing_at ? new Date(row.showing_at) : null,
    requiresPrequalification: row.requiere_precalificacion === true,
    hasSolarLease: row.open_house_solar_question_enabled === true,
  };
}

function mapRegistration(
  row: RegistrationRow,
  created: boolean
): PersistedOpenHouseRegistration {
  return {
    id: row.id,
    leadId: row.lead_id,
    created,
    property: {
      id: row.propiedad_id,
      slug: row.property_slug,
      title: row.property_title,
    },
    showingAt: new Date(row.showing_at),
    showingEventKey: row.showing_event_key,
    name: row.nombre,
    phone: row.telefono,
    email: row.email,
    purchaseMethod: row.metodo_compra,
    purchaseMethodOther:
      row.respuestas_personalizadas?.purchase_method_other || null,
    attendanceAvailability: row.disponibilidad_visita,
    closingFunds: row.fondos_gastos_cierre,
    workingWithBroker: row.trabajando_con_corredor,
    brokerName: row.nombre_corredor,
    brokerPhone: row.telefono_corredor,
    customQuestion: row.respuestas_personalizadas?.pregunta_personalizada || null,
    customAnswer: row.respuestas_personalizadas?.respuesta_personalizada || null,
    solarContractAcceptance:
      row.respuestas_personalizadas?.solar_contract_acceptance || null,
    prequalificationKey: row.carta_precalificacion_key,
    prequalificationStatus: row.carta_precalificacion_status,
    proofOfFundsKey: row.evidencia_fondos_key,
    proofOfFundsStatus: row.evidencia_fondos_status,
    documentOriginalName:
      row.respuestas_personalizadas?.document_metadata?.original_name || null,
    documentContentType:
      row.respuestas_personalizadas?.document_metadata?.content_type || null,
    documentSizeBytes:
      row.respuestas_personalizadas?.document_metadata?.size_bytes ?? null,
    reusedPropertyBuyerProfileId: row.reused_property_buyer_profile_id,
  };
}

async function validateReusableDocumentInTransaction(
  transaction: postgres.TransactionSql,
  document: ReusableFinancialDocument,
  leadId: string,
  purchaseMethod: ParsedOpenHouseRegistration["purchaseMethod"]
) {
  const expectedType =
    purchaseMethod === "Financiamiento"
      ? "prequalification_letter"
      : "proof_of_funds";
  if (
    document.ownerLeadId !== leadId ||
    document.documentType !== expectedType
  ) {
    throw new OpenHouseValidationError(
      "Adjunta el documento financiero requerido.",
      400,
      "unsafe_reused_document"
    );
  }
  const rows = await transaction.unsafe<{
    id: string;
    lead_id: string;
    document_type: ReusableFinancialDocument["documentType"];
    document_object_key: string;
    document_original_name: string;
    document_content_type: string;
    document_size_bytes: number | string;
  }[]>(
    `SELECT
       id::text,
       lead_id::text,
       document_type,
       document_object_key,
       document_original_name,
       document_content_type,
       document_size_bytes
     FROM public.property_buyer_profiles
     WHERE id = $1::uuid
       AND lead_id = $2::uuid
       AND document_type = $3
       AND document_status = 'uploaded'
       AND document_object_key = $4
       AND document_original_name = $5
       AND document_content_type = $6
       AND document_size_bytes = $7::bigint
     FOR SHARE`,
    [
      document.sourceProfileId,
      leadId,
      expectedType,
      document.objectKey,
      document.originalName,
      document.contentType,
      document.sizeBytes,
    ]
  );
  if (rows.length !== 1) {
    throw new OpenHouseValidationError(
      "Adjunta el documento financiero requerido.",
      400,
      "stale_reused_document"
    );
  }
  return document;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
