import type { TransactionSql } from "postgres";
import type { LeadRelationshipType } from "@/lib/admin/queries/lead-360";

export type LeadRelationshipMutationResult = {
  status: "created" | "existing" | "updated" | "unchanged";
  relationshipId: string;
  relationshipType: LeadRelationshipType;
  relatedLeadId: string;
};

type CreateLeadRelationshipInput = {
  leadId: string;
  relatedLeadId: string;
  relationshipType: LeadRelationshipType;
  actorUsername: string;
  operationKey: string;
};

type UpdateLeadRelationshipInput = CreateLeadRelationshipInput & {
  relationshipId: string;
};

type RelationshipRow = {
  id: string;
  lead_id: string;
  related_lead_id: string;
  relationship_type: LeadRelationshipType;
};

async function lockActivePair(
  transaction: TransactionSql,
  firstLeadId: string,
  secondLeadId: string
) {
  const ordered = [firstLeadId, secondLeadId].sort();
  const rows = await transaction.unsafe<{ id: string }[]>(
    `SELECT id::text
    FROM public.leads
    WHERE id = ANY(ARRAY[$1::uuid, $2::uuid])
      AND merged_into_lead_id IS NULL
    ORDER BY id
    FOR UPDATE`,
    ordered
  );
  if (rows.length !== 2) throw new Error("No se encontraron ambas personas activas.");
}

async function findRelationship(
  transaction: TransactionSql,
  firstLeadId: string,
  secondLeadId: string,
  lock = false
) {
  const rows = await transaction.unsafe<RelationshipRow[]>(
    `SELECT id::text, lead_id::text, related_lead_id::text, relationship_type
    FROM public.lead_relationships
    WHERE LEAST(lead_id, related_lead_id) = LEAST($1::uuid, $2::uuid)
      AND GREATEST(lead_id, related_lead_id) = GREATEST($1::uuid, $2::uuid)
    ${lock ? "FOR UPDATE" : ""}`,
    [firstLeadId, secondLeadId]
  );
  return rows[0] ?? null;
}

function relatedFor(row: RelationshipRow, leadId: string) {
  return row.lead_id === leadId ? row.related_lead_id : row.lead_id;
}

async function operationAlreadyApplied(
  transaction: TransactionSql,
  operationKey: string
) {
  const rows = await transaction.unsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (
      SELECT 1 FROM public.lead_management_events
      WHERE idempotency_key = $1::uuid
    ) AS exists`,
    [operationKey]
  );
  return rows[0]?.exists ?? false;
}

async function recordRelationshipEvent(
  transaction: TransactionSql,
  input: CreateLeadRelationshipInput,
  relationshipId: string,
  action: "created" | "updated",
  previousRelationshipType: LeadRelationshipType | null
) {
  await transaction.unsafe(
    `INSERT INTO public.lead_management_events (
      lead_id, event_type, event_data, actor_username, idempotency_key
    ) VALUES (
      $1::uuid,
      'relationship_created',
      jsonb_build_object(
        'relationshipId', $2::uuid,
        'relatedLeadId', $3::uuid,
        'relationshipType', $4::text,
        'action', $5::text,
        'previousRelationshipType', $6::text
      ),
      $7,
      $8::uuid
    )`,
    [
      input.leadId,
      relationshipId,
      input.relatedLeadId,
      input.relationshipType,
      action,
      previousRelationshipType,
      input.actorUsername,
      input.operationKey,
    ]
  );
}

export async function createLeadRelationshipInTransaction(
  transaction: TransactionSql,
  input: CreateLeadRelationshipInput
): Promise<LeadRelationshipMutationResult> {
  if (input.leadId === input.relatedLeadId) throw new Error("Relación inválida.");
  await lockActivePair(transaction, input.leadId, input.relatedLeadId);

  const existing = await findRelationship(
    transaction,
    input.leadId,
    input.relatedLeadId,
    true
  );
  if (existing) {
    return {
      status: "existing",
      relationshipId: existing.id,
      relationshipType: existing.relationship_type,
      relatedLeadId: relatedFor(existing, input.leadId),
    };
  }
  if (await operationAlreadyApplied(transaction, input.operationKey)) {
    throw new Error("La operación ya fue aplicada sin una relación disponible.");
  }

  const [orderedLeadId, orderedRelatedLeadId] = [input.leadId, input.relatedLeadId].sort();
  const inserted = await transaction.unsafe<RelationshipRow[]>(
    `INSERT INTO public.lead_relationships (
      lead_id, related_lead_id, relationship_type, created_by
    ) VALUES ($1::uuid, $2::uuid, $3::text, $4)
    ON CONFLICT (
      LEAST(lead_id, related_lead_id),
      GREATEST(lead_id, related_lead_id)
    ) DO NOTHING
    RETURNING id::text, lead_id::text, related_lead_id::text, relationship_type`,
    [orderedLeadId, orderedRelatedLeadId, input.relationshipType, input.actorUsername]
  );
  const relationship = inserted[0]
    ?? await findRelationship(transaction, input.leadId, input.relatedLeadId, true);
  if (!relationship) throw new Error("No se pudo confirmar la relación.");
  if (!inserted[0]) {
    return {
      status: "existing",
      relationshipId: relationship.id,
      relationshipType: relationship.relationship_type,
      relatedLeadId: relatedFor(relationship, input.leadId),
    };
  }

  await recordRelationshipEvent(transaction, input, relationship.id, "created", null);
  return {
    status: "created",
    relationshipId: relationship.id,
    relationshipType: relationship.relationship_type,
    relatedLeadId: relatedFor(relationship, input.leadId),
  };
}

export async function updateLeadRelationshipInTransaction(
  transaction: TransactionSql,
  input: UpdateLeadRelationshipInput
): Promise<LeadRelationshipMutationResult> {
  const candidateRows = await transaction.unsafe<RelationshipRow[]>(
    `SELECT id::text, lead_id::text, related_lead_id::text, relationship_type
    FROM public.lead_relationships
    WHERE id = $1::uuid
      AND (lead_id = $2::uuid OR related_lead_id = $2::uuid)`,
    [input.relationshipId, input.leadId]
  );
  const candidate = candidateRows[0];
  if (!candidate) throw new Error("Relación no encontrada.");
  const actualRelatedLeadId = relatedFor(candidate, input.leadId);
  if (actualRelatedLeadId !== input.relatedLeadId) throw new Error("Relación inválida.");

  await lockActivePair(transaction, input.leadId, actualRelatedLeadId);
  const currentRows = await transaction.unsafe<RelationshipRow[]>(
    `SELECT id::text, lead_id::text, related_lead_id::text, relationship_type
    FROM public.lead_relationships
    WHERE id = $1::uuid
      AND (lead_id = $2::uuid OR related_lead_id = $2::uuid)
    FOR UPDATE`,
    [input.relationshipId, input.leadId]
  );
  const current = currentRows[0];
  if (!current || relatedFor(current, input.leadId) !== actualRelatedLeadId) {
    throw new Error("Relación no encontrada.");
  }
  if (current.relationship_type === input.relationshipType) {
    return {
      status: "unchanged",
      relationshipId: current.id,
      relationshipType: current.relationship_type,
      relatedLeadId: actualRelatedLeadId,
    };
  }
  if (await operationAlreadyApplied(transaction, input.operationKey)) {
    return {
      status: "unchanged",
      relationshipId: current.id,
      relationshipType: current.relationship_type,
      relatedLeadId: actualRelatedLeadId,
    };
  }

  await transaction.unsafe(
    `UPDATE public.lead_relationships
    SET relationship_type = $2::text,
        updated_at = now()
    WHERE id = $1::uuid`,
    [current.id, input.relationshipType]
  );
  await recordRelationshipEvent(
    transaction,
    { ...input, relatedLeadId: actualRelatedLeadId },
    current.id,
    "updated",
    current.relationship_type
  );
  return {
    status: "updated",
    relationshipId: current.id,
    relationshipType: input.relationshipType,
    relatedLeadId: actualRelatedLeadId,
  };
}
