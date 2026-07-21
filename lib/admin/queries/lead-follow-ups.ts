import { sql } from "@/lib/db";
import {
  CANONICAL_LEAD_SOURCE_LABELS,
  CANONICAL_LEAD_SOURCE_RECORDS_CTE,
  type CanonicalLeadPropertyOption,
  type CanonicalLeadSourceType,
} from "@/lib/admin/queries/canonical-leads";

export const ADMIN_TIME_ZONE = "America/Puerto_Rico";
export const INACTIVITY_DAYS = 14;

export const FOLLOW_UP_BUCKET_LABELS = {
  overdue: "Vencidos",
  today: "Para hoy",
  upcoming: "Próximos 7 días",
  new_without_follow_up: "Nuevos sin seguimiento",
  inactive: "Sin actividad reciente",
} as const;

export type FollowUpBucket = keyof typeof FOLLOW_UP_BUCKET_LABELS;
export type FollowUpSort = "urgency" | "newest" | "oldest_follow_up";
export type FollowUpStatus = "new" | "active";

export type LeadFollowUpFilters = {
  search: string;
  status: FollowUpStatus | "all";
  source: CanonicalLeadSourceType | "all";
  propertyId: string | null;
  bucket: FollowUpBucket | "all";
  sort: FollowUpSort;
  invalid: boolean;
  showIndividuals: boolean;
};

export type LeadFollowUpItem = {
  id: string;
  entityType: "lead" | "group";
  memberNames: string[];
  name: string;
  email: string | null;
  phone: string | null;
  status: FollowUpStatus;
  nextFollowUpAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  sourceTypes: CanonicalLeadSourceType[];
  propertyTitle: string | null;
  propertySlug: string | null;
  sharedContact: boolean;
  bucket: FollowUpBucket;
  secondaryFlags: FollowUpBucket[];
};

export type LeadFollowUpCenter = {
  items: LeadFollowUpItem[];
  summary: Record<FollowUpBucket, number>;
  properties: CanonicalLeadPropertyOption[];
};

type SqlQuery = { text: string; values: unknown[] };

const validBuckets = new Set(Object.keys(FOLLOW_UP_BUCKET_LABELS));
const validStatuses = new Set(["new", "active"]);
const validSorts = new Set(["urgency", "newest", "oldest_follow_up"]);

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeLeadFollowUpFilters(
  params: Record<string, string | string[] | undefined>
): LeadFollowUpFilters {
  const rawStatus = first(params.status) ?? "all";
  const rawSource = first(params.source) ?? "all";
  const rawBucket = first(params.bucket) ?? "all";
  const rawSort = first(params.sort) ?? "urgency";
  const propertyId = (first(params.property) ?? "").trim();
  const status = validStatuses.has(rawStatus) ? (rawStatus as FollowUpStatus) : "all";
  const source = rawSource in CANONICAL_LEAD_SOURCE_LABELS
    ? (rawSource as CanonicalLeadSourceType)
    : "all";
  const bucket = validBuckets.has(rawBucket) ? (rawBucket as FollowUpBucket) : "all";
  const sort = validSorts.has(rawSort) ? (rawSort as FollowUpSort) : "urgency";
  const invalid =
    (rawStatus !== "all" && status === "all") ||
    (rawSource !== "all" && source === "all") ||
    (rawBucket !== "all" && bucket === "all") ||
    rawSort !== sort;

  return {
    search: (first(params.q) ?? "").trim().slice(0, 320),
    status,
    source,
    propertyId: propertyId || null,
    bucket,
    sort,
    invalid,
    showIndividuals: first(params.individuals) === "1",
  };
}

function appendValue(values: unknown[], value: unknown) {
  values.push(value);
  return `$${values.length}`;
}

function classificationCte(referenceNowParameter: string) {
  return `
property_ranked AS (
  SELECT sr.*,
    row_number() OVER (PARTITION BY sr.lead_id ORDER BY sr.created_at DESC, sr.source_type ASC) AS property_rank
  FROM source_records sr
  WHERE sr.property_id IS NOT NULL
),
management_activity AS (
  SELECT lead_id, max(created_at) AS last_management_at
  FROM public.lead_management_events
  GROUP BY lead_id
),
follow_up_base AS (
  SELECT
    l.id,
    l.name,
    l.email_original AS email,
    l.phone_original AS phone,
    l.status,
    l.next_follow_up_at,
    GREATEST(l.last_activity_at, COALESCE(sa.latest_source_at, l.last_activity_at)) AS last_activity_at,
    l.created_at,
    COALESCE(sa.source_types, ARRAY[]::text[]) AS source_types,
    recent_property.property_title,
    recent_property.property_slug,
    EXISTS (
      SELECT 1
      FROM public.leads shared
      WHERE shared.id <> l.id
        AND shared.merged_into_lead_id IS NULL
        AND (
          (l.email_normalized IS NOT NULL AND shared.email_normalized = l.email_normalized)
          OR (l.phone_normalized IS NOT NULL AND shared.phone_normalized = l.phone_normalized)
        )
    ) AS shared_contact,
    l.next_follow_up_at < ${referenceNowParameter}::timestamptz AS is_overdue,
    l.next_follow_up_at >= ${referenceNowParameter}::timestamptz
      AND l.next_follow_up_at < (
        (date_trunc('day', ${referenceNowParameter}::timestamptz AT TIME ZONE '${ADMIN_TIME_ZONE}') + interval '1 day')
        AT TIME ZONE '${ADMIN_TIME_ZONE}'
      ) AS is_today,
    l.next_follow_up_at >= (
        (date_trunc('day', ${referenceNowParameter}::timestamptz AT TIME ZONE '${ADMIN_TIME_ZONE}') + interval '1 day')
        AT TIME ZONE '${ADMIN_TIME_ZONE}'
      )
      AND l.next_follow_up_at < (
        (date_trunc('day', ${referenceNowParameter}::timestamptz AT TIME ZONE '${ADMIN_TIME_ZONE}') + interval '8 days')
        AT TIME ZONE '${ADMIN_TIME_ZONE}'
      ) AS is_upcoming,
    l.status = 'new' AND l.next_follow_up_at IS NULL AS is_new_without_follow_up,
    GREATEST(
      l.last_activity_at,
      COALESCE(sa.latest_source_at, l.last_activity_at),
      COALESCE(ma.last_management_at, l.last_activity_at)
    ) < ${referenceNowParameter}::timestamptz - interval '${INACTIVITY_DAYS} days' AS is_inactive
  FROM public.leads l
  LEFT JOIN source_aggregates sa ON sa.lead_id = l.id
  LEFT JOIN property_ranked recent_property ON recent_property.lead_id = l.id AND recent_property.property_rank = 1
  LEFT JOIN management_activity ma ON ma.lead_id = l.id
  WHERE l.merged_into_lead_id IS NULL
    AND l.status IN ('new', 'active')
    AND ($2::boolean OR NOT EXISTS (
      SELECT 1 FROM public.lead_group_members grouped_member
      INNER JOIN public.lead_groups grouped_case ON grouped_case.id=grouped_member.group_id
      WHERE grouped_member.lead_id=l.id
        AND grouped_member.removed_at IS NULL
        AND grouped_case.archived_at IS NULL
    ))
),
classified AS (
  SELECT *,
    CASE
      WHEN is_overdue THEN 'overdue'
      WHEN is_today THEN 'today'
      WHEN is_upcoming THEN 'upcoming'
      WHEN is_new_without_follow_up THEN 'new_without_follow_up'
      WHEN is_inactive THEN 'inactive'
      ELSE NULL
    END AS bucket
  FROM follow_up_base
)
`;
}

export function buildLeadFollowUpListQuery(
  filters: LeadFollowUpFilters,
  referenceNow = new Date().toISOString()
): SqlQuery {
  const values: unknown[] = [referenceNow, filters.showIndividuals];
  const conditions = ["c.bucket IS NOT NULL"];

  if (filters.search) {
    const value = appendValue(values, `%${filters.search}%`);
    conditions.push(`(c.name ILIKE ${value} OR COALESCE(c.email, '') ILIKE ${value} OR COALESCE(c.phone, '') ILIKE ${value})`);
  }
  if (filters.status !== "all") {
    conditions.push(`c.status = ${appendValue(values, filters.status)}`);
  }
  if (filters.source !== "all") {
    const value = appendValue(values, filters.source);
    conditions.push(`EXISTS (SELECT 1 FROM source_records sf WHERE sf.lead_id = c.id AND sf.source_type = ${value})`);
  }
  if (filters.propertyId) {
    const value = appendValue(values, filters.propertyId);
    conditions.push(`EXISTS (SELECT 1 FROM source_records pf WHERE pf.lead_id = c.id AND pf.property_id::text = ${value})`);
  }
  if (filters.bucket !== "all") {
    conditions.push(`c.bucket = ${appendValue(values, filters.bucket)}`);
  }

  const orderBy = {
    urgency: `CASE c.bucket WHEN 'overdue' THEN 1 WHEN 'today' THEN 2 WHEN 'upcoming' THEN 3 WHEN 'new_without_follow_up' THEN 4 ELSE 5 END,
      CASE WHEN c.bucket IN ('overdue', 'today', 'upcoming') THEN c.next_follow_up_at END ASC NULLS LAST,
      CASE WHEN c.bucket = 'new_without_follow_up' THEN c.created_at END DESC NULLS LAST,
      c.last_activity_at ASC, c.id ASC`,
    newest: "c.created_at DESC, c.id DESC",
    oldest_follow_up: "c.next_follow_up_at ASC NULLS LAST, c.created_at DESC, c.id DESC",
  }[filters.sort];

  return {
    text: `WITH ${CANONICAL_LEAD_SOURCE_RECORDS_CTE},${classificationCte("$1")}
      SELECT
        c.id::text, c.name, c.email, c.phone, c.status, c.next_follow_up_at,
        c.last_activity_at, c.created_at, c.source_types,
        c.property_title, c.property_slug, c.shared_contact, c.bucket,
        ARRAY_REMOVE(ARRAY[
          CASE WHEN c.is_overdue AND c.bucket <> 'overdue' THEN 'overdue' END,
          CASE WHEN c.is_today AND c.bucket <> 'today' THEN 'today' END,
          CASE WHEN c.is_upcoming AND c.bucket <> 'upcoming' THEN 'upcoming' END,
          CASE WHEN c.is_new_without_follow_up AND c.bucket <> 'new_without_follow_up' THEN 'new_without_follow_up' END,
          CASE WHEN c.is_inactive AND c.bucket <> 'inactive' THEN 'inactive' END
        ]::text[], NULL) AS secondary_flags
      FROM classified c
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${orderBy}`,
    values,
  };
}

export function buildLeadFollowUpSummaryQuery(referenceNow = new Date().toISOString(), showIndividuals = false): SqlQuery {
  return {
    text: `WITH ${CANONICAL_LEAD_SOURCE_RECORDS_CTE},${classificationCte("$1")}
      SELECT bucket, count(*) AS count
      FROM classified
      WHERE bucket IS NOT NULL
      GROUP BY bucket`,
    values: [referenceNow, showIndividuals],
  };
}

export function buildLeadFollowUpPropertiesQuery(): SqlQuery {
  return {
    text: `WITH ${CANONICAL_LEAD_SOURCE_RECORDS_CTE}
      SELECT DISTINCT property_id::text AS id, property_title AS title, property_slug AS slug
      FROM source_records
      WHERE property_id IS NOT NULL AND property_title IS NOT NULL AND property_slug IS NOT NULL
      ORDER BY property_title, property_slug`,
    values: [],
  };
}

function iso(value: string | Date) {
  return new Date(value).toISOString();
}

export function buildLeadGroupFollowUpQuery(
  filters: LeadFollowUpFilters,
  referenceNow = new Date().toISOString()
): SqlQuery {
  const values: unknown[] = [referenceNow, filters.showIndividuals];
  const add = (value: unknown) => { values.push(value); return `$${values.length}`; };
  const conditions = ["classified.bucket IS NOT NULL"];
  if (filters.search) {
    const search = add(`%${filters.search}%`);
    conditions.push(`(classified.name ILIKE ${search} OR EXISTS (
      SELECT 1 FROM public.lead_group_members search_member
      INNER JOIN public.leads search_lead ON search_lead.id=search_member.lead_id
      WHERE search_member.group_id=classified.id AND search_member.removed_at IS NULL
        AND (search_lead.name ILIKE ${search} OR COALESCE(search_lead.email_original, '') ILIKE ${search} OR COALESCE(search_lead.phone_original, '') ILIKE ${search})
    ))`);
  }
  if (filters.status !== "all") conditions.push(`classified.status=${add(filters.status)}`);
  if (filters.source !== "all") conditions.push(`${add(filters.source)}=ANY(classified.source_types)`);
  if (filters.propertyId) {
    const propertyId = add(filters.propertyId);
    conditions.push(`(classified.property_id::text=${propertyId} OR EXISTS (
      SELECT 1 FROM public.lead_group_members property_member
      JOIN source_records property_source ON property_source.lead_id=property_member.lead_id
      WHERE property_member.group_id=classified.id AND property_member.removed_at IS NULL
        AND property_source.property_id::text=${propertyId}
    ))`);
  }
  if (filters.bucket !== "all") conditions.push(`classified.bucket=${add(filters.bucket)}`);
  return {
    text: `WITH ${CANONICAL_LEAD_SOURCE_RECORDS_CTE},
    active_members AS (
      SELECT gm.group_id, gm.lead_id FROM public.lead_group_members gm WHERE gm.removed_at IS NULL
    ),
    group_aggregates AS (
      SELECT g.id, g.title AS name,
        CASE WHEN g.status='new' THEN 'new' ELSE 'active' END AS status,
        g.next_follow_up_at,
        g.created_at,
        GREATEST(g.updated_at, max(l.last_activity_at), COALESCE(max(sr.created_at), g.updated_at)) AS last_activity_at,
        COALESCE(array_agg(DISTINCT sr.source_type ORDER BY sr.source_type) FILTER (WHERE sr.source_type IS NOT NULL), ARRAY[]::text[]) AS source_types,
        array_agg(DISTINCT l.name ORDER BY l.name) AS member_names,
        primary_lead.email_original AS email, primary_lead.phone_original AS phone,
        COALESCE(g.primary_property_id, (array_agg(sr.property_id ORDER BY sr.created_at DESC) FILTER (WHERE sr.property_id IS NOT NULL))[1]) AS property_id,
        COALESCE(primary_property.titulo, (array_agg(sr.property_title ORDER BY sr.created_at DESC) FILTER (WHERE sr.property_title IS NOT NULL))[1]) AS property_title,
        COALESCE(primary_property.slug, (array_agg(sr.property_slug ORDER BY sr.created_at DESC) FILTER (WHERE sr.property_slug IS NOT NULL))[1]) AS property_slug,
        bool_or(EXISTS (
          SELECT 1 FROM public.leads shared WHERE shared.id<>l.id AND shared.merged_into_lead_id IS NULL
            AND ((l.email_normalized IS NOT NULL AND shared.email_normalized=l.email_normalized) OR (l.phone_normalized IS NOT NULL AND shared.phone_normalized=l.phone_normalized))
        )) AS shared_contact
      FROM public.lead_groups g
      INNER JOIN active_members am ON am.group_id=g.id
      INNER JOIN public.leads l ON l.id=am.lead_id
      LEFT JOIN source_records sr ON sr.lead_id=l.id
      LEFT JOIN public.lead_group_members primary_member ON primary_member.group_id=g.id AND primary_member.is_primary_contact=true AND primary_member.removed_at IS NULL
      LEFT JOIN public.leads primary_lead ON primary_lead.id=primary_member.lead_id
      LEFT JOIN public.propiedades primary_property ON primary_property.id=g.primary_property_id
      WHERE g.status NOT IN ('closed', 'archived') AND g.archived_at IS NULL
      GROUP BY g.id, primary_lead.email_original, primary_lead.phone_original, primary_property.titulo, primary_property.slug
    ), flags AS (
      SELECT *,
        next_follow_up_at < $1::timestamptz AS is_overdue,
        next_follow_up_at >= $1::timestamptz AND next_follow_up_at < ((date_trunc('day', $1::timestamptz AT TIME ZONE '${ADMIN_TIME_ZONE}') + interval '1 day') AT TIME ZONE '${ADMIN_TIME_ZONE}') AS is_today,
        next_follow_up_at >= ((date_trunc('day', $1::timestamptz AT TIME ZONE '${ADMIN_TIME_ZONE}') + interval '1 day') AT TIME ZONE '${ADMIN_TIME_ZONE}')
          AND next_follow_up_at < ((date_trunc('day', $1::timestamptz AT TIME ZONE '${ADMIN_TIME_ZONE}') + interval '8 days') AT TIME ZONE '${ADMIN_TIME_ZONE}') AS is_upcoming,
        status='new' AND next_follow_up_at IS NULL AS is_new_without_follow_up,
        last_activity_at < $1::timestamptz - interval '${INACTIVITY_DAYS} days' AS is_inactive
      FROM group_aggregates
    ), classified AS (
      SELECT *, CASE WHEN is_overdue THEN 'overdue' WHEN is_today THEN 'today' WHEN is_upcoming THEN 'upcoming'
        WHEN is_new_without_follow_up THEN 'new_without_follow_up' WHEN is_inactive THEN 'inactive' ELSE NULL END AS bucket
      FROM flags
    )
    SELECT *, ARRAY_REMOVE(ARRAY[
      CASE WHEN is_overdue AND bucket<>'overdue' THEN 'overdue' END,
      CASE WHEN is_today AND bucket<>'today' THEN 'today' END,
      CASE WHEN is_upcoming AND bucket<>'upcoming' THEN 'upcoming' END,
      CASE WHEN is_new_without_follow_up AND bucket<>'new_without_follow_up' THEN 'new_without_follow_up' END,
      CASE WHEN is_inactive AND bucket<>'inactive' THEN 'inactive' END
    ]::text[], NULL) AS secondary_flags
    FROM classified WHERE NOT $2::boolean AND ${conditions.join(" AND ")}`,
    values,
  };
}

export async function getLeadFollowUpCenter(
  filters: LeadFollowUpFilters,
  referenceNow = new Date().toISOString()
): Promise<LeadFollowUpCenter> {
  const listQuery = buildLeadFollowUpListQuery(filters, referenceNow);
  const groupQuery = buildLeadGroupFollowUpQuery(filters, referenceNow);
  const propertiesQuery = buildLeadFollowUpPropertiesQuery();
  const [rows, groupRows, properties] = await Promise.all([
    sql.unsafe(listQuery.text, listQuery.values as never[]),
    sql.unsafe(groupQuery.text, groupQuery.values as never[]),
    sql.unsafe(propertiesQuery.text, propertiesQuery.values as never[]),
  ]) as unknown as [Array<Record<string, unknown>>, Array<Record<string, unknown>>, CanonicalLeadPropertyOption[]];

  const summary = Object.fromEntries(Object.keys(FOLLOW_UP_BUCKET_LABELS).map((bucket) => [bucket, 0])) as Record<FollowUpBucket, number>;
  for (const row of [...rows, ...groupRows]) summary[row.bucket as FollowUpBucket] += 1;

  const mappedRows: LeadFollowUpItem[] = [
    ...rows.map((row) => ({
      id: String(row.id), entityType: "lead" as const, memberNames: [String(row.name)], name: String(row.name), email: row.email ? String(row.email) : null,
      phone: row.phone ? String(row.phone) : null, status: row.status as FollowUpStatus,
      nextFollowUpAt: row.next_follow_up_at ? iso(row.next_follow_up_at as string | Date) : null,
      lastActivityAt: iso(row.last_activity_at as string | Date), createdAt: iso(row.created_at as string | Date),
      sourceTypes: (row.source_types ?? []) as CanonicalLeadSourceType[],
      propertyTitle: row.property_title ? String(row.property_title) : null,
      propertySlug: row.property_slug ? String(row.property_slug) : null,
      sharedContact: Boolean(row.shared_contact), bucket: row.bucket as FollowUpBucket,
      secondaryFlags: (row.secondary_flags ?? []) as FollowUpBucket[],
    })),
    ...groupRows.map((row) => ({
      id: String(row.id), entityType: "group" as const, memberNames: (row.member_names ?? []) as string[], name: String(row.name),
      email: row.email ? String(row.email) : null, phone: row.phone ? String(row.phone) : null,
      status: row.status as FollowUpStatus,
      nextFollowUpAt: row.next_follow_up_at ? iso(row.next_follow_up_at as string | Date) : null,
      lastActivityAt: iso(row.last_activity_at as string | Date), createdAt: iso(row.created_at as string | Date),
      sourceTypes: (row.source_types ?? []) as CanonicalLeadSourceType[],
      propertyTitle: row.property_title ? String(row.property_title) : null,
      propertySlug: row.property_slug ? String(row.property_slug) : null,
      sharedContact: Boolean(row.shared_contact), bucket: row.bucket as FollowUpBucket,
      secondaryFlags: (row.secondary_flags ?? []) as FollowUpBucket[],
    })),
  ];
  const priority = { overdue: 1, today: 2, upcoming: 3, new_without_follow_up: 4, inactive: 5 } as const;
  mappedRows.sort((left, right) => filters.sort === "newest"
    ? new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    : filters.sort === "oldest_follow_up"
      ? (left.nextFollowUpAt ? new Date(left.nextFollowUpAt).getTime() : Number.MAX_SAFE_INTEGER) - (right.nextFollowUpAt ? new Date(right.nextFollowUpAt).getTime() : Number.MAX_SAFE_INTEGER)
      : priority[left.bucket] - priority[right.bucket] || (left.nextFollowUpAt ? new Date(left.nextFollowUpAt).getTime() : Number.MAX_SAFE_INTEGER) - (right.nextFollowUpAt ? new Date(right.nextFollowUpAt).getTime() : Number.MAX_SAFE_INTEGER));

  return {
    items: mappedRows,
    summary,
    properties,
  };
}
