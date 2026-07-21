import { randomUUID } from "crypto";
import type postgres from "postgres";
import { sql } from "@/lib/db";
import { createPostgresLeadResolverInTransaction } from "./postgres-resolver";
import {
  buildBuyerProfileDocumentObjectKey,
  BuyerProfileValidationError,
  type BuyerProfileDocumentStatus,
  type BuyerProfileDocumentType,
  type CanonicalBuyerProfileProperty,
  type ParsedPropertyBuyerProfile,
  validateBuyerProfileForProperty,
} from "./property-buyer-profile";

type ProfileRow = {
  id: string;
  lead_id: string;
  name_snapshot: string;
  email_snapshot: string | null;
  phone_snapshot: string;
  purchase_method: "Financiamiento" | "Cash" | "Otro";
  purchase_method_other: string | null;
  financial_institution: string | null;
  closing_funds: string | null;
  solar_contract_acceptance: string | null;
  comments: string | null;
  document_type: BuyerProfileDocumentType | null;
  document_object_key: string | null;
  document_original_name: string | null;
  document_content_type: string | null;
  document_size_bytes: number | string | null;
  document_status: BuyerProfileDocumentStatus;
  property_id: string;
  property_slug: string;
  property_title: string;
  municipio: string;
  sector_comunidad: string | null;
  property_status: string;
  placas_en_lease: boolean | null;
};

type PropertyRow = {
  id: string;
  slug: string;
  titulo: string;
  municipio: string;
  sector_comunidad: string | null;
  estado: string;
  placas_en_lease: boolean | null;
};

export type PersistedPropertyBuyerProfile = {
  id: string;
  leadId: string;
  created: boolean;
  nameSnapshot: string;
  emailSnapshot: string | null;
  phoneSnapshot: string;
  purchaseMethod: "Financiamiento" | "Cash" | "Otro";
  purchaseMethodOther: string | null;
  financialInstitution: string | null;
  closingFunds: string | null;
  solarContractAcceptance: string | null;
  comments: string | null;
  documentType: BuyerProfileDocumentType | null;
  documentObjectKey: string | null;
  documentOriginalName: string | null;
  documentContentType: string | null;
  documentSizeBytes: number | null;
  documentStatus: BuyerProfileDocumentStatus;
  property: CanonicalBuyerProfileProperty;
};

export async function persistPropertyBuyerProfile(
  input: ParsedPropertyBuyerProfile
): Promise<PersistedPropertyBuyerProfile> {
  try {
    const result = await sql.begin(async (transaction) => {
      const existing = await findByIdempotencyKey(transaction, input.idempotencyKey);
      if (existing) {
        return mapProfileRow(existing, false);
      }

      const properties = await transaction.unsafe<PropertyRow[]>(
        `SELECT
           id::text,
           slug,
           titulo,
           municipio,
           to_jsonb(propiedades)->>'sector_comunidad' AS sector_comunidad,
           estado,
           COALESCE(placas_en_lease, false) AS placas_en_lease
         FROM public.propiedades
         WHERE slug = $1
           AND (
             origen_listado = 'propio'
             OR (
               origen_listado IN (
                 'co_broke', 'co-broke', 'co broke', 'colaboracion', 'colaboración'
               )
               AND COALESCE(permiso_publicar_web, false) = true
             )
           )
         LIMIT 1
         FOR SHARE`,
        [input.propertySlug]
      );
      const propertyRow = properties[0];

      if (!propertyRow) {
        throw new BuyerProfileValidationError(
          "No encontramos la propiedad seleccionada.",
          400,
          "property_not_found"
        );
      }

      const property = mapPropertyRow(propertyRow);
      validateBuyerProfileForProperty(input, property);

      const resolver = createPostgresLeadResolverInTransaction(transaction);
      const resolved = await resolver.resolveOrCreate({
        name: input.name,
        email: input.email,
        phone: input.phone,
      });

      const profileId = randomUUID();
      const objectKey =
        input.file && input.documentType && input.documentExtension
          ? buildBuyerProfileDocumentObjectKey(
              profileId,
              input.documentType,
              input.documentExtension
            )
          : null;
      const documentStatus: BuyerProfileDocumentStatus = input.file
        ? "pending"
        : "none";

      const inserted = await transaction.unsafe<ProfileRow[]>(
        `INSERT INTO public.property_buyer_profiles (
           id,
           lead_id,
           property_id,
           name_snapshot,
           email_snapshot,
           phone_snapshot,
           purchase_method,
           purchase_method_other,
           financial_institution,
           closing_funds,
           solar_contract_acceptance,
           comments,
           document_type,
           document_object_key,
           document_original_name,
           document_content_type,
           document_size_bytes,
           document_status,
           idempotency_key,
           source_path
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10,
           $11, $12, $13, $14, $15, $16, $17, $18, $19::uuid, $20
         )
         RETURNING
           id::text,
           lead_id::text,
           name_snapshot,
           email_snapshot,
           phone_snapshot,
           purchase_method,
           purchase_method_other,
           financial_institution,
           closing_funds,
           solar_contract_acceptance,
           comments,
           document_type,
           document_object_key,
           document_original_name,
           document_content_type,
           document_size_bytes,
           document_status,
           property_id::text,
           $21::text AS property_slug,
           $22::text AS property_title,
           $23::text AS municipio,
           $24::text AS sector_comunidad,
           $25::text AS property_status,
           $26::boolean AS placas_en_lease`,
        [
          profileId,
          resolved.lead.id,
          property.id,
          input.name,
          input.email,
          input.phone,
          input.purchaseMethod,
          input.purchaseMethod === "Otro" ? input.purchaseMethodOther : null,
          input.purchaseMethod === "Financiamiento"
            ? input.financialInstitution
            : null,
          input.closingFunds,
          property.hasSolarLease ? input.solarContractAcceptance : null,
          input.comments,
          input.documentType,
          objectKey,
          input.file?.name || null,
          input.file?.type || null,
          input.file?.size ?? null,
          documentStatus,
          input.idempotencyKey,
          `/listados/${property.slug}/perfil-comprador`,
          property.slug,
          property.title,
          property.municipio,
          property.sectorComunidad,
          property.status,
          property.hasSolarLease,
        ]
      );

      return mapProfileRow(inserted[0], true);
    });

    return result as PersistedPropertyBuyerProfile;
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    const existing = await findExistingOutsideTransaction(input.idempotencyKey);
    if (existing) {
      return mapProfileRow(existing, false);
    }

    throw error;
  }
}

export async function updateBuyerProfileDocumentStatus(
  profileId: string,
  objectKey: string,
  status: "uploaded" | "failed"
) {
  const rows = await sql<{ id: string }[]>`
    UPDATE public.property_buyer_profiles
    SET document_status = ${status}
    WHERE id = ${profileId}
      AND document_object_key = ${objectKey}
      AND document_status IN ('pending', 'failed')
    RETURNING id::text
  `;

  return rows.length === 1;
}

async function findByIdempotencyKey(
  transaction: postgres.TransactionSql,
  idempotencyKey: string
) {
  const rows = await transaction.unsafe<ProfileRow[]>(profileLookupSql, [
    idempotencyKey,
  ]);
  return rows[0] || null;
}

async function findExistingOutsideTransaction(idempotencyKey: string) {
  const rows = await sql.unsafe<ProfileRow[]>(profileLookupSql, [idempotencyKey]);
  return rows[0] || null;
}

const profileLookupSql = `SELECT
   profile.id::text,
   profile.lead_id::text,
   profile.name_snapshot,
   profile.email_snapshot,
   profile.phone_snapshot,
   profile.purchase_method,
   profile.purchase_method_other,
   profile.financial_institution,
   profile.closing_funds,
   profile.solar_contract_acceptance,
   profile.comments,
   profile.document_type,
   profile.document_object_key,
   profile.document_original_name,
   profile.document_content_type,
   profile.document_size_bytes,
   profile.document_status,
   property.id::text AS property_id,
   property.slug AS property_slug,
   property.titulo AS property_title,
   property.municipio,
   to_jsonb(property)->>'sector_comunidad' AS sector_comunidad,
   property.estado AS property_status,
   COALESCE(property.placas_en_lease, false) AS placas_en_lease
 FROM public.property_buyer_profiles profile
 JOIN public.propiedades property ON property.id = profile.property_id
 WHERE profile.idempotency_key = $1::uuid
 LIMIT 1`;

function mapProfileRow(
  row: ProfileRow,
  created: boolean
): PersistedPropertyBuyerProfile {
  return {
    id: row.id,
    leadId: row.lead_id,
    created,
    nameSnapshot: row.name_snapshot,
    emailSnapshot: row.email_snapshot,
    phoneSnapshot: row.phone_snapshot,
    purchaseMethod: row.purchase_method,
    purchaseMethodOther: row.purchase_method_other,
    financialInstitution: row.financial_institution,
    closingFunds: row.closing_funds,
    solarContractAcceptance: row.solar_contract_acceptance,
    comments: row.comments,
    documentType: row.document_type,
    documentObjectKey: row.document_object_key,
    documentOriginalName: row.document_original_name,
    documentContentType: row.document_content_type,
    documentSizeBytes:
      row.document_size_bytes === null ? null : Number(row.document_size_bytes),
    documentStatus: row.document_status,
    property: {
      id: row.property_id,
      slug: row.property_slug,
      title: row.property_title,
      municipio: row.municipio,
      sectorComunidad: row.sector_comunidad,
      status: row.property_status,
      hasSolarLease: row.placas_en_lease === true,
    },
  };
}

function mapPropertyRow(row: PropertyRow): CanonicalBuyerProfileProperty {
  return {
    id: row.id,
    slug: row.slug,
    title: row.titulo,
    municipio: row.municipio,
    sectorComunidad: row.sector_comunidad,
    status: row.estado,
    hasSolarLease: row.placas_en_lease === true,
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
