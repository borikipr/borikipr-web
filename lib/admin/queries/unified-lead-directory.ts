import { sql } from "@/lib/db";
import {
  CANONICAL_LEAD_PAGE_SIZE,
  CANONICAL_LEAD_SOURCE_RECORDS_CTE,
  type CanonicalLeadFilters,
  type CanonicalLeadSourceType,
} from "@/lib/admin/queries/canonical-leads";

export const UNIFIED_STATUS_LABELS = {
  new: "Nuevo",
  active: "Activo",
  on_hold: "En pausa",
  closed: "Cerrado",
  do_not_contact: "No contactar",
  archived: "Archivado",
} as const;

export type UnifiedDirectoryFilters = CanonicalLeadFilters & {
  status: keyof typeof UNIFIED_STATUS_LABELS | "all";
  showIndividuals: boolean;
};

export type UnifiedDirectoryItem = {
  entityType: "lead" | "group";
  id: string;
  name: string;
  memberNames: string[];
  personCount: number;
  email: string | null;
  phone: string | null;
  status: string;
  primarySource: CanonicalLeadSourceType | null;
  sourceTypes: CanonicalLeadSourceType[];
  sourceCount: number;
  contextTitle: string | null;
  contextDetail: string | null;
  nextFollowUpAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  sharedContact: boolean;
};

export type UnifiedDirectory = {
  items: UnifiedDirectoryItem[];
  total: number;
  totalPages: number;
};

type SqlQuery = {
  text: string;
  values: unknown[];
};

export type OperationalPropertyCount = {
  propertyId: string;
  contactCount: number;
};

function iso(value: string | Date) {
  return new Date(value).toISOString();
}

function optionalIso(value: string | Date | null) {
  return value ? iso(value) : null;
}

export function normalizeUnifiedDirectoryFilters(
  filters: CanonicalLeadFilters,
  params: Record<string, string | string[] | undefined>
): UnifiedDirectoryFilters {
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const rawStatus = first(params.status) ?? "all";
  return {
    ...filters,
    status: rawStatus in UNIFIED_STATUS_LABELS
      ? rawStatus as keyof typeof UNIFIED_STATUS_LABELS
      : "all",
    showIndividuals: first(params.individuals) === "1",
  };
}

export function buildUnifiedDirectoryEntitiesCte(
  showIndividualsExpression: string
) {
  return `${CANONICAL_LEAD_SOURCE_RECORDS_CTE},
    active_members AS (
      SELECT gm.group_id, gm.lead_id, gm.role, gm.is_primary_contact
      FROM public.lead_group_members gm
      INNER JOIN public.leads l ON l.id=gm.lead_id
      WHERE gm.removed_at IS NULL AND l.merged_into_lead_id IS NULL
    ),
    group_sources AS (
      SELECT am.group_id, count(sr.lead_id)::int AS source_count,
        COALESCE(array_agg(DISTINCT sr.source_type ORDER BY sr.source_type)
          FILTER (WHERE sr.source_type IS NOT NULL), ARRAY[]::text[]) AS source_types,
        COALESCE(array_agg(DISTINCT sr.property_id::text)
          FILTER (WHERE sr.property_id IS NOT NULL), ARRAY[]::text[]) AS property_ids,
        max(sr.created_at) AS latest_source_at
      FROM active_members am LEFT JOIN source_records sr ON sr.lead_id=am.lead_id
      GROUP BY am.group_id
    ),
    group_entities AS (
      SELECT 'group'::text AS entity_type, g.id::text AS id, g.title AS name,
        (SELECT jsonb_agg(ml.name ORDER BY am.is_primary_contact DESC, lower(ml.name), ml.id)
          FROM active_members am JOIN public.leads ml ON ml.id=am.lead_id WHERE am.group_id=g.id) AS member_names,
        (SELECT count(*)::int FROM active_members am WHERE am.group_id=g.id) AS person_count,
        primary_lead.email_original AS email, primary_lead.phone_original AS phone,
        g.status, recent.source_type AS primary_source,
        COALESCE(gs.source_types, ARRAY[]::text[]) AS source_types,
        COALESCE(gs.source_count, 0)::int AS source_count,
        COALESCE(p.titulo, recent.property_title) AS context_title,
        COALESCE(p.municipio, recent.municipality, recent.property_slug) AS context_detail,
        g.next_follow_up_at, g.created_at,
        GREATEST(g.updated_at, COALESCE(gs.latest_source_at, g.updated_at),
          COALESCE((SELECT max(l.last_activity_at) FROM active_members am JOIN public.leads l ON l.id=am.lead_id WHERE am.group_id=g.id), g.updated_at),
          COALESCE((SELECT max(created_at) FROM public.lead_group_events ge WHERE ge.group_id=g.id), g.updated_at),
          COALESCE((SELECT max(created_at) FROM public.lead_group_notes gn WHERE gn.group_id=g.id), g.updated_at)) AS last_activity_at,
        COALESCE(gs.property_ids, ARRAY[]::text[]) || CASE WHEN g.primary_property_id IS NULL THEN ARRAY[]::text[] ELSE ARRAY[g.primary_property_id::text] END AS property_ids,
        concat_ws(' ', g.title, p.titulo, p.slug,
          (SELECT string_agg(concat_ws(' ', ml.name, ml.email_original, ml.email_normalized, ml.phone_original, ml.phone_normalized), ' ')
           FROM active_members am JOIN public.leads ml ON ml.id=am.lead_id WHERE am.group_id=g.id),
          (SELECT string_agg(DISTINCT concat_ws(' ', sr.property_title, sr.property_slug, sr.municipality), ' ')
           FROM active_members am JOIN source_records sr ON sr.lead_id=am.lead_id WHERE am.group_id=g.id)) AS search_text,
        EXISTS (
          SELECT 1 FROM active_members a JOIN public.leads la ON la.id=a.lead_id
          JOIN active_members b ON b.group_id=a.group_id AND b.lead_id<>a.lead_id
          JOIN public.leads lb ON lb.id=b.lead_id
          WHERE a.group_id=g.id AND (
            (la.email_normalized IS NOT NULL AND la.email_normalized=lb.email_normalized)
            OR (la.phone_normalized IS NOT NULL AND la.phone_normalized=lb.phone_normalized)
          )
        ) AS shared_contact
      FROM public.lead_groups g
      LEFT JOIN public.propiedades p ON p.id=g.primary_property_id
      LEFT JOIN active_members primary_member ON primary_member.group_id=g.id AND primary_member.is_primary_contact
      LEFT JOIN public.leads primary_lead ON primary_lead.id=primary_member.lead_id
      LEFT JOIN group_sources gs ON gs.group_id=g.id
      LEFT JOIN LATERAL (
        SELECT sr.* FROM active_members am JOIN source_records sr ON sr.lead_id=am.lead_id
        WHERE am.group_id=g.id ORDER BY sr.created_at DESC, sr.source_type LIMIT 1
      ) recent ON true
      WHERE g.archived_at IS NULL
    ),
    lead_entities AS (
      SELECT 'lead'::text AS entity_type, l.id::text AS id, l.name,
        jsonb_build_array(l.name) AS member_names, 1::int AS person_count,
        l.email_original AS email, l.phone_original AS phone, l.status,
        recent.source_type AS primary_source,
        COALESCE(sa.source_types, ARRAY[]::text[]) AS source_types,
        COALESCE(sa.source_count, 0)::int AS source_count,
        recent.property_title AS context_title,
        COALESCE(recent.municipality, recent.property_slug) AS context_detail,
        l.next_follow_up_at, l.created_at,
        GREATEST(l.last_activity_at, COALESCE(sa.latest_source_at, l.last_activity_at)) AS last_activity_at,
        COALESCE((SELECT array_agg(DISTINCT sr.property_id::text) FILTER (WHERE sr.property_id IS NOT NULL) FROM source_records sr WHERE sr.lead_id=l.id), ARRAY[]::text[]) AS property_ids,
        concat_ws(' ', l.name, l.email_original, l.email_normalized, l.phone_original, l.phone_normalized) AS search_text,
        EXISTS (SELECT 1 FROM public.leads other WHERE other.id<>l.id AND other.merged_into_lead_id IS NULL AND (
          (l.email_normalized IS NOT NULL AND l.email_normalized=other.email_normalized)
          OR (l.phone_normalized IS NOT NULL AND l.phone_normalized=other.phone_normalized))) AS shared_contact
      FROM public.leads l
      LEFT JOIN source_aggregates sa ON sa.lead_id=l.id
      LEFT JOIN source_ranked recent ON recent.lead_id=l.id AND recent.source_rank=1
      WHERE l.merged_into_lead_id IS NULL
        AND (${showIndividualsExpression} OR NOT EXISTS (
          SELECT 1 FROM public.lead_group_members gm JOIN public.lead_groups g ON g.id=gm.group_id
          WHERE gm.lead_id=l.id AND gm.removed_at IS NULL AND g.archived_at IS NULL
        ))
    ),
    entities AS (
      SELECT * FROM lead_entities
      UNION ALL
      SELECT * FROM group_entities WHERE NOT ${showIndividualsExpression}
    )`;
}

export function buildUnifiedLeadDirectoryQuery(
  filters: UnifiedDirectoryFilters
): SqlQuery {
  const values: unknown[] = [filters.showIndividuals];
  const add = (value: unknown) => { values.push(value); return `$${values.length}`; };
  const conditions: string[] = [];
  if (filters.search) conditions.push(`search_text ILIKE ${add(`%${filters.search}%`)}`);
  if (filters.status !== "all") conditions.push(`status=${add(filters.status)}`);
  if (filters.source !== "all") conditions.push(`${add(filters.source)}=ANY(source_types)`);
  if (filters.propertyId) conditions.push(`${add(filters.propertyId)}=ANY(property_ids)`);
  if (filters.range === "today") conditions.push("created_at >= date_trunc('day', now())");
  else if (filters.range === "7d") conditions.push("created_at >= now() - interval '7 days'");
  else if (filters.range === "30d") conditions.push("created_at >= now() - interval '30 days'");
  const orderBy = {
    recent: "last_activity_at DESC, id DESC",
    oldest: "created_at ASC, id ASC",
    name_asc: "lower(name) ASC, id ASC",
    name_desc: "lower(name) DESC, id DESC",
  }[filters.sort];
  const limit = add(CANONICAL_LEAD_PAGE_SIZE);
  const offset = add((filters.page - 1) * CANONICAL_LEAD_PAGE_SIZE);
  return {
    text: `WITH ${buildUnifiedDirectoryEntitiesCte("$1::boolean")}
    SELECT *, count(*) OVER () AS filtered_total FROM entities
    ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
    ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
    values,
  };
}

export function buildOperationalPropertyCountsQuery(): SqlQuery {
  return {
    text: `WITH ${buildUnifiedDirectoryEntitiesCte("FALSE")},
      entity_properties AS (
        SELECT DISTINCT
          entity_type,
          id,
          unnest(property_ids) AS property_id
        FROM entities
      )
      SELECT
        property_id,
        count(*)::int AS contact_count
      FROM entity_properties
      GROUP BY property_id`,
    values: [],
  };
}

export async function getOperationalPropertyCounts() {
  const query = buildOperationalPropertyCountsQuery();
  const rows = await sql.unsafe<Array<{
    property_id: string;
    contact_count: number | string;
  }>>(query.text, query.values as never[]);
  return rows.map((row) => ({
    propertyId: row.property_id,
    contactCount: Number(row.contact_count),
  })) satisfies OperationalPropertyCount[];
}

export async function getUnifiedLeadDirectory(filters: UnifiedDirectoryFilters): Promise<UnifiedDirectory> {
  const query = buildUnifiedLeadDirectoryQuery(filters);
  const rows = await sql.unsafe<Array<Record<string, unknown>>>(
    query.text,
    query.values as never[]
  );
  const total = Number(rows[0]?.filtered_total ?? 0);
  return {
    items: rows.map((row) => ({
      entityType: row.entity_type as "lead" | "group",
      id: String(row.id), name: String(row.name),
      memberNames: (row.member_names as string[] | null) ?? [], personCount: Number(row.person_count),
      email: row.email ? String(row.email) : null, phone: row.phone ? String(row.phone) : null,
      status: String(row.status), primarySource: row.primary_source as CanonicalLeadSourceType | null,
      sourceTypes: (row.source_types as CanonicalLeadSourceType[] | null) ?? [], sourceCount: Number(row.source_count),
      contextTitle: row.context_title ? String(row.context_title) : null,
      contextDetail: row.context_detail ? String(row.context_detail) : null,
      nextFollowUpAt: optionalIso(row.next_follow_up_at as string | Date | null),
      lastActivityAt: iso(row.last_activity_at as string | Date), createdAt: iso(row.created_at as string | Date),
      sharedContact: Boolean(row.shared_contact),
    })),
    total,
    totalPages: Math.max(1, Math.ceil(total / CANONICAL_LEAD_PAGE_SIZE)),
  };
}
