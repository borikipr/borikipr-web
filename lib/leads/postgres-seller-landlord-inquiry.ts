import { randomUUID } from "crypto";
import type postgres from "postgres";
import { sql } from "@/lib/db";
import { createPostgresLeadResolverInTransaction } from "./postgres-resolver";
import type {
  ParsedSellerLandlordInquiry,
  SellerLandlordPrimaryReason,
  SellerLandlordPropertyType,
} from "./seller-landlord-inquiry";

type SellerLandlordInquiryRow = {
  id: string;
  lead_id: string;
  name_snapshot: string;
  email_snapshot: string;
  phone_snapshot: string;
  property_type: SellerLandlordPropertyType | null;
  location: string | null;
  primary_reason: SellerLandlordPrimaryReason | null;
  comments: string | null;
  created_at: Date;
};

export type PersistedSellerLandlordInquiry = {
  id: string;
  leadId: string;
  created: boolean;
  nameSnapshot: string;
  emailSnapshot: string;
  phoneSnapshot: string;
  propertyType: SellerLandlordPropertyType | null;
  location: string | null;
  primaryReason: SellerLandlordPrimaryReason | null;
  comments: string | null;
  createdAt: Date;
};

export async function persistSellerLandlordInquiry(
  input: ParsedSellerLandlordInquiry
): Promise<PersistedSellerLandlordInquiry> {
  try {
    const result = await sql.begin(async (transaction) => {
      const existing = await findByIdempotencyKey(
        transaction,
        input.idempotencyKey
      );
      if (existing) {
        return mapInquiryRow(existing, false);
      }

      const resolver = createPostgresLeadResolverInTransaction(transaction);
      const resolved = await resolver.resolveOrCreate({
        name: input.name,
        email: input.email,
        phone: input.phone,
      });

      const rows = await transaction.unsafe<SellerLandlordInquiryRow[]>(
        `INSERT INTO public.seller_landlord_inquiries (
           id,
           lead_id,
           name_snapshot,
           email_snapshot,
           phone_snapshot,
           property_type,
           location,
           primary_reason,
           comments,
           idempotency_key,
           source_path
         ) VALUES (
           $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9,
           $10::uuid, $11
         )
         RETURNING
           id::text,
           lead_id::text,
           name_snapshot,
           email_snapshot,
           phone_snapshot,
           property_type,
           location,
           primary_reason,
           comments,
           created_at`,
        [
          randomUUID(),
          resolved.lead.id,
          input.name,
          input.email,
          input.phone,
          input.propertyType,
          input.location,
          input.primaryReason,
          input.comments,
          input.idempotencyKey,
          "/contact/vendedor-arrendador",
        ]
      );

      return mapInquiryRow(rows[0], true);
    });

    return result as PersistedSellerLandlordInquiry;
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    const existing = await findExistingOutsideTransaction(input.idempotencyKey);
    if (existing) {
      return mapInquiryRow(existing, false);
    }

    throw error;
  }
}

async function findByIdempotencyKey(
  transaction: postgres.TransactionSql,
  idempotencyKey: string
) {
  const rows = await transaction.unsafe<SellerLandlordInquiryRow[]>(
    inquiryLookupSql,
    [idempotencyKey]
  );
  return rows[0] || null;
}

async function findExistingOutsideTransaction(idempotencyKey: string) {
  const rows = await sql.unsafe<SellerLandlordInquiryRow[]>(inquiryLookupSql, [
    idempotencyKey,
  ]);
  return rows[0] || null;
}

const inquiryLookupSql = `SELECT
   id::text,
   lead_id::text,
   name_snapshot,
   email_snapshot,
   phone_snapshot,
   property_type,
   location,
   primary_reason,
   comments,
   created_at
 FROM public.seller_landlord_inquiries
 WHERE idempotency_key = $1::uuid
 LIMIT 1`;

function mapInquiryRow(
  row: SellerLandlordInquiryRow,
  created: boolean
): PersistedSellerLandlordInquiry {
  return {
    id: row.id,
    leadId: row.lead_id,
    created,
    nameSnapshot: row.name_snapshot,
    emailSnapshot: row.email_snapshot,
    phoneSnapshot: row.phone_snapshot,
    propertyType: row.property_type,
    location: row.location,
    primaryReason: row.primary_reason,
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
