import type postgres from "postgres";
import { sql } from "@/lib/db";
import { createPostgresLeadResolverInTransaction } from "./postgres-resolver";
import {
  persistPriorityRegistrationWithStore,
  type PriorityRegistrationPersistenceInput,
  type PriorityRegistrationProperty,
  type PriorityRegistrationTransaction,
} from "./priority-registration-persistence";

type PropertyRow = {
  id: string;
  slug: string;
  titulo: string;
  estado: string;
};

export async function persistPriorityRegistrationWithCanonicalLead(
  input: PriorityRegistrationPersistenceInput
) {
  return persistPriorityRegistrationWithStore(
    {
      async withTransaction(callback) {
        const result = await sql.begin(async (transaction) =>
          callback(createPriorityRegistrationTransaction(transaction))
        );
        return result as Awaited<ReturnType<typeof callback>>;
      },
    },
    input
  );
}

function createPriorityRegistrationTransaction(
  transaction: postgres.TransactionSql
): PriorityRegistrationTransaction {
  return {
    async lockProperty(propertyId, propertySlug) {
      const rows = await transaction.unsafe<PropertyRow[]>(
        `SELECT id::text, slug, titulo, estado
           FROM public.propiedades
          WHERE id = $1::uuid
            AND slug = $2
          LIMIT 1
          FOR SHARE`,
        [propertyId, propertySlug]
      );
      return rows[0] ? mapProperty(rows[0]) : null;
    },

    async lockDuplicateKey(propertyId, normalizedEmail) {
      await transaction.unsafe(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`priority-registration:${propertyId}:${normalizedEmail}`]
      );
    },

    async findDuplicate(propertyId, normalizedEmail) {
      const rows = await transaction.unsafe<
        { id: string; lead_id: string | null }[]
      >(
        `SELECT id::text, lead_id::text
           FROM public.property_priority_registrations
          WHERE property_id = $1::uuid
            AND lower(email) = $2
          LIMIT 1
          FOR UPDATE`,
        [propertyId, normalizedEmail]
      );
      return rows[0]
        ? { id: rows[0].id, leadId: rows[0].lead_id }
        : null;
    },

    async resolveLead(input) {
      const resolver = createPostgresLeadResolverInTransaction(transaction);
      const resolved = await resolver.resolveOrCreate(input);
      return { id: resolved.lead.id };
    },

    async insertRegistration({ registration, property, leadId }) {
      const rows = await transaction.unsafe<{ id: string }[]>(
        `INSERT INTO public.property_priority_registrations (
           property_id,
           property_slug,
           property_title,
           name,
           phone,
           email,
           purchase_type,
           purchase_other,
           prequalified_status,
           property_size,
           search_range,
           wants_visit,
           additional_info,
           source,
           lead_id
         ) VALUES (
           $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10,
           $11, $12::boolean, $13, 'registro_prioritario', $14::uuid
         )
         RETURNING id::text`,
        [
          property.id,
          property.slug,
          property.title,
          registration.name,
          registration.phone,
          registration.email,
          registration.purchaseType,
          registration.purchaseOther,
          registration.prequalifiedStatus,
          registration.propertySize,
          registration.searchRange,
          registration.wantsVisit,
          registration.additionalInfo,
          leadId,
        ]
      );
      return rows[0];
    },
  };
}

function mapProperty(row: PropertyRow): PriorityRegistrationProperty {
  return {
    id: row.id,
    slug: row.slug,
    title: row.titulo,
    status: row.estado,
  };
}
