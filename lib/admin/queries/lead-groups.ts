import { sql } from "@/lib/db";
import {
  CANONICAL_LEAD_SOURCE_LABELS,
  CANONICAL_LEAD_SOURCE_RECORDS_CTE,
  type CanonicalLeadRange,
  type CanonicalLeadSourceType,
} from "@/lib/admin/queries/canonical-leads";
import { getLead360Detail, type Lead360Detail } from "@/lib/admin/queries/lead-360";

export const LEAD_GROUP_PAGE_SIZE = 20;

export const LEAD_GROUP_STATUS_LABELS = {
  new: "Nuevo",
  active: "Activo",
  on_hold: "En pausa",
  closed: "Cerrado",
  archived: "Archivado",
} as const;

export const LEAD_GROUP_ROLE_LABELS = {
  family_contact: "Familiar / persona de contacto",
  buyer: "Comprador",
  prequalified_buyer: "Comprador precalificado",
  co_buyer: "Co-comprador",
  tenant: "Arrendatario",
  seller: "Vendedor",
  landlord: "Arrendador",
  representative_contact: "Representante o contacto",
  other: "Otra función",
} as const;

export type LeadGroupStatus = keyof typeof LEAD_GROUP_STATUS_LABELS;
export type LeadGroupRole = keyof typeof LEAD_GROUP_ROLE_LABELS;

export type LeadGroupFilters = {
  search: string;
  status: LeadGroupStatus | "all";
  source: CanonicalLeadSourceType | "all";
  range: CanonicalLeadRange;
  propertyId: string | null;
  page: number;
  invalid: boolean;
};

export type LeadGroupListItem = {
  id: string;
  title: string;
  status: LeadGroupStatus;
  propertyId: string | null;
  propertyTitle: string | null;
  propertySlug: string | null;
  members: Array<{ id: string; name: string; role: LeadGroupRole; isPrimaryContact: boolean }>;
  interactionCount: number;
  lastActivityAt: string;
  nextFollowUpAt: string | null;
  sourceTypes: CanonicalLeadSourceType[];
  createdAt: string;
};

export type LeadGroupDirectory = {
  items: LeadGroupListItem[];
  total: number;
  totalPages: number;
  properties: Array<{ id: string; title: string; slug: string }>;
};

export type LeadGroupMembership = {
  groupId: string;
  title: string;
  status: LeadGroupStatus;
  role: LeadGroupRole;
  isPrimaryContact: boolean;
};

export type LeadGroupDetail = {
  id: string;
  title: string;
  status: LeadGroupStatus;
  primaryProperty: { id: string; title: string; slug: string } | null;
  nextFollowUpAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  knownMembers: Array<{ leadId: string; name: string }>;
  members: Array<{
    leadId: string;
    role: LeadGroupRole;
    isPrimaryContact: boolean;
    joinedAt: string;
    detail: Lead360Detail;
  }>;
  sharedNotes: Array<{ id: string; body: string; authorUsername: string; createdAt: string }>;
  events: Array<{ id: string; type: string; data: Record<string, unknown>; actorUsername: string; createdAt: string }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeLeadGroupFilters(
  params: Record<string, string | string[] | undefined>
): LeadGroupFilters {
  const rawStatus = first(params.status) ?? "all";
  const rawPage = Number.parseInt(first(params.page) ?? "1", 10);
  const propertyId = (first(params.property) ?? "").trim();
  const rawSource = first(params.source) ?? "all";
  const rawRange = first(params.range) ?? "all";
  const status = rawStatus in LEAD_GROUP_STATUS_LABELS ? rawStatus as LeadGroupStatus : "all";
  return {
    search: (first(params.q) ?? "").trim().slice(0, 320),
    status,
    source: rawSource in CANONICAL_LEAD_SOURCE_LABELS ? rawSource as CanonicalLeadSourceType : "all",
    range: rawRange === "today" || rawRange === "7d" || rawRange === "30d" ? rawRange : "all",
    propertyId: propertyId || null,
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
    invalid: (rawStatus !== "all" && status === "all")
      || (rawSource !== "all" && !(rawSource in CANONICAL_LEAD_SOURCE_LABELS))
      || (rawRange !== "all" && !["today", "7d", "30d"].includes(rawRange)),
  };
}

function iso(value: string | Date) {
  return new Date(value).toISOString();
}

function optionalIso(value: string | Date | null) {
  return value ? iso(value) : null;
}

export async function getLeadGroupDirectory(filters: LeadGroupFilters): Promise<LeadGroupDirectory> {
  const values: unknown[] = [];
  const add = (value: unknown) => { values.push(value); return `$${values.length}`; };
  const conditions = ["g.archived_at IS NULL"];
  if (filters.search) {
    const search = add(`%${filters.search}%`);
    conditions.push(`(
      g.title ILIKE ${search}
      OR COALESCE(p.titulo, '') ILIKE ${search}
      OR EXISTS (
        SELECT 1 FROM public.lead_group_members property_member
        INNER JOIN source_records property_source ON property_source.lead_id=property_member.lead_id
        WHERE property_member.group_id=g.id AND property_member.removed_at IS NULL
          AND (COALESCE(property_source.property_title, '') ILIKE ${search}
            OR COALESCE(property_source.property_slug, '') ILIKE ${search})
      )
      OR EXISTS (
        SELECT 1 FROM public.lead_group_members search_member
        INNER JOIN public.leads search_lead ON search_lead.id=search_member.lead_id
        WHERE search_member.group_id=g.id AND search_member.removed_at IS NULL
          AND (
            search_lead.name ILIKE ${search}
            OR COALESCE(search_lead.email_original, '') ILIKE ${search}
            OR COALESCE(search_lead.phone_original, '') ILIKE ${search}
          )
      )
    )`);
  }
  if (filters.status !== "all") conditions.push(`g.status=${add(filters.status)}`);
  if (filters.source !== "all") {
    const source = add(filters.source);
    conditions.push(`EXISTS (
      SELECT 1 FROM public.lead_group_members source_member
      INNER JOIN source_records source_filter ON source_filter.lead_id=source_member.lead_id
      WHERE source_member.group_id=g.id AND source_member.removed_at IS NULL
        AND source_filter.source_type=${source}
    )`);
  }
  if (filters.propertyId) {
    const property = add(filters.propertyId);
    conditions.push(`(g.primary_property_id::text=${property} OR EXISTS (
      SELECT 1 FROM public.lead_group_members property_member
      INNER JOIN source_records property_filter ON property_filter.lead_id=property_member.lead_id
      WHERE property_member.group_id=g.id AND property_member.removed_at IS NULL
        AND property_filter.property_id::text=${property}
    ))`);
  }
  if (filters.range === "today") {
    conditions.push("EXISTS (SELECT 1 FROM active_members recent_member INNER JOIN public.leads recent_lead ON recent_lead.id=recent_member.lead_id WHERE recent_member.group_id=g.id AND recent_lead.created_at >= date_trunc('day', now()))");
  } else if (filters.range === "7d") {
    conditions.push("EXISTS (SELECT 1 FROM active_members recent_member INNER JOIN public.leads recent_lead ON recent_lead.id=recent_member.lead_id WHERE recent_member.group_id=g.id AND recent_lead.created_at >= now() - interval '7 days')");
  } else if (filters.range === "30d") {
    conditions.push("EXISTS (SELECT 1 FROM active_members recent_member INNER JOIN public.leads recent_lead ON recent_lead.id=recent_member.lead_id WHERE recent_member.group_id=g.id AND recent_lead.created_at >= now() - interval '30 days')");
  }
  const limit = add(LEAD_GROUP_PAGE_SIZE);
  const offset = add((filters.page - 1) * LEAD_GROUP_PAGE_SIZE);
  const rows = await sql.unsafe<Array<Record<string, unknown>>>(
    `WITH ${CANONICAL_LEAD_SOURCE_RECORDS_CTE},
    active_members AS (
      SELECT gm.group_id, gm.lead_id, gm.role, gm.is_primary_contact, gm.created_at
      FROM public.lead_group_members gm
      WHERE gm.removed_at IS NULL
    ),
    group_sources AS (
      SELECT am.group_id,
        count(sr.lead_id) AS interaction_count,
        array_agg(DISTINCT sr.source_type ORDER BY sr.source_type)
          FILTER (WHERE sr.source_type IS NOT NULL) AS source_types,
        max(sr.created_at) AS latest_source_at
      FROM active_members am
      LEFT JOIN source_records sr ON sr.lead_id=am.lead_id
      GROUP BY am.group_id
    ),
    member_activity AS (
      SELECT am.group_id, max(l.last_activity_at) AS latest_member_at,
        min(l.next_follow_up_at) AS earliest_follow_up_at
      FROM active_members am INNER JOIN public.leads l ON l.id=am.lead_id
      GROUP BY am.group_id
    ),
    group_activity AS (
      SELECT group_id, max(created_at) AS latest_group_at FROM (
        SELECT group_id, created_at FROM public.lead_group_events
        UNION ALL SELECT group_id, created_at FROM public.lead_group_notes
      ) activity GROUP BY group_id
    )
    SELECT g.id::text, g.title, g.status, g.primary_property_id::text AS property_id,
      p.titulo AS property_title, p.slug AS property_slug,
      g.next_follow_up_at,
      g.created_at,
      GREATEST(g.updated_at, COALESCE(ma.latest_member_at, g.updated_at),
        COALESCE(gs.latest_source_at, g.updated_at), COALESCE(ga.latest_group_at, g.updated_at)) AS last_activity_at,
      COALESCE(gs.interaction_count, 0) AS interaction_count,
      COALESCE(gs.source_types, ARRAY[]::text[]) AS source_types,
      (SELECT jsonb_agg(jsonb_build_object(
        'id', member_lead.id::text,
        'name', member_lead.name,
        'role', member.role,
        'isPrimaryContact', member.is_primary_contact
      ) ORDER BY member.is_primary_contact DESC, lower(member_lead.name), member_lead.id)
      FROM active_members member
      INNER JOIN public.leads member_lead ON member_lead.id=member.lead_id
      WHERE member.group_id=g.id) AS members,
      count(*) OVER () AS filtered_total
    FROM public.lead_groups g
    LEFT JOIN public.propiedades p ON p.id=g.primary_property_id
    LEFT JOIN group_sources gs ON gs.group_id=g.id
    LEFT JOIN member_activity ma ON ma.group_id=g.id
    LEFT JOIN group_activity ga ON ga.group_id=g.id
    WHERE ${conditions.join(" AND ")}
    ORDER BY last_activity_at DESC, g.id DESC
    LIMIT ${limit} OFFSET ${offset}`,
    values as never[]
  );
  const propertyRows = await sql.unsafe<Array<{ id: string; title: string; slug: string }>>(
    `SELECT DISTINCT p.id::text, p.titulo AS title, p.slug
    FROM public.lead_groups g INNER JOIN public.propiedades p ON p.id=g.primary_property_id
    WHERE g.archived_at IS NULL ORDER BY p.titulo, p.slug`
  );
  const total = Number(rows[0]?.filtered_total ?? 0);
  return {
    items: rows.map((row) => ({
      id: String(row.id), title: String(row.title), status: row.status as LeadGroupStatus,
      propertyId: row.property_id ? String(row.property_id) : null,
      propertyTitle: row.property_title ? String(row.property_title) : null,
      propertySlug: row.property_slug ? String(row.property_slug) : null,
      members: (row.members ?? []) as LeadGroupListItem["members"],
      interactionCount: Number(row.interaction_count),
      lastActivityAt: iso(row.last_activity_at as string | Date),
      nextFollowUpAt: optionalIso(row.next_follow_up_at as string | Date | null),
      sourceTypes: (row.source_types ?? []) as CanonicalLeadSourceType[],
      createdAt: iso(row.created_at as string | Date),
    })),
    total,
    totalPages: Math.max(1, Math.ceil(total / LEAD_GROUP_PAGE_SIZE)),
    properties: propertyRows,
  };
}

export async function getLeadGroupsForLead(leadId: string): Promise<LeadGroupMembership[]> {
  const rows = await sql.unsafe<Array<Record<string, unknown>>>(
    `SELECT g.id::text AS group_id, g.title, g.status, gm.role, gm.is_primary_contact
    FROM public.lead_group_members gm
    INNER JOIN public.lead_groups g ON g.id=gm.group_id
    WHERE gm.lead_id=$1::uuid AND gm.removed_at IS NULL AND g.archived_at IS NULL
    ORDER BY g.updated_at DESC, g.id DESC`,
    [leadId]
  );
  return rows.map((row) => ({
    groupId: String(row.group_id), title: String(row.title), status: row.status as LeadGroupStatus,
    role: row.role as LeadGroupRole, isPrimaryContact: Boolean(row.is_primary_contact),
  }));
}

export async function getLeadGroupDetail(groupId: string): Promise<LeadGroupDetail | null> {
  const [groupRows, memberRows, knownMemberRows, noteRows, eventRows] = await Promise.all([
    sql.unsafe<Array<Record<string, unknown>>>(
      `SELECT g.id::text, g.title, g.status, g.next_follow_up_at,
        g.created_at, g.updated_at, g.archived_at,
        p.id::text AS property_id, p.titulo AS property_title, p.slug AS property_slug
      FROM public.lead_groups g
      LEFT JOIN public.propiedades p ON p.id=g.primary_property_id
      WHERE g.id=$1::uuid`, [groupId]
    ),
    sql.unsafe<Array<Record<string, unknown>>>(
      `SELECT gm.lead_id::text, gm.role, gm.is_primary_contact, gm.created_at
      FROM public.lead_group_members gm INNER JOIN public.leads l ON l.id=gm.lead_id
      WHERE gm.group_id=$1::uuid AND gm.removed_at IS NULL AND l.merged_into_lead_id IS NULL
      ORDER BY gm.is_primary_contact DESC, lower(l.name), l.id`, [groupId]
    ),
    sql.unsafe<Array<{ lead_id: string; name: string }>>(
      `SELECT gm.lead_id::text, l.name FROM public.lead_group_members gm
       INNER JOIN public.leads l ON l.id=gm.lead_id WHERE gm.group_id=$1::uuid`, [groupId]
    ),
    sql.unsafe<Array<Record<string, unknown>>>(
      `SELECT id::text, body, author_username, created_at FROM public.lead_group_notes
      WHERE group_id=$1::uuid ORDER BY created_at DESC, id DESC`, [groupId]
    ),
    sql.unsafe<Array<Record<string, unknown>>>(
      `SELECT id::text, event_type, event_data, actor_username, created_at
      FROM public.lead_group_events WHERE group_id=$1::uuid
      ORDER BY created_at DESC, id DESC`, [groupId]
    ),
  ]);
  const group = groupRows[0];
  if (!group) return null;
  const memberDetails = await Promise.all(memberRows.map((row) => getLead360Detail(String(row.lead_id))));
  const members = memberRows.flatMap((row, index) => memberDetails[index] ? [{
    leadId: String(row.lead_id), role: row.role as LeadGroupRole,
    isPrimaryContact: Boolean(row.is_primary_contact), joinedAt: iso(row.created_at as string | Date),
    detail: memberDetails[index] as Lead360Detail,
  }] : []);
  return {
    id: String(group.id), title: String(group.title), status: group.status as LeadGroupStatus,
    primaryProperty: group.property_id ? {
      id: String(group.property_id), title: String(group.property_title), slug: String(group.property_slug),
    } : null,
    nextFollowUpAt: optionalIso(group.next_follow_up_at as string | Date | null),
    createdAt: iso(group.created_at as string | Date), updatedAt: iso(group.updated_at as string | Date),
    archivedAt: optionalIso(group.archived_at as string | Date | null),
    knownMembers: knownMemberRows.map((row) => ({ leadId: row.lead_id, name: row.name })),
    members,
    sharedNotes: noteRows.map((row) => ({
      id: String(row.id), body: String(row.body), authorUsername: String(row.author_username),
      createdAt: iso(row.created_at as string | Date),
    })),
    events: eventRows.map((row) => ({
      id: String(row.id), type: String(row.event_type), data: (row.event_data ?? {}) as Record<string, unknown>,
      actorUsername: String(row.actor_username), createdAt: iso(row.created_at as string | Date),
    })),
  };
}

export async function searchLeadGroupCandidates(groupId: string, query: string) {
  const search = query.trim().slice(0, 200);
  if (search.length < 2) return [];
  return sql.unsafe<Array<{ id: string; name: string; email: string | null; phone: string | null }>>(
    `SELECT l.id::text, l.name, l.email_original AS email, l.phone_original AS phone
    FROM public.leads l
    WHERE l.merged_into_lead_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_group_members gm
        WHERE gm.group_id=$1::uuid AND gm.lead_id=l.id AND gm.removed_at IS NULL
      )
      AND EXISTS (
        SELECT 1 FROM public.lead_group_members current_member
        JOIN public.lead_relationships relationship ON (
          (relationship.lead_id=current_member.lead_id AND relationship.related_lead_id=l.id)
          OR (relationship.related_lead_id=current_member.lead_id AND relationship.lead_id=l.id)
        )
        WHERE current_member.group_id=$1::uuid AND current_member.removed_at IS NULL
      )
      AND (l.name ILIKE $2 OR COALESCE(l.email_original, '') ILIKE $2 OR COALESCE(l.phone_original, '') ILIKE $2)
    ORDER BY lower(l.name), l.id LIMIT 20`,
    [groupId, `%${search}%`]
  );
}
