import "server-only";
import { sql } from "@/lib/db";
import { CANONICAL_LEAD_SOURCE_LABELS, normalizeCanonicalLeadFilters, resolveCanonicalLeadPropertyFilter } from "./canonical-leads";
import { buildUnifiedLeadDirectoryQuery, normalizeUnifiedDirectoryFilters, UNIFIED_STATUS_LABELS } from "./unified-lead-directory";
import { LEADS_EXPORT_ROW_LIMIT, LeadsExportLimitError, type LeadsExportRow } from "../leads-export";

export async function getOperationalExportRows(params: Record<string, string>) {
  if (params.individuals && params.individuals !== "0") throw new Error("invalid_filters");
  const canonical = normalizeCanonicalLeadFilters(params);
  const filters = normalizeUnifiedDirectoryFilters(canonical, params);
  if ((params.source && params.source !== canonical.source)
    || (params.range && params.range !== canonical.range)
    || (params.sort && params.sort !== canonical.sort)
    || (params.status && params.status !== filters.status)
    || (params.q && params.q.trim().length > 320)) throw new Error("invalid_filters");
  const property = await resolveCanonicalLeadPropertyFilter(canonical.propertyId);
  if (property.invalid) throw new Error("invalid_filters");
  const query = buildUnifiedLeadDirectoryQuery({ ...filters, propertyId: property.property?.id ?? null, showIndividuals: false, page: 1 });
  query.values[query.values.length - 2] = LEADS_EXPORT_ROW_LIMIT + 1;
  query.values[query.values.length - 1] = 0;
  // Reuse unchanged operational replacement/filter/order semantics, but return
  // only the export projection. Primary contact is explicit; no fallback member.
  query.text = query.text.replace("SELECT *, count(*) OVER () AS filtered_total FROM entities", `SELECT entity_type, name, member_names, person_count, email, phone, status,
    source_types, context_title, context_detail, created_at, last_activity_at, next_follow_up_at,
    CASE WHEN entity_type='lead' THEN name ELSE (
      SELECT l.name FROM public.lead_group_members gm JOIN public.leads l ON l.id=gm.lead_id
      WHERE gm.group_id=entities.id::uuid AND gm.is_primary_contact
        AND gm.removed_at IS NULL AND l.merged_into_lead_id IS NULL LIMIT 1
    ) END AS primary_contact FROM entities`);
  const rows = await sql.unsafe<Array<Record<string, unknown>>>(query.text, query.values as never[]);
  if (rows.length > LEADS_EXPORT_ROW_LIMIT) throw new LeadsExportLimitError();
  const text = (value: unknown) => value == null ? "" : String(value);
  const date = (value: unknown) => value == null ? "" : new Intl.DateTimeFormat("es-PR", { timeZone: "America/Puerto_Rico", dateStyle: "short", timeStyle: "short" }).format(new Date(String(value)));
  return rows.map((row): LeadsExportRow => ({
    recordType: row.entity_type === "group" ? "Caso" : "Lead", name: text(row.name),
    members: ((row.member_names as string[] | null) ?? []).join("; "), personCount: Number(row.person_count),
    primaryContact: text(row.primary_contact), email: text(row.email), phone: text(row.phone),
    status: UNIFIED_STATUS_LABELS[row.status as keyof typeof UNIFIED_STATUS_LABELS] ?? text(row.status),
    sources: ((row.source_types as Array<keyof typeof CANONICAL_LEAD_SOURCE_LABELS> | null) ?? []).map((source) => CANONICAL_LEAD_SOURCE_LABELS[source] ?? source).join("; "),
    property: text(row.context_title), context: text(row.context_detail), created: date(row.created_at),
    lastActivity: date(row.last_activity_at), nextFollowUp: date(row.next_follow_up_at),
  }));
}
