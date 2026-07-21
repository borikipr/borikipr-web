import type { TransactionSql } from "postgres";

export type MergeLeadStatus = "new" | "active" | "do_not_contact" | "archived" | "merged";

type LeadRow = {
  id: string;
  name: string;
  email_original: string | null;
  email_normalized: string | null;
  phone_original: string | null;
  phone_normalized: string | null;
  status: MergeLeadStatus;
  identity_status: string;
  first_seen_at: string | Date;
  last_activity_at: string | Date;
  created_at: string | Date;
  next_follow_up_at: string | Date | null;
  merged_into_lead_id: string | null;
};

type RelationshipRow = {
  id: string;
  lead_id: string;
  related_lead_id: string;
  relationship_type: string;
  created_by: string;
  created_at: string | Date;
  updated_at: string | Date;
};

type DuplicateReviewRow = {
  id: string;
  lead_id: string;
  compared_lead_id: string;
  decision: string;
  decided_by: string;
  created_at: string | Date;
  updated_at: string | Date;
};

export type MergeLeadsInput = {
  primaryLeadId: string;
  secondaryLeadId: string;
  actorUsername: string;
  operationKey: string;
};

export type MergeLeadsResult = {
  survivingLeadId: string;
  mergeEventId: string | null;
  alreadyMerged: boolean;
};

const SOURCE_TABLES = [
  "property_priority_registrations",
  "property_buyer_profiles",
  "buyer_tenant_inquiries",
  "seller_landlord_inquiries",
  "consultas_propiedad",
] as const;

const DEPENDENCY_TABLES = [
  ...SOURCE_TABLES,
  "lead_notes",
  "lead_management_events",
] as const;

const RELATIONSHIP_PRECEDENCE = [
  "prequalified_person",
  "primary_buyer",
  "co_buyer",
  "representative_contact",
  "family",
  "other",
] as const;

function iso(value: string | Date | null) {
  return value ? new Date(value).toISOString() : null;
}

function identitySnapshot(lead: LeadRow) {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email_original,
    emailNormalized: lead.email_normalized,
    phone: lead.phone_original,
    phoneNormalized: lead.phone_normalized,
    status: lead.status,
    identityStatus: lead.identity_status,
    firstSeenAt: iso(lead.first_seen_at),
    lastActivityAt: iso(lead.last_activity_at),
    createdAt: iso(lead.created_at),
    nextFollowUpAt: iso(lead.next_follow_up_at),
  };
}

export function resolveMergedLeadStatus(
  primaryStatus: MergeLeadStatus,
  secondaryStatus: MergeLeadStatus
): Exclude<MergeLeadStatus, "merged"> {
  if (primaryStatus === "merged" || secondaryStatus === "merged") {
    throw new Error("No se puede resolver el estado de un lead ya fusionado.");
  }
  const precedence: Exclude<MergeLeadStatus, "merged">[] = [
    "do_not_contact",
    "active",
    "new",
    "archived",
  ];
  return precedence.find((status) => status === primaryStatus || status === secondaryStatus) ?? "new";
}

export function resolveMergedFollowUp(
  primaryAt: string | Date | null,
  secondaryAt: string | Date | null
) {
  if (!primaryAt) return secondaryAt ? new Date(secondaryAt).toISOString() : null;
  if (!secondaryAt) return new Date(primaryAt).toISOString();
  return new Date(Math.min(new Date(primaryAt).getTime(), new Date(secondaryAt).getTime())).toISOString();
}

function mostInformativeRelationship(left: string, right: string) {
  const leftRank = RELATIONSHIP_PRECEDENCE.indexOf(left as never);
  const rightRank = RELATIONSHIP_PRECEDENCE.indexOf(right as never);
  if (leftRank === -1) return right;
  if (rightRank === -1) return left;
  return leftRank <= rightRank ? left : right;
}

async function lockLeadDependencies(transaction: TransactionSql, leadIds: string[]) {
  for (const table of DEPENDENCY_TABLES) {
    await transaction.unsafe(
      `SELECT id FROM public.${table} WHERE lead_id = ANY($1::uuid[]) FOR UPDATE`,
      [leadIds]
    );
  }
  await transaction.unsafe(
    "SELECT id FROM public.email_queue WHERE canonical_lead_id = ANY($1::uuid[]) FOR UPDATE",
    [leadIds]
  );
  await transaction.unsafe(
    `SELECT id FROM public.lead_relationships
      WHERE lead_id = ANY($1::uuid[]) OR related_lead_id = ANY($1::uuid[])
      FOR UPDATE`,
    [leadIds]
  );
  await transaction.unsafe(
    `SELECT id FROM public.lead_duplicate_reviews
      WHERE lead_id = ANY($1::uuid[]) OR compared_lead_id = ANY($1::uuid[])
      FOR UPDATE`,
    [leadIds]
  );
}

async function getAffectedCounts(transaction: TransactionSql, secondaryLeadId: string) {
  const rows = await transaction.unsafe<Record<string, number | string>[]>(
    `SELECT
      (SELECT count(*) FROM public.property_priority_registrations WHERE lead_id = $1::uuid) AS priority_registrations,
      (SELECT count(*) FROM public.property_buyer_profiles WHERE lead_id = $1::uuid) AS property_buyer_profiles,
      (SELECT count(*) FROM public.buyer_tenant_inquiries WHERE lead_id = $1::uuid) AS buyer_tenant_inquiries,
      (SELECT count(*) FROM public.seller_landlord_inquiries WHERE lead_id = $1::uuid) AS seller_landlord_inquiries,
      (SELECT count(*) FROM public.consultas_propiedad WHERE lead_id = $1::uuid) AS open_house_registrations,
      (SELECT count(*) FROM public.lead_notes WHERE lead_id = $1::uuid) AS notes,
      (SELECT count(*) FROM public.lead_management_events WHERE lead_id = $1::uuid) AS management_events,
      (SELECT count(*) FROM public.lead_relationships WHERE lead_id = $1::uuid OR related_lead_id = $1::uuid) AS relationships,
      (SELECT count(*) FROM public.lead_duplicate_reviews WHERE lead_id = $1::uuid OR compared_lead_id = $1::uuid) AS duplicate_reviews,
      (SELECT count(*) FROM public.email_queue WHERE canonical_lead_id = $1::uuid) AS email_queue_rows,
      (SELECT count(*) FROM public.property_buyer_profiles WHERE lead_id = $1::uuid AND document_status <> 'none')
        + (SELECT count(*) FROM public.consultas_propiedad WHERE lead_id = $1::uuid AND (
          carta_precalificacion_status IS NOT NULL AND carta_precalificacion_status <> 'none'
          OR evidencia_fondos_status IS NOT NULL AND evidencia_fondos_status <> 'none'
        )) AS documents`,
    [secondaryLeadId]
  );
  return Object.fromEntries(
    Object.entries(rows[0] ?? {}).map(([key, value]) => [key, Number(value)])
  );
}

async function repointRelationships(
  transaction: TransactionSql,
  primaryLeadId: string,
  secondaryLeadId: string,
  relationships: RelationshipRow[]
) {
  const conflicts: Array<{ otherLeadId: string; keptType: string; replacedType: string }> = [];
  const primaryByOther = new Map<string, RelationshipRow>();

  for (const relationship of relationships) {
    if (relationship.lead_id !== primaryLeadId && relationship.related_lead_id !== primaryLeadId) continue;
    const other = relationship.lead_id === primaryLeadId
      ? relationship.related_lead_id
      : relationship.lead_id;
    if (other !== secondaryLeadId) primaryByOther.set(other, relationship);
  }

  for (const relationship of relationships) {
    if (relationship.lead_id !== secondaryLeadId && relationship.related_lead_id !== secondaryLeadId) continue;
    const other = relationship.lead_id === secondaryLeadId
      ? relationship.related_lead_id
      : relationship.lead_id;

    if (other === primaryLeadId) {
      await transaction.unsafe("DELETE FROM public.lead_relationships WHERE id = $1::uuid", [relationship.id]);
      continue;
    }

    const existing = primaryByOther.get(other);
    const keptType = existing
      ? mostInformativeRelationship(existing.relationship_type, relationship.relationship_type)
      : relationship.relationship_type;
    if (existing && existing.relationship_type !== relationship.relationship_type) {
      conflicts.push({
        otherLeadId: other,
        keptType,
        replacedType: keptType === existing.relationship_type
          ? relationship.relationship_type
          : existing.relationship_type,
      });
    }

    const [left, right] = [primaryLeadId, other].sort();
    const inserted = await transaction.unsafe<{ id: string }[]>(
      `INSERT INTO public.lead_relationships (
        lead_id, related_lead_id, relationship_type, created_by, created_at, updated_at
      ) VALUES ($1::uuid, $2::uuid, $3, $4, $5::timestamptz, $6::timestamptz)
      ON CONFLICT (LEAST(lead_id, related_lead_id), GREATEST(lead_id, related_lead_id))
      DO UPDATE SET
        relationship_type = $3,
        created_at = LEAST(public.lead_relationships.created_at, EXCLUDED.created_at),
        updated_at = GREATEST(public.lead_relationships.updated_at, EXCLUDED.updated_at)
      RETURNING id::text`,
      [left, right, keptType, relationship.created_by, iso(relationship.created_at), iso(relationship.updated_at)]
    );
    primaryByOther.set(other, { ...relationship, id: inserted[0].id, lead_id: left, related_lead_id: right, relationship_type: keptType });
    await transaction.unsafe("DELETE FROM public.lead_relationships WHERE id = $1::uuid AND id <> $2::uuid", [relationship.id, inserted[0].id]);
  }
  return conflicts;
}

async function repointDuplicateReviews(
  transaction: TransactionSql,
  primaryLeadId: string,
  secondaryLeadId: string,
  reviews: DuplicateReviewRow[]
) {
  const conflicts: Array<{ otherLeadId: string; keptDecision: string; replacedDecision: string }> = [];
  const primaryByOther = new Map<string, DuplicateReviewRow>();

  for (const review of reviews) {
    if (review.lead_id !== primaryLeadId && review.compared_lead_id !== primaryLeadId) continue;
    const other = review.lead_id === primaryLeadId ? review.compared_lead_id : review.lead_id;
    if (other !== secondaryLeadId) primaryByOther.set(other, review);
  }

  for (const review of reviews) {
    if (review.lead_id !== secondaryLeadId && review.compared_lead_id !== secondaryLeadId) continue;
    const other = review.lead_id === secondaryLeadId ? review.compared_lead_id : review.lead_id;
    if (other === primaryLeadId) {
      await transaction.unsafe(
        `UPDATE public.lead_duplicate_reviews
        SET decision = 'merged', decided_by = $2, updated_at = now()
        WHERE id = $1::uuid`,
        [review.id, review.decided_by]
      );
      continue;
    }

    const existing = primaryByOther.get(other);
    const keptDecision = existing?.decision === "keep_separate" || review.decision === "keep_separate"
      ? "keep_separate"
      : "same_person";
    if (existing && existing.decision !== review.decision) {
      conflicts.push({
        otherLeadId: other,
        keptDecision,
        replacedDecision: keptDecision === existing.decision ? review.decision : existing.decision,
      });
    }
    const [left, right] = [primaryLeadId, other].sort();
    const inserted = await transaction.unsafe<{ id: string }[]>(
      `INSERT INTO public.lead_duplicate_reviews (
        lead_id, compared_lead_id, decision, decided_by, created_at, updated_at
      ) VALUES ($1::uuid, $2::uuid, $3, $4, $5::timestamptz, $6::timestamptz)
      ON CONFLICT (LEAST(lead_id, compared_lead_id), GREATEST(lead_id, compared_lead_id))
      DO UPDATE SET
        decision = $3,
        decided_by = EXCLUDED.decided_by,
        created_at = LEAST(public.lead_duplicate_reviews.created_at, EXCLUDED.created_at),
        updated_at = GREATEST(public.lead_duplicate_reviews.updated_at, EXCLUDED.updated_at)
      RETURNING id::text`,
      [left, right, keptDecision, review.decided_by, iso(review.created_at), iso(review.updated_at)]
    );
    primaryByOther.set(other, { ...review, id: inserted[0].id, lead_id: left, compared_lead_id: right, decision: keptDecision });
    await transaction.unsafe("DELETE FROM public.lead_duplicate_reviews WHERE id = $1::uuid AND id <> $2::uuid", [review.id, inserted[0].id]);
  }
  return conflicts;
}

export async function mergeLeadsInTransaction(
  transaction: TransactionSql,
  input: MergeLeadsInput
): Promise<MergeLeadsResult> {
  if (input.primaryLeadId === input.secondaryLeadId) {
    throw new Error("Selecciona dos personas diferentes.");
  }

  const existingOperations = await transaction.unsafe<{
    id: string;
    primary_lead_id: string;
    secondary_lead_id: string;
  }[]>(
    `SELECT id::text, primary_lead_id::text, secondary_lead_id::text
    FROM public.lead_merge_events WHERE operation_key = $1::uuid`,
    [input.operationKey]
  );
  if (existingOperations[0]) {
    if (
      existingOperations[0].primary_lead_id !== input.primaryLeadId
      || existingOperations[0].secondary_lead_id !== input.secondaryLeadId
    ) {
      throw new Error("La operación de fusión no coincide con la solicitud original.");
    }
    return {
      survivingLeadId: existingOperations[0].primary_lead_id,
      mergeEventId: existingOperations[0].id,
      alreadyMerged: true,
    };
  }

  const lockIds = [input.primaryLeadId, input.secondaryLeadId].sort();
  const leads = await transaction.unsafe<LeadRow[]>(
    `SELECT id::text, name, email_original, email_normalized, phone_original,
      phone_normalized, status, identity_status, first_seen_at, last_activity_at,
      created_at, next_follow_up_at, merged_into_lead_id::text
    FROM public.leads
    WHERE id = ANY($1::uuid[])
    ORDER BY id
    FOR UPDATE`,
    [lockIds]
  );
  if (leads.length !== 2) throw new Error("No se encontraron ambas identidades.");

  const primary = leads.find((lead) => lead.id === input.primaryLeadId)!;
  const secondary = leads.find((lead) => lead.id === input.secondaryLeadId)!;
  if (secondary.merged_into_lead_id === primary.id) {
    return { survivingLeadId: primary.id, mergeEventId: null, alreadyMerged: true };
  }
  if (primary.merged_into_lead_id || primary.status === "merged") {
    throw new Error("El lead principal ya fue fusionado. Abre el registro sobreviviente.");
  }
  if (secondary.merged_into_lead_id || secondary.status === "merged") {
    throw new Error("El lead secundario ya fue fusionado con otra identidad.");
  }

  await lockLeadDependencies(transaction, lockIds);
  const relationshipRows = await transaction.unsafe<RelationshipRow[]>(
    `SELECT id::text, lead_id::text, related_lead_id::text, relationship_type,
      created_by, created_at, updated_at
    FROM public.lead_relationships
    WHERE lead_id = ANY($1::uuid[]) OR related_lead_id = ANY($1::uuid[])
    ORDER BY id`,
    [lockIds]
  );
  const duplicateReviewRows = await transaction.unsafe<DuplicateReviewRow[]>(
    `SELECT id::text, lead_id::text, compared_lead_id::text, decision,
      decided_by, created_at, updated_at
    FROM public.lead_duplicate_reviews
    WHERE lead_id = ANY($1::uuid[]) OR compared_lead_id = ANY($1::uuid[])
    ORDER BY id`,
    [lockIds]
  );
  const affectedCounts = await getAffectedCounts(transaction, secondary.id);

  const resolvedStatus = resolveMergedLeadStatus(primary.status, secondary.status);
  const resolvedFollowUp = resolveMergedFollowUp(primary.next_follow_up_at, secondary.next_follow_up_at);
  const identityConflict = Boolean(
    primary.email_normalized && secondary.email_normalized
    && primary.email_normalized !== secondary.email_normalized
  ) || Boolean(
    primary.phone_normalized && secondary.phone_normalized
    && primary.phone_normalized !== secondary.phone_normalized
  );

  for (const table of SOURCE_TABLES) {
    await transaction.unsafe(
      `UPDATE public.${table} SET lead_id = $1::uuid WHERE lead_id = $2::uuid`,
      [primary.id, secondary.id]
    );
  }
  await transaction.unsafe(
    "UPDATE public.lead_notes SET lead_id = $1::uuid WHERE lead_id = $2::uuid",
    [primary.id, secondary.id]
  );
  await transaction.unsafe(
    `UPDATE public.lead_management_events
    SET lead_id = $1::uuid,
        event_data = event_data || jsonb_build_object('mergedFromLeadId', $2::text)
    WHERE lead_id = $2::uuid`,
    [primary.id, secondary.id]
  );
  await transaction.unsafe(
    "UPDATE public.email_queue SET canonical_lead_id = $1::uuid WHERE canonical_lead_id = $2::uuid",
    [primary.id, secondary.id]
  );

  const relationshipConflicts = await repointRelationships(
    transaction, primary.id, secondary.id, relationshipRows
  );
  const duplicateReviewConflicts = await repointDuplicateReviews(
    transaction, primary.id, secondary.id, duplicateReviewRows
  );

  const snapshot = {
    primary: identitySnapshot(primary),
    secondary: identitySnapshot(secondary),
    resolution: {
      primaryIdentityRetained: true,
      status: resolvedStatus,
      nextFollowUpAt: resolvedFollowUp,
      conflictingContactValues: identityConflict,
      relationshipConflicts,
      duplicateReviewConflicts,
    },
  };
  const mergeEvents = await transaction.unsafe<{ id: string }[]>(
    `INSERT INTO public.lead_merge_events (
      primary_lead_id, secondary_lead_id, actor_username, operation_key,
      identity_snapshot, affected_counts
    ) VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::jsonb, $6::jsonb)
    RETURNING id::text`,
    [primary.id, secondary.id, input.actorUsername, input.operationKey, JSON.stringify(snapshot), JSON.stringify(affectedCounts)]
  );

  await transaction.unsafe(
    `UPDATE public.leads
    SET status = $2,
        identity_status = $3,
        first_seen_at = LEAST(first_seen_at, $4::timestamptz),
        last_activity_at = GREATEST(last_activity_at, $5::timestamptz),
        next_follow_up_at = $6::timestamptz,
        updated_at = now()
    WHERE id = $1::uuid`,
    [
      primary.id,
      resolvedStatus,
      identityConflict ? "conflict" : "reviewed",
      iso(secondary.first_seen_at),
      iso(secondary.last_activity_at),
      resolvedFollowUp,
    ]
  );
  await transaction.unsafe(
    `UPDATE public.leads
    SET status = 'merged', merged_into_lead_id = $2::uuid,
        merged_at = now(), merged_by = $3, next_follow_up_at = NULL,
        updated_at = now()
    WHERE id = $1::uuid`,
    [secondary.id, primary.id, input.actorUsername]
  );
  await transaction.unsafe(
    `INSERT INTO public.lead_management_events (
      lead_id, event_type, event_data, actor_username, idempotency_key
    ) VALUES (
      $1::uuid, 'leads_merged',
      jsonb_build_object('mergeEventId', $2::text, 'mergedLeadId', $3::text),
      $4, $5::uuid
    )`,
    [primary.id, mergeEvents[0].id, secondary.id, input.actorUsername, input.operationKey]
  );

  return {
    survivingLeadId: primary.id,
    mergeEventId: mergeEvents[0].id,
    alreadyMerged: false,
  };
}
