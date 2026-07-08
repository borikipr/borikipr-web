import { sql } from "@/lib/db";

export type LeadRange = "today" | "7d" | "30d" | "all";
export type LeadEventFilter = "all" | "whatsapp_click" | "contact_click";

export type LeadResumen = {
  propiedadId: string | null;
  propiedadSlug: string;
  titulo: string;
  total: number;
  ultimaInteraccion: string | null;
  primeraInteraccion: string | null;
  totalWhatsapp: number;
  totalContact: number;
};

type LeadResumenRow = {
  propiedad_id: string | null;
  propiedad_slug: string;
  titulo: string | null;
  total: number | string;
  ultima_interaccion: string | Date | null;
  primera_interaccion: string | Date | null;
  total_whatsapp: number | string;
  total_contact: number | string;
};

export type LeadActividadItem = {
  id: string;
  propiedadId: string | null;
  propiedadSlug: string | null;
  titulo: string;
  tipoEvento: string;
  rutaOrigen: string | null;
  createdAt: string;
};

type LeadActividadRow = {
  id: string;
  propiedad_id: string | null;
  propiedad_slug: string | null;
  titulo: string | null;
  tipo_evento: string;
  ruta_origen: string | null;
  created_at: string | Date;
};

export type LeadRouteOrigin = {
  rutaOrigen: string;
  total: number;
  totalWhatsapp: number;
  totalContact: number;
  ultimaInteraccion: string | null;
};

type LeadRouteOriginRow = {
  ruta_origen: string | null;
  total: number | string;
  total_whatsapp: number | string;
  total_contact: number | string;
  ultima_interaccion: string | Date | null;
};

export type LeadDailyTotal = {
  day: string;
  total: number;
  totalWhatsapp: number;
  totalContact: number;
};

type LeadDailyTotalRow = {
  day: string | Date;
  total: number | string;
  total_whatsapp: number | string;
  total_contact: number | string;
};

function buildRangeCondition(range: LeadRange) {
  switch (range) {
    case "today":
      return sql`AND le.created_at >= date_trunc('day', now())`;
    case "7d":
      return sql`AND le.created_at >= now() - interval '7 days'`;
    case "30d":
      return sql`AND le.created_at >= now() - interval '30 days'`;
    case "all":
    default:
      return sql``;
  }
}

function buildEventTypeCondition(eventType: LeadEventFilter) {
  if (eventType === "whatsapp_click" || eventType === "contact_click") {
    return sql`AND le.tipo_evento = ${eventType}`;
  }

  return sql``;
}

export async function getLeadsResumen(
  range: LeadRange = "all",
  eventType: LeadEventFilter = "all"
): Promise<LeadResumen[]> {
  const rangeCondition = buildRangeCondition(range);
  const eventTypeCondition = buildEventTypeCondition(eventType);

  const rows = await sql<LeadResumenRow[]>`
    SELECT
      p.id AS propiedad_id,
      le.propiedad_slug,
      p.titulo,
      COUNT(*) AS total,
      MAX(le.created_at) AS ultima_interaccion,
      MIN(le.created_at) AS primera_interaccion,
      COUNT(*) FILTER (WHERE le.tipo_evento = 'whatsapp_click') AS total_whatsapp,
      COUNT(*) FILTER (WHERE le.tipo_evento = 'contact_click') AS total_contact
    FROM lead_events le
    INNER JOIN propiedades p
      ON p.slug = le.propiedad_slug
    WHERE le.propiedad_slug IS NOT NULL
    ${rangeCondition}
    ${eventTypeCondition}
    GROUP BY p.id, le.propiedad_slug, p.titulo
    ORDER BY COUNT(*) DESC, MAX(le.created_at) DESC
  `;

  return rows.map((row) => ({
    propiedadId: row.propiedad_id,
    propiedadSlug: row.propiedad_slug,
    titulo: row.titulo ?? row.propiedad_slug,
    total: Number(row.total),
    ultimaInteraccion: row.ultima_interaccion
      ? new Date(row.ultima_interaccion).toISOString()
      : null,
    primeraInteraccion: row.primera_interaccion
      ? new Date(row.primera_interaccion).toISOString()
      : null,
    totalWhatsapp: Number(row.total_whatsapp),
    totalContact: Number(row.total_contact),
  }));
}

export async function getLeadsActividadReciente(
  limit = 20,
  range: LeadRange = "all",
  eventType: LeadEventFilter = "all"
): Promise<LeadActividadItem[]> {
  const rangeCondition = buildRangeCondition(range);
  const eventTypeCondition = buildEventTypeCondition(eventType);

  const rows = await sql<LeadActividadRow[]>`
    SELECT
      le.id,
      p.id AS propiedad_id,
      le.propiedad_slug,
      p.titulo,
      le.tipo_evento,
      le.ruta_origen,
      le.created_at
    FROM lead_events le
    INNER JOIN propiedades p
      ON p.slug = le.propiedad_slug
    WHERE 1=1
    ${rangeCondition}
    ${eventTypeCondition}
    ORDER BY le.created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    id: row.id,
    propiedadId: row.propiedad_id,
    propiedadSlug: row.propiedad_slug,
    titulo: row.titulo ?? row.propiedad_slug ?? "Evento general",
    tipoEvento: row.tipo_evento,
    rutaOrigen: row.ruta_origen,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function getLeadRouteOrigins(
  range: LeadRange = "all",
  eventType: LeadEventFilter = "all",
  limit = 8
): Promise<LeadRouteOrigin[]> {
  const rangeCondition = buildRangeCondition(range);
  const eventTypeCondition = buildEventTypeCondition(eventType);

  const rows = await sql<LeadRouteOriginRow[]>`
    SELECT
      COALESCE(NULLIF(le.ruta_origen, ''), 'Sin ruta') AS ruta_origen,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE le.tipo_evento = 'whatsapp_click') AS total_whatsapp,
      COUNT(*) FILTER (WHERE le.tipo_evento = 'contact_click') AS total_contact,
      MAX(le.created_at) AS ultima_interaccion
    FROM lead_events le
    WHERE 1=1
    ${rangeCondition}
    ${eventTypeCondition}
    GROUP BY COALESCE(NULLIF(le.ruta_origen, ''), 'Sin ruta')
    ORDER BY COUNT(*) DESC, MAX(le.created_at) DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    rutaOrigen: row.ruta_origen ?? "Sin ruta",
    total: Number(row.total),
    totalWhatsapp: Number(row.total_whatsapp),
    totalContact: Number(row.total_contact),
    ultimaInteraccion: row.ultima_interaccion
      ? new Date(row.ultima_interaccion).toISOString()
      : null,
  }));
}

export async function getLeadDailyTotals(
  range: LeadRange = "all",
  eventType: LeadEventFilter = "all"
): Promise<LeadDailyTotal[]> {
  const rangeCondition = buildRangeCondition(range);
  const eventTypeCondition = buildEventTypeCondition(eventType);

  const rows = await sql<LeadDailyTotalRow[]>`
    SELECT
      date_trunc('day', le.created_at) AS day,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE le.tipo_evento = 'whatsapp_click') AS total_whatsapp,
      COUNT(*) FILTER (WHERE le.tipo_evento = 'contact_click') AS total_contact
    FROM lead_events le
    WHERE 1=1
    ${rangeCondition}
    ${eventTypeCondition}
    GROUP BY date_trunc('day', le.created_at)
    ORDER BY date_trunc('day', le.created_at) ASC
  `;

  return rows.map((row) => ({
    day: new Date(row.day).toISOString(),
    total: Number(row.total),
    totalWhatsapp: Number(row.total_whatsapp),
    totalContact: Number(row.total_contact),
  }));
}
