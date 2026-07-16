import { randomUUID } from "crypto";
import type postgres from "postgres";
import { sql } from "@/lib/db";
import { createPostgresLeadResolverInTransaction } from "./postgres-resolver";
import type {
  BuyerTenantBathrooms,
  BuyerTenantBedrooms,
  BuyerTenantInterest,
  BuyerTenantPropertyType,
  ParsedBuyerTenantInquiry,
} from "./buyer-tenant-inquiry";

type BuyerTenantInquiryRow = {
  id: string;
  lead_id: string;
  name_snapshot: string;
  email_snapshot: string | null;
  phone_snapshot: string;
  primary_interest: BuyerTenantInterest | null;
  purchase_qualification: string | null;
  budget: string | null;
  municipalities: string | null;
  property_types: BuyerTenantPropertyType[] | null;
  bedrooms: BuyerTenantBedrooms | null;
  bathrooms: BuyerTenantBathrooms | null;
  comments: string | null;
  created_at: Date;
};

export type PersistedBuyerTenantInquiry = {
  id: string;
  leadId: string;
  created: boolean;
  nameSnapshot: string;
  emailSnapshot: string | null;
  phoneSnapshot: string;
  primaryInterest: BuyerTenantInterest | null;
  purchaseQualification: string | null;
  budget: string | null;
  municipalities: string | null;
  propertyTypes: BuyerTenantPropertyType[] | null;
  bedrooms: BuyerTenantBedrooms | null;
  bathrooms: BuyerTenantBathrooms | null;
  comments: string | null;
  createdAt: Date;
};

export async function persistBuyerTenantInquiry(
  input: ParsedBuyerTenantInquiry
): Promise<PersistedBuyerTenantInquiry> {
  try {
    const result = await sql.begin(async (transaction) => {
      const existing = await findByIdempotencyKey(
        transaction,
        input.idempotencyKey
      );
      if (existing) return mapInquiryRow(existing, false);

      const resolver = createPostgresLeadResolverInTransaction(transaction);
      const resolved = await resolver.resolveOrCreate({
        name: input.name,
        email: input.email,
        phone: input.phone,
      });

      const rows = await transaction.unsafe<BuyerTenantInquiryRow[]>(
        `INSERT INTO public.buyer_tenant_inquiries (
           id, lead_id, name_snapshot, email_snapshot, phone_snapshot,
           primary_interest, purchase_qualification, budget, municipalities,
           property_types, bedrooms, bathrooms, comments,
           idempotency_key, source_path
         ) VALUES (
           $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9,
           $10::text[], $11, $12, $13, $14::uuid, $15
         )
         RETURNING
           id::text, lead_id::text, name_snapshot, email_snapshot,
           phone_snapshot, primary_interest, purchase_qualification, budget,
           municipalities, property_types, bedrooms, bathrooms, comments,
           created_at`,
        [
          randomUUID(),
          resolved.lead.id,
          input.name,
          input.email,
          input.phone,
          input.primaryInterest,
          input.purchaseQualification,
          input.budget,
          input.municipalities,
          input.propertyTypes,
          input.bedrooms,
          input.bathrooms,
          input.comments,
          input.idempotencyKey,
          "/contact/compradores-arrendatarios",
        ]
      );

      return mapInquiryRow(rows[0], true);
    });

    return result as PersistedBuyerTenantInquiry;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    const existing = await findExistingOutsideTransaction(input.idempotencyKey);
    if (existing) return mapInquiryRow(existing, false);
    throw error;
  }
}

async function findByIdempotencyKey(
  transaction: postgres.TransactionSql,
  idempotencyKey: string
) {
  const rows = await transaction.unsafe<BuyerTenantInquiryRow[]>(lookupSql, [
    idempotencyKey,
  ]);
  return rows[0] || null;
}

async function findExistingOutsideTransaction(idempotencyKey: string) {
  const rows = await sql.unsafe<BuyerTenantInquiryRow[]>(lookupSql, [
    idempotencyKey,
  ]);
  return rows[0] || null;
}

const lookupSql = `SELECT
   id::text, lead_id::text, name_snapshot, email_snapshot, phone_snapshot,
   primary_interest, purchase_qualification, budget, municipalities,
   property_types, bedrooms, bathrooms, comments, created_at
 FROM public.buyer_tenant_inquiries
 WHERE idempotency_key = $1::uuid
 LIMIT 1`;

function mapInquiryRow(
  row: BuyerTenantInquiryRow,
  created: boolean
): PersistedBuyerTenantInquiry {
  return {
    id: row.id,
    leadId: row.lead_id,
    created,
    nameSnapshot: row.name_snapshot,
    emailSnapshot: row.email_snapshot,
    phoneSnapshot: row.phone_snapshot,
    primaryInterest: row.primary_interest,
    purchaseQualification: row.purchase_qualification,
    budget: row.budget,
    municipalities: row.municipalities,
    propertyTypes: row.property_types,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    comments: row.comments,
    createdAt: new Date(row.created_at),
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
