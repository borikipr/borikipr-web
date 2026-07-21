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
};

export type LeadFollowUpItem = {
  id: string;
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
  const values: unknown[] = [referenceNow];
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

export function buildLeadFollowUpSummaryQuery(referenceNow = new Date().toISOString()): SqlQuery {
  return {
    text: `WITH ${CANONICAL_LEAD_SOURCE_RECORDS_CTE},${classificationCte("$1")}
      SELECT bucket, count(*) AS count
      FROM classified
      WHERE bucket IS NOT NULL
      GROUP BY bucket`,
    values: [referenceNow],
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

export async function getLeadFollowUpCenter(
  filters: LeadFollowUpFilters,
  referenceNow = new Date().toISOString()
): Promise<LeadFollowUpCenter> {
  const listQuery = buildLeadFollowUpListQuery(filters, referenceNow);
  const summaryQuery = buildLeadFollowUpSummaryQuery(referenceNow);
  const propertiesQuery = buildLeadFollowUpPropertiesQuery();
  const [rows, summaryRows, properties] = await Promise.all([
    sql.unsafe(listQuery.text, listQuery.values as never[]),
    sql.unsafe(summaryQuery.text, summaryQuery.values as never[]),
    sql.unsafe(propertiesQuery.text, propertiesQuery.values as never[]),
  ]) as unknown as [Array<Record<string, unknown>>, Array<Record<string, unknown>>, CanonicalLeadPropertyOption[]];

  const summary = Object.fromEntries(Object.keys(FOLLOW_UP_BUCKET_LABELS).map((bucket) => [bucket, 0])) as Record<FollowUpBucket, number>;
  for (const row of summaryRows) summary[row.bucket as FollowUpBucket] = Number(row.count);

  return {
    items: rows.map((row) => ({
      id: String(row.id), name: String(row.name), email: row.email ? String(row.email) : null,
      phone: row.phone ? String(row.phone) : null, status: row.status as FollowUpStatus,
      nextFollowUpAt: row.next_follow_up_at ? iso(row.next_follow_up_at as string | Date) : null,
      lastActivityAt: iso(row.last_activity_at as string | Date), createdAt: iso(row.created_at as string | Date),
      sourceTypes: (row.source_types ?? []) as CanonicalLeadSourceType[],
      propertyTitle: row.property_title ? String(row.property_title) : null,
      propertySlug: row.property_slug ? String(row.property_slug) : null,
      sharedContact: Boolean(row.shared_contact), bucket: row.bucket as FollowUpBucket,
      secondaryFlags: (row.secondary_flags ?? []) as FollowUpBucket[],
    })),
    summary,
    properties,
  };
}
