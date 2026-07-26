import { sql } from "@/lib/db";
import {
  CANONICAL_LEAD_SOURCE_LABELS,
  CANONICAL_LEAD_SOURCE_RECORDS_CTE,
  type CanonicalLeadPropertyOption,
  type CanonicalLeadSourceType,
} from "@/lib/admin/queries/canonical-leads";

export const ADMIN_TIME_ZONE = "America/Puerto_Rico";
export const INACTIVITY_DAYS = 14;
export const FOLLOW_UP_PAGE_SIZE = 25;

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
  page: number;
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
  lastActivityAt: string | null;
  createdAt: string;
  sourceTypes: CanonicalLeadSourceType[];
  propertyTitle: string | null;
  propertySlug: string | null;
  sharedContact: boolean;
  bucket: FollowUpBucket | null;
  secondaryFlags: FollowUpBucket[];
};

export type LeadFollowUpCenter = {
  items: LeadFollowUpItem[];
  summary: Record<FollowUpBucket, number>;
  properties: CanonicalLeadPropertyOption[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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
  const rawPage = Number(first(params.page) ?? "1");
  const propertyId = (first(params.property) ?? "").trim();
  const status = validStatuses.has(rawStatus)
    ? (rawStatus as FollowUpStatus)
    : "all";
  const source =
    rawSource in CANONICAL_LEAD_SOURCE_LABELS
      ? (rawSource as CanonicalLeadSourceType)
      : "all";
  const bucket = validBuckets.has(rawBucket)
    ? (rawBucket as FollowUpBucket)
    : "all";
  const sort = validSorts.has(rawSort)
    ? (rawSort as FollowUpSort)
    : "urgency";
  const invalid =
    (rawStatus !== "all" && status === "all") ||
    (rawSource !== "all" && source === "all") ||
    (rawBucket !== "all" && bucket === "all") ||
    rawSort !== sort ||
    !Number.isSafeInteger(rawPage) ||
    rawPage < 1;

  return {
    search: (first(params.q) ?? "").trim().slice(0, 320),
    status,
    source,
    propertyId: propertyId || null,
    bucket,
    sort,
    invalid,
    showIndividuals: first(params.individuals) === "1",
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

function appendValue(values: unknown[], value: unknown) {
  values.push(value);
  return `$${values.length}`;
}

function operationalFollowUpCte(referenceNowParameter: string) {
  return `
management_activity AS (
  SELECT lead_id, max(created_at) AS last_management_at
  FROM public.lead_management_events
  GROUP BY lead_id
),
active_members AS (
  SELECT gm.group_id, gm.lead_id
  FROM public.lead_group_members gm
  INNER JOIN public.leads member_lead ON member_lead.id = gm.lead_id
  WHERE gm.removed_at IS NULL
    AND member_lead.merged_into_lead_id IS NULL
),
lead_entities AS (
  SELECT
    'lead'::text AS entity_type,
    l.id,
    l.name,
    ARRAY[l.name]::text[] AS member_names,
    l.email_original AS email,
    l.phone_original AS phone,
    l.status,
    l.next_follow_up_at,
    GREATEST(
      l.last_activity_at,
      COALESCE(sa.latest_source_at, l.last_activity_at),
      COALESCE(ma.last_management_at, l.last_activity_at)
    ) AS last_activity_at,
    l.created_at,
    COALESCE(sa.source_types, ARRAY[]::text[]) AS source_types,
    recent_property.property_title,
    recent_property.property_slug,
    COALESCE((
      SELECT array_agg(DISTINCT source_property.property_id::text)
      FROM source_records source_property
      WHERE source_property.lead_id = l.id
        AND source_property.property_id IS NOT NULL
    ), ARRAY[]::text[]) AS property_ids,
    concat_ws(
      ' ',
      l.name,
      l.email_original,
      l.email_normalized,
      l.phone_original,
      l.phone_normalized
    ) AS search_text,
    EXISTS (
      SELECT 1
      FROM public.leads shared
      WHERE shared.id <> l.id
        AND shared.merged_into_lead_id IS NULL
        AND (
          (
            l.email_normalized IS NOT NULL
            AND shared.email_normalized = l.email_normalized
          )
          OR (
            l.phone_normalized IS NOT NULL
            AND shared.phone_normalized = l.phone_normalized
          )
        )
    ) AS shared_contact
  FROM public.leads l
  LEFT JOIN source_aggregates sa ON sa.lead_id = l.id
  LEFT JOIN LATERAL (
    SELECT source.property_title, source.property_slug
    FROM source_records source
    WHERE source.lead_id = l.id
      AND source.property_id IS NOT NULL
    ORDER BY source.created_at DESC, source.source_type ASC
    LIMIT 1
  ) recent_property ON true
  LEFT JOIN management_activity ma ON ma.lead_id = l.id
  WHERE l.merged_into_lead_id IS NULL
    AND l.status IN ('new', 'active')
    AND (
      $2::boolean
      OR NOT EXISTS (
        SELECT 1
        FROM public.lead_group_members grouped_member
        INNER JOIN public.lead_groups grouped_case
          ON grouped_case.id = grouped_member.group_id
        WHERE grouped_member.lead_id = l.id
          AND grouped_member.removed_at IS NULL
          AND grouped_case.archived_at IS NULL
      )
    )
),
group_entities AS (
  SELECT
    'group'::text AS entity_type,
    g.id,
    g.title AS name,
    array_agg(DISTINCT member_lead.name ORDER BY member_lead.name) AS member_names,
    primary_lead.email_original AS email,
    primary_lead.phone_original AS phone,
    CASE WHEN g.status = 'new' THEN 'new' ELSE 'active' END AS status,
    g.next_follow_up_at,
    GREATEST(
      g.updated_at,
      COALESCE(max(member_lead.last_activity_at), g.updated_at),
      COALESCE(max(source.created_at), g.updated_at)
    ) AS last_activity_at,
    g.created_at,
    COALESCE(
      array_agg(DISTINCT source.source_type ORDER BY source.source_type)
        FILTER (WHERE source.source_type IS NOT NULL),
      ARRAY[]::text[]
    ) AS source_types,
    COALESCE(
      primary_property.titulo,
      (array_agg(source.property_title ORDER BY source.created_at DESC)
        FILTER (WHERE source.property_title IS NOT NULL))[1]
    ) AS property_title,
    COALESCE(
      primary_property.slug,
      (array_agg(source.property_slug ORDER BY source.created_at DESC)
        FILTER (WHERE source.property_slug IS NOT NULL))[1]
    ) AS property_slug,
    array_remove(
      array_cat(
        COALESCE(
          array_agg(DISTINCT source.property_id::text)
            FILTER (WHERE source.property_id IS NOT NULL),
          ARRAY[]::text[]
        ),
        CASE
          WHEN g.primary_property_id IS NULL THEN ARRAY[]::text[]
          ELSE ARRAY[g.primary_property_id::text]
        END
      ),
      NULL
    ) AS property_ids,
    concat_ws(
      ' ',
      g.title,
      primary_property.titulo,
      primary_property.slug,
      string_agg(
        DISTINCT concat_ws(
          ' ',
          member_lead.name,
          member_lead.email_original,
          member_lead.email_normalized,
          member_lead.phone_original,
          member_lead.phone_normalized
        ),
        ' '
      )
    ) AS search_text,
    bool_or(EXISTS (
      SELECT 1
      FROM public.leads shared
      WHERE shared.id <> member_lead.id
        AND shared.merged_into_lead_id IS NULL
        AND (
          (
            member_lead.email_normalized IS NOT NULL
            AND shared.email_normalized = member_lead.email_normalized
          )
          OR (
            member_lead.phone_normalized IS NOT NULL
            AND shared.phone_normalized = member_lead.phone_normalized
          )
        )
    )) AS shared_contact
  FROM public.lead_groups g
  INNER JOIN active_members member ON member.group_id = g.id
  INNER JOIN public.leads member_lead ON member_lead.id = member.lead_id
  LEFT JOIN source_records source ON source.lead_id = member_lead.id
  LEFT JOIN public.lead_group_members primary_member
    ON primary_member.group_id = g.id
    AND primary_member.is_primary_contact = true
    AND primary_member.removed_at IS NULL
  LEFT JOIN public.leads primary_lead ON primary_lead.id = primary_member.lead_id
  LEFT JOIN public.propiedades primary_property
    ON primary_property.id = g.primary_property_id
  WHERE NOT $2::boolean
    AND g.status NOT IN ('closed', 'archived')
    AND g.archived_at IS NULL
  GROUP BY
    g.id,
    primary_lead.email_original,
    primary_lead.phone_original,
    primary_property.titulo,
    primary_property.slug
),
operational_entities AS (
  SELECT * FROM lead_entities
  UNION ALL
  SELECT * FROM group_entities
),
flagged_entities AS (
  SELECT
    entity.*,
    entity.next_follow_up_at < ${referenceNowParameter}::timestamptz AS is_overdue,
    entity.next_follow_up_at >= ${referenceNowParameter}::timestamptz
      AND entity.next_follow_up_at < (
        (
          date_trunc(
            'day',
            ${referenceNowParameter}::timestamptz AT TIME ZONE '${ADMIN_TIME_ZONE}'
          ) + interval '1 day'
        ) AT TIME ZONE '${ADMIN_TIME_ZONE}'
      ) AS is_today,
    entity.next_follow_up_at >= (
      (
        date_trunc(
          'day',
          ${referenceNowParameter}::timestamptz AT TIME ZONE '${ADMIN_TIME_ZONE}'
        ) + interval '1 day'
      ) AT TIME ZONE '${ADMIN_TIME_ZONE}'
    )
      AND entity.next_follow_up_at < (
        (
          date_trunc(
            'day',
            ${referenceNowParameter}::timestamptz AT TIME ZONE '${ADMIN_TIME_ZONE}'
          ) + interval '8 days'
        ) AT TIME ZONE '${ADMIN_TIME_ZONE}'
      ) AS is_upcoming,
    entity.status = 'new'
      AND entity.next_follow_up_at IS NULL AS is_new_without_follow_up,
    entity.last_activity_at <
      ${referenceNowParameter}::timestamptz - interval '${INACTIVITY_DAYS} days'
      AS is_inactive
  FROM operational_entities entity
),
classified_entities AS (
  SELECT
    flagged.*,
    CASE
      WHEN is_overdue THEN 'overdue'
      WHEN is_today THEN 'today'
      WHEN is_upcoming THEN 'upcoming'
      WHEN is_new_without_follow_up THEN 'new_without_follow_up'
      WHEN is_inactive THEN 'inactive'
      ELSE NULL
    END AS bucket
  FROM flagged_entities flagged
)`;
}

function filteredConditions(
  filters: LeadFollowUpFilters,
  values: unknown[],
  includeBucket: boolean
) {
  const conditions: string[] = [];
  if (filters.search) {
    conditions.push(
      `entity.search_text ILIKE ${appendValue(values, `%${filters.search}%`)}`
    );
  }
  if (filters.status !== "all") {
    conditions.push(`entity.status = ${appendValue(values, filters.status)}`);
  }
  if (filters.source !== "all") {
    conditions.push(
      `${appendValue(values, filters.source)} = ANY(entity.source_types)`
    );
  }
  if (filters.propertyId) {
    conditions.push(
      `${appendValue(values, filters.propertyId)} = ANY(entity.property_ids)`
    );
  }
  if (includeBucket && filters.bucket !== "all") {
    conditions.push(`entity.bucket = ${appendValue(values, filters.bucket)}`);
  }
  return conditions;
}

function whereClause(conditions: string[]) {
  return conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
}

export function buildLeadFollowUpListQuery(
  filters: LeadFollowUpFilters,
  referenceNow = new Date().toISOString(),
  pageSize = FOLLOW_UP_PAGE_SIZE
): SqlQuery {
  const values: unknown[] = [referenceNow, filters.showIndividuals];
  const conditions = filteredConditions(filters, values, true);
  const orderBy = {
    urgency: `CASE entity.bucket
        WHEN 'overdue' THEN 1
        WHEN 'today' THEN 2
        WHEN 'upcoming' THEN 3
        WHEN 'new_without_follow_up' THEN 4
        WHEN 'inactive' THEN 5
        ELSE 6
      END,
      CASE
        WHEN entity.bucket IN ('overdue', 'today', 'upcoming')
        THEN entity.next_follow_up_at
      END ASC NULLS LAST,
      CASE
        WHEN entity.bucket = 'new_without_follow_up'
        THEN entity.created_at
      END DESC NULLS LAST,
      entity.last_activity_at ASC NULLS LAST,
      entity.entity_type ASC,
      entity.id ASC`,
    newest:
      "entity.created_at DESC, entity.entity_type ASC, entity.id DESC",
    oldest_follow_up:
      "entity.next_follow_up_at ASC NULLS LAST, entity.created_at DESC, entity.entity_type ASC, entity.id DESC",
  }[filters.sort];
  const limit = appendValue(values, pageSize);
  const offset = appendValue(values, (filters.page - 1) * pageSize);

  return {
    text: `WITH ${CANONICAL_LEAD_SOURCE_RECORDS_CTE},
      ${operationalFollowUpCte("$1")}
      SELECT
        entity.*,
        ARRAY_REMOVE(ARRAY[
          CASE
            WHEN entity.is_overdue AND entity.bucket <> 'overdue'
            THEN 'overdue'
          END,
          CASE
            WHEN entity.is_today AND entity.bucket <> 'today'
            THEN 'today'
          END,
          CASE
            WHEN entity.is_upcoming AND entity.bucket <> 'upcoming'
            THEN 'upcoming'
          END,
          CASE
            WHEN entity.is_new_without_follow_up
              AND entity.bucket <> 'new_without_follow_up'
            THEN 'new_without_follow_up'
          END,
          CASE
            WHEN entity.is_inactive AND entity.bucket <> 'inactive'
            THEN 'inactive'
          END
        ]::text[], NULL) AS secondary_flags
      FROM classified_entities entity
      ${whereClause(conditions)}
      ORDER BY ${orderBy}
      LIMIT ${limit}
      OFFSET ${offset}`,
    values,
  };
}

export function buildLeadFollowUpCountQuery(
  filters: LeadFollowUpFilters,
  referenceNow = new Date().toISOString()
): SqlQuery {
  const values: unknown[] = [referenceNow, filters.showIndividuals];
  const conditions = filteredConditions(filters, values, true);
  return {
    text: `WITH ${CANONICAL_LEAD_SOURCE_RECORDS_CTE},
      ${operationalFollowUpCte("$1")}
      SELECT count(*)::int AS count
      FROM classified_entities entity
      ${whereClause(conditions)}`,
    values,
  };
}

export function buildLeadFollowUpSummaryQuery(
  filters: LeadFollowUpFilters,
  referenceNow = new Date().toISOString()
): SqlQuery {
  const values: unknown[] = [referenceNow, filters.showIndividuals];
  const conditions = filteredConditions(filters, values, false);
  return {
    text: `WITH ${CANONICAL_LEAD_SOURCE_RECORDS_CTE},
      ${operationalFollowUpCte("$1")}
      SELECT entity.bucket, count(*)::int AS count
      FROM classified_entities entity
      ${whereClause([
        ...conditions,
        "entity.bucket IS NOT NULL",
      ])}
      GROUP BY entity.bucket`,
    values,
  };
}

export function buildLeadFollowUpPropertiesQuery(): SqlQuery {
  return {
    text: `WITH ${CANONICAL_LEAD_SOURCE_RECORDS_CTE}
      SELECT DISTINCT
        property_id::text AS id,
        property_title AS title,
        property_slug AS slug
      FROM source_records
      WHERE property_id IS NOT NULL
        AND property_title IS NOT NULL
        AND property_slug IS NOT NULL
      ORDER BY property_title, property_slug`,
    values: [],
  };
}

function optionalIso(value: string | Date | null | undefined) {
  return value ? new Date(value).toISOString() : null;
}

function mapFollowUpItem(row: Record<string, unknown>): LeadFollowUpItem {
  return {
    id: String(row.id),
    entityType: row.entity_type as "lead" | "group",
    memberNames: (row.member_names ?? []) as string[],
    name: String(row.name),
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    status: row.status as FollowUpStatus,
    nextFollowUpAt: optionalIso(
      row.next_follow_up_at as string | Date | null
    ),
    lastActivityAt: optionalIso(
      row.last_activity_at as string | Date | null
    ),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    sourceTypes: (row.source_types ?? []) as CanonicalLeadSourceType[],
    propertyTitle: row.property_title ? String(row.property_title) : null,
    propertySlug: row.property_slug ? String(row.property_slug) : null,
    sharedContact: Boolean(row.shared_contact),
    bucket: row.bucket ? (row.bucket as FollowUpBucket) : null,
    secondaryFlags: (row.secondary_flags ?? []) as FollowUpBucket[],
  };
}

export async function getLeadFollowUpCenter(
  filters: LeadFollowUpFilters,
  referenceNow = new Date().toISOString()
): Promise<LeadFollowUpCenter> {
  const listQuery = buildLeadFollowUpListQuery(filters, referenceNow);
  const countQuery = buildLeadFollowUpCountQuery(filters, referenceNow);
  const summaryQuery = buildLeadFollowUpSummaryQuery(filters, referenceNow);
  const propertiesQuery = buildLeadFollowUpPropertiesQuery();
  const [rows, countRows, summaryRows, properties] = (await Promise.all([
    sql.unsafe(listQuery.text, listQuery.values as never[]),
    sql.unsafe(countQuery.text, countQuery.values as never[]),
    sql.unsafe(summaryQuery.text, summaryQuery.values as never[]),
    sql.unsafe(propertiesQuery.text, propertiesQuery.values as never[]),
  ])) as unknown as [
    Array<Record<string, unknown>>,
    Array<{ count: number }>,
    Array<{ bucket: FollowUpBucket; count: number }>,
    CanonicalLeadPropertyOption[],
  ];

  const summary = Object.fromEntries(
    Object.keys(FOLLOW_UP_BUCKET_LABELS).map((bucket) => [bucket, 0])
  ) as Record<FollowUpBucket, number>;
  for (const row of summaryRows) {
    summary[row.bucket] = Number(row.count);
  }
  const total = Number(countRows[0]?.count ?? 0);

  return {
    items: rows.map(mapFollowUpItem),
    summary,
    properties,
    page: filters.page,
    pageSize: FOLLOW_UP_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / FOLLOW_UP_PAGE_SIZE)),
  };
}
