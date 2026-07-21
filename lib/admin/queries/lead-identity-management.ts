import { sql } from "@/lib/db";
import {
  getLead360Detail,
  type Lead360Detail,
  type LeadStatus,
} from "@/lib/admin/queries/lead-360";

export const RELATED_PERSON_SEARCH_LIMIT = 10;

export type RelatedPersonSearchResult = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  emailExactMatch: boolean;
  phoneExactMatch: boolean;
};

export type LeadMergeHistoryItem = {
  id: string;
  secondaryLeadId: string;
  secondaryName: string;
  secondaryEmail: string | null;
  secondaryPhone: string | null;
  actorUsername: string;
  affectedCounts: Record<string, number>;
  createdAt: string;
};

export type LeadMergeComparisonSide = {
  detail: Lead360Detail;
  sourceCounts: Record<string, number>;
  relatedProperties: Array<{ title: string; slug: string | null }>;
};

export type LeadMergeComparison = {
  left: LeadMergeComparisonSide;
  right: LeadMergeComparisonSide;
  existingDecision: string | null;
  identifiers: {
    emailMatches: boolean;
    phoneMatches: boolean;
    emailDiffers: boolean;
    phoneDiffers: boolean;
  };
};

export type IdentitySqlQuery = { text: string; values: unknown[] };

function normalizedEmail(value: string) {
  const candidate = value.trim().toLowerCase();
  return candidate.includes("@") ? candidate : null;
}

function normalizedPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

export async function searchRelatedPeople(
  currentLeadId: string,
  search: string
): Promise<RelatedPersonSearchResult[]> {
  const query = search.trim().slice(0, 200);
  if (query.length < 2) return [];
  const built = buildRelatedPersonSearchQuery(currentLeadId, query);
  const rows = await sql.unsafe<Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: LeadStatus;
    email_exact_match: boolean;
    phone_exact_match: boolean;
  }>>(
    built.text,
    built.values as never[]
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    emailExactMatch: row.email_exact_match,
    phoneExactMatch: row.phone_exact_match,
  }));
}

export function buildRelatedPersonSearchQuery(
  currentLeadId: string,
  search: string
): IdentitySqlQuery {
  const query = search.trim().slice(0, 200);
  return {
    text: `SELECT
      id::text,
      name,
      email_original AS email,
      phone_original AS phone,
      status,
      ($3::text IS NOT NULL AND email_normalized = $3::text) AS email_exact_match,
      ($4::text IS NOT NULL AND phone_normalized = $4::text) AS phone_exact_match
    FROM public.leads
    WHERE id <> $1::uuid
      AND merged_into_lead_id IS NULL
      AND (
        name ILIKE $2
        OR COALESCE(email_original, '') ILIKE $2
        OR COALESCE(phone_original, '') ILIKE $2
        OR ($3::text IS NOT NULL AND email_normalized = $3::text)
        OR ($4::text IS NOT NULL AND phone_normalized = $4::text)
      )
    ORDER BY
      CASE
        WHEN ($3::text IS NOT NULL AND email_normalized = $3::text)
          OR ($4::text IS NOT NULL AND phone_normalized = $4::text)
        THEN 0 ELSE 1
      END,
      lower(name), id
    LIMIT ${RELATED_PERSON_SEARCH_LIMIT}`,
    values: [currentLeadId, `%${query}%`, normalizedEmail(query), normalizedPhone(query)],
  };
}

function comparisonSide(detail: Lead360Detail): LeadMergeComparisonSide {
  const sourceCounts: Record<string, number> = {};
  const propertyKeys = new Set<string>();
  const relatedProperties: Array<{ title: string; slug: string | null }> = [];
  for (const interaction of detail.interactions) {
    sourceCounts[interaction.sourceType] = (sourceCounts[interaction.sourceType] ?? 0) + 1;
    if (!interaction.propertyTitle) continue;
    const key = `${interaction.propertySlug ?? ""}:${interaction.propertyTitle}`;
    if (propertyKeys.has(key)) continue;
    propertyKeys.add(key);
    relatedProperties.push({ title: interaction.propertyTitle, slug: interaction.propertySlug });
  }
  return { detail, sourceCounts, relatedProperties };
}

export async function getLeadMergeComparison(
  leftLeadId: string,
  rightLeadId: string
): Promise<LeadMergeComparison | null> {
  const [left, right, reviewRows] = await Promise.all([
    getLead360Detail(leftLeadId),
    getLead360Detail(rightLeadId),
    sql.unsafe<Array<{ decision: string }>>(
      `SELECT decision
      FROM public.lead_duplicate_reviews
      WHERE LEAST(lead_id, compared_lead_id) = LEAST($1::uuid, $2::uuid)
        AND GREATEST(lead_id, compared_lead_id) = GREATEST($1::uuid, $2::uuid)`,
      [leftLeadId, rightLeadId]
    ),
  ]);
  if (!left || !right || left.identity.id === right.identity.id) return null;

  const leftEmail = left.identity.email?.trim().toLowerCase() || null;
  const rightEmail = right.identity.email?.trim().toLowerCase() || null;
  const leftPhone = left.identity.phone?.replace(/\D/g, "") || null;
  const rightPhone = right.identity.phone?.replace(/\D/g, "") || null;
  return {
    left: comparisonSide(left),
    right: comparisonSide(right),
    existingDecision: reviewRows[0]?.decision ?? null,
    identifiers: {
      emailMatches: Boolean(leftEmail && rightEmail && leftEmail === rightEmail),
      phoneMatches: Boolean(leftPhone && rightPhone && leftPhone === rightPhone),
      emailDiffers: Boolean(leftEmail && rightEmail && leftEmail !== rightEmail),
      phoneDiffers: Boolean(leftPhone && rightPhone && leftPhone !== rightPhone),
    },
  };
}

export async function getMergedLeadDestination(leadId: string) {
  const rows = await sql.unsafe<Array<{
    original_merged: boolean;
    survivor_id: string;
    survivor_name: string;
  }>>(
    `WITH RECURSIVE lineage AS (
      SELECT id, merged_into_lead_id, ARRAY[id] AS path, 0 AS depth
      FROM public.leads WHERE id = $1::uuid
      UNION ALL
      SELECT target.id, target.merged_into_lead_id, lineage.path || target.id, lineage.depth + 1
      FROM lineage
      INNER JOIN public.leads target ON target.id = lineage.merged_into_lead_id
      WHERE lineage.depth < 20 AND NOT target.id = ANY(lineage.path)
    ), original AS (
      SELECT merged_into_lead_id IS NOT NULL AS original_merged
      FROM public.leads WHERE id = $1::uuid
    )
    SELECT original.original_merged, survivor.id::text AS survivor_id, survivor.name AS survivor_name
    FROM original
    CROSS JOIN LATERAL (
      SELECT id FROM lineage WHERE merged_into_lead_id IS NULL ORDER BY depth DESC LIMIT 1
    ) final
    INNER JOIN public.leads survivor ON survivor.id = final.id`,
    [leadId]
  );
  return rows[0] ?? null;
}

export async function getLeadMergeHistory(leadId: string): Promise<LeadMergeHistoryItem[]> {
  const rows = await sql.unsafe<Array<{
    id: string;
    secondary_lead_id: string;
    identity_snapshot: {
      secondary?: { name?: string; email?: string | null; phone?: string | null };
    };
    actor_username: string;
    affected_counts: Record<string, number>;
    created_at: string | Date;
  }>>(
    `SELECT id::text, secondary_lead_id::text, identity_snapshot,
      actor_username, affected_counts, created_at
    FROM public.lead_merge_events
    WHERE primary_lead_id = $1::uuid
    ORDER BY created_at DESC, id DESC`,
    [leadId]
  );
  return rows.map((row) => ({
    id: row.id,
    secondaryLeadId: row.secondary_lead_id,
    secondaryName: row.identity_snapshot.secondary?.name ?? "Identidad fusionada",
    secondaryEmail: row.identity_snapshot.secondary?.email ?? null,
    secondaryPhone: row.identity_snapshot.secondary?.phone ?? null,
    actorUsername: row.actor_username,
    affectedCounts: row.affected_counts,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}
