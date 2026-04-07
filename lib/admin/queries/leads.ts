import { sql } from "@/lib/db";

export type LeadRange = "today" | "7d" | "30d" | "all";

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

export async function getLeadsResumen(
  range: LeadRange = "all"
): Promise<LeadResumen[]> {
  const rangeCondition = buildRangeCondition(range);

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
    LEFT JOIN propiedades p
      ON p.slug = le.propiedad_slug
    WHERE le.propiedad_slug IS NOT NULL
    ${rangeCondition}
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
  range: LeadRange = "all"
): Promise<LeadActividadItem[]> {
  const rangeCondition = buildRangeCondition(range);

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
    LEFT JOIN propiedades p
      ON p.slug = le.propiedad_slug
    WHERE 1=1
    ${rangeCondition}
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