import { sql } from "@/lib/db";

export const CANONICAL_LEAD_PAGE_SIZE = 25;

export const CANONICAL_LEAD_SOURCE_LABELS = {
  priority_registration: "Registro prioritario",
  property_buyer_profile: "Perfil comprador de propiedad",
  buyer_tenant_inquiry: "Comprador / arrendatario",
  seller_landlord_inquiry: "Vendedor / arrendador",
  open_house_registration: "Consulta de propiedad",
} as const;

export type CanonicalLeadSourceType = keyof typeof CANONICAL_LEAD_SOURCE_LABELS;
export type CanonicalLeadRange = "today" | "7d" | "30d" | "all";
export type CanonicalLeadSort = "recent" | "oldest" | "name_asc" | "name_desc";

export type CanonicalLeadFilters = {
  search: string;
  source: CanonicalLeadSourceType | "all";
  range: CanonicalLeadRange;
  propertyId: string | null;
  sort: CanonicalLeadSort;
  page: number;
};

export type CanonicalLeadListItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  identityStatus: string;
  primarySource: CanonicalLeadSourceType | null;
  sourceTypes: CanonicalLeadSourceType[];
  sourceCount: number;
  contextTitle: string | null;
  contextDetail: string | null;
  lastActivityAt: string;
  createdAt: string;
};

export type CanonicalLeadSummary = {
  total: number;
  newToday: number;
  newLast7Days: number;
  withPriorityRegistration: number;
  withMultipleInteractions: number;
};

export type CanonicalLeadPropertyOption = {
  id: string;
  title: string;
  slug: string;
};

export type CanonicalLeadDirectory = {
  items: CanonicalLeadListItem[];
  total: number;
  totalPages: number;
  summary: CanonicalLeadSummary;
  properties: CanonicalLeadPropertyOption[];
  relatedDataUnavailable: boolean;
};

type SqlQuery = { text: string; values: unknown[] };

type CanonicalLeadRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  identity_status: string;
  primary_source: CanonicalLeadSourceType | null;
  source_types: CanonicalLeadSourceType[] | null;
  source_count: number | string;
  context_title: string | null;
  context_detail: string | null;
  last_activity_at: string | Date;
  created_at: string | Date;
  filtered_total: number | string;
};

type SummaryRow = {
  total: number | string;
  new_today: number | string;
  new_last_7_days: number | string;
  with_priority_registration: number | string;
  with_multiple_interactions: number | string;
};

type PropertyRow = {
  id: string;
  title: string;
  slug: string;
};

const SOURCE_RECORDS_CTE = `
source_records AS (
  SELECT
    pr.lead_id,
    'priority_registration'::text AS source_type,
    pr.created_at,
    pr.property_id,
    pr.property_title AS property_title,
    pr.property_slug AS property_slug,
    NULL::text AS municipality
  FROM public.property_priority_registrations pr
  WHERE pr.lead_id IS NOT NULL

  UNION ALL

  SELECT
    pbp.lead_id,
    'property_buyer_profile'::text,
    pbp.created_at,
    pbp.property_id,
    p.titulo,
    p.slug,
    p.municipio
  FROM public.property_buyer_profiles pbp
  INNER JOIN public.propiedades p ON p.id = pbp.property_id

  UNION ALL

  SELECT
    sli.lead_id,
    'seller_landlord_inquiry'::text,
    sli.created_at,
    NULL::uuid,
    NULL::text,
    NULL::text,
    sli.location
  FROM public.seller_landlord_inquiries sli

  UNION ALL

  SELECT
    bti.lead_id,
    'buyer_tenant_inquiry'::text,
    bti.created_at,
    NULL::uuid,
    NULL::text,
    NULL::text,
    bti.municipalities
  FROM public.buyer_tenant_inquiries bti

  UNION ALL

  SELECT
    cp.lead_id,
    'open_house_registration'::text,
    cp.created_at,
    cp.propiedad_id,
    p.titulo,
    p.slug,
    p.municipio
  FROM public.consultas_propiedad cp
  INNER JOIN public.propiedades p ON p.id = cp.propiedad_id
  WHERE cp.lead_id IS NOT NULL
),
source_ranked AS (
  SELECT
    sr.*,
    row_number() OVER (
      PARTITION BY sr.lead_id
      ORDER BY sr.created_at DESC, sr.source_type ASC
    ) AS source_rank
  FROM source_records sr
),
source_aggregates AS (
  SELECT
    sr.lead_id,
    count(*) AS source_count,
    array_agg(DISTINCT sr.source_type ORDER BY sr.source_type) AS source_types,
    max(sr.created_at) AS latest_source_at
  FROM source_records sr
  GROUP BY sr.lead_id
)
`;

function appendValue(values: unknown[], value: unknown) {
  values.push(value);
  return `$${values.length}`;
}

export function normalizeCanonicalLeadFilters(
  params: Record<string, string | string[] | undefined>
): CanonicalLeadFilters {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const sourceValue = first(params.source);
  const rangeValue = first(params.range);
  const sortValue = first(params.sort);
  const pageValue = Number.parseInt(first(params.page) ?? "1", 10);
  const propertyValue = first(params.property)?.trim() ?? "";

  return {
    search: (first(params.q) ?? "").trim().slice(0, 320),
    source:
      sourceValue && sourceValue in CANONICAL_LEAD_SOURCE_LABELS
        ? (sourceValue as CanonicalLeadSourceType)
        : "all",
    range:
      rangeValue === "today" || rangeValue === "7d" || rangeValue === "30d"
        ? rangeValue
        : "all",
    propertyId: propertyValue || null,
    sort:
      sortValue === "oldest" || sortValue === "name_asc" || sortValue === "name_desc"
        ? sortValue
        : "recent",
    page: Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1,
  };
}

export function buildCanonicalLeadListQuery(
  filters: CanonicalLeadFilters,
  pageSize = CANONICAL_LEAD_PAGE_SIZE
): SqlQuery {
  const values: unknown[] = [];
  const conditions: string[] = ["l.merged_into_lead_id IS NULL"];

  if (filters.search) {
    const search = appendValue(values, `%${filters.search}%`);
    conditions.push(`(
      l.name ILIKE ${search}
      OR COALESCE(l.email_original, '') ILIKE ${search}
      OR COALESCE(l.email_normalized, '') ILIKE ${search}
      OR COALESCE(l.phone_original, '') ILIKE ${search}
      OR COALESCE(l.phone_normalized, '') ILIKE ${search}
    )`);
  }

  if (filters.source !== "all") {
    const source = appendValue(values, filters.source);
    conditions.push(`EXISTS (
      SELECT 1 FROM source_records source_filter
      WHERE source_filter.lead_id = l.id AND source_filter.source_type = ${source}
    )`);
  }

  if (filters.propertyId) {
    const propertyId = appendValue(values, filters.propertyId);
    conditions.push(`EXISTS (
      SELECT 1 FROM source_records property_filter
      WHERE property_filter.lead_id = l.id
        AND property_filter.property_id::text = ${propertyId}
    )`);
  }

  if (filters.range === "today") {
    conditions.push("l.created_at >= date_trunc('day', now())");
  } else if (filters.range === "7d") {
    conditions.push("l.created_at >= now() - interval '7 days'");
  } else if (filters.range === "30d") {
    conditions.push("l.created_at >= now() - interval '30 days'");
  }

  const orderBy = {
    recent: "GREATEST(l.last_activity_at, COALESCE(sa.latest_source_at, l.last_activity_at)) DESC, l.id DESC",
    oldest: "l.created_at ASC, l.id ASC",
    name_asc: "lower(l.name) ASC, l.id ASC",
    name_desc: "lower(l.name) DESC, l.id DESC",
  }[filters.sort];
  const limit = appendValue(values, pageSize);
  const offset = appendValue(values, (filters.page - 1) * pageSize);

  return {
    text: `WITH ${SOURCE_RECORDS_CTE}
      SELECT
        l.id::text,
        l.name,
        l.email_original AS email,
        l.phone_original AS phone,
        l.status,
        l.identity_status,
        recent.source_type AS primary_source,
        COALESCE(sa.source_types, ARRAY[]::text[]) AS source_types,
        COALESCE(sa.source_count, 0) AS source_count,
        recent.property_title AS context_title,
        COALESCE(recent.municipality, recent.property_slug) AS context_detail,
        GREATEST(
          l.last_activity_at,
          COALESCE(sa.latest_source_at, l.last_activity_at)
        ) AS last_activity_at,
        l.created_at,
        count(*) OVER () AS filtered_total
      FROM public.leads l
      LEFT JOIN source_aggregates sa ON sa.lead_id = l.id
      LEFT JOIN source_ranked recent
        ON recent.lead_id = l.id AND recent.source_rank = 1
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}`,
    values,
  };
}

export function buildCanonicalLeadSummaryQuery(): SqlQuery {
  return {
    text: `WITH ${SOURCE_RECORDS_CTE},
      source_counts AS (
        SELECT
          lead_id,
          count(*) AS source_count,
          bool_or(source_type = 'priority_registration') AS has_priority
        FROM source_records
        GROUP BY lead_id
      )
      SELECT
        count(*) AS total,
        count(*) FILTER (WHERE l.created_at >= date_trunc('day', now())) AS new_today,
        count(*) FILTER (WHERE l.created_at >= now() - interval '7 days') AS new_last_7_days,
        count(*) FILTER (WHERE COALESCE(sc.has_priority, false)) AS with_priority_registration,
        count(*) FILTER (WHERE COALESCE(sc.source_count, 0) > 1) AS with_multiple_interactions
      FROM public.leads l
      LEFT JOIN source_counts sc ON sc.lead_id = l.id
      WHERE l.merged_into_lead_id IS NULL`,
    values: [],
  };
}

export function buildCanonicalLeadPropertiesQuery(): SqlQuery {
  return {
    text: `WITH ${SOURCE_RECORDS_CTE}
      SELECT DISTINCT
        sr.property_id::text AS id,
        sr.property_title AS title,
        sr.property_slug AS slug
      FROM source_records sr
      WHERE sr.property_id IS NOT NULL
        AND sr.property_title IS NOT NULL
        AND sr.property_slug IS NOT NULL
      ORDER BY sr.property_title ASC, sr.property_slug ASC`,
    values: [],
  };
}

async function executeQuery<Row>(query: SqlQuery): Promise<Row[]> {
  return (await sql.unsafe(query.text, query.values as never[])) as unknown as Row[];
}

function toIso(value: string | Date) {
  return new Date(value).toISOString();
}

export async function getCanonicalLeadDirectory(
  filters: CanonicalLeadFilters
): Promise<CanonicalLeadDirectory> {
  const [rows, summaryRows, propertyRows] = await Promise.all([
    executeQuery<CanonicalLeadRow>(buildCanonicalLeadListQuery(filters)),
    executeQuery<SummaryRow>(buildCanonicalLeadSummaryQuery()),
    executeQuery<PropertyRow>(buildCanonicalLeadPropertiesQuery()),
  ]);
  const summary = summaryRows[0];
  const total = Number(rows[0]?.filtered_total ?? 0);

  const items = rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    identityStatus: row.identity_status,
    primarySource: row.primary_source,
    sourceTypes: row.source_types ?? [],
    sourceCount: Number(row.source_count),
    contextTitle: row.context_title,
    contextDetail: row.context_detail,
    lastActivityAt: toIso(row.last_activity_at),
    createdAt: toIso(row.created_at),
  }));

  return {
    items,
    total,
    totalPages: Math.max(1, Math.ceil(total / CANONICAL_LEAD_PAGE_SIZE)),
    summary: {
      total: Number(summary?.total ?? 0),
      newToday: Number(summary?.new_today ?? 0),
      newLast7Days: Number(summary?.new_last_7_days ?? 0),
      withPriorityRegistration: Number(summary?.with_priority_registration ?? 0),
      withMultipleInteractions: Number(summary?.with_multiple_interactions ?? 0),
    },
    properties: propertyRows,
    relatedDataUnavailable: items.some((item) => item.sourceCount === 0),
  };
}

export function canonicalLeadDirectoryHref(
  filters: CanonicalLeadFilters,
  overrides: Partial<CanonicalLeadFilters> = {}
) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (next.search) params.set("q", next.search);
  if (next.source !== "all") params.set("source", next.source);
  if (next.range !== "all") params.set("range", next.range);
  if (next.propertyId) params.set("property", next.propertyId);
  if (next.sort !== "recent") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/admin/leads?${query}` : "/admin/leads";
}
