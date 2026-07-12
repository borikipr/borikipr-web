import { sql } from "@/lib/db";

export type LeadRange = "today" | "7d" | "30d" | "all";
export type LeadEventFilter = "all" | "whatsapp_click" | "contact_click";

export type LeadPropertyFilterInfo = {
  slug: string;
  titulo: string;
};

export type LeadPropertyMetadata = {
  slug: string;
  titulo: string;
  municipio: string | null;
  estado: string | null;
};

type LeadPropertyMetadataRow = {
  slug: string;
  titulo: string;
  municipio: string | null;
  estado: string | null;
};

export type LeadResumen = {
  propiedadId: string | null;
  propiedadSlug: string;
  titulo: string;
  municipio: string | null;
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
  municipio: string | null;
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

export type LeadSubmissionSummary = {
  priorityRegistrations: {
    total: number;
    lastReceived: string | null;
  };
  propertyBuyerProfiles: {
    total: number;
    lastReceived: string | null;
  };
};

export type LeadPersistedSubmissionCount = {
  propertySlug: string;
  priorityRegistrations: number;
  showingProfiles: number;
};

export type LeadDirectInteractionCount = {
  propertySlug: string;
  directInteractions: number;
};

type LeadPersistedSubmissionCountRow = {
  property_slug: string;
  priority_registrations: number | string;
  showing_profiles: number | string;
};

type LeadDirectInteractionCountRow = {
  property_slug: string;
  direct_interactions: number | string;
};

export type LeadSubmissionItem = {
  id: string;
  type: "priority_registration" | "property_buyer_profile";
  propertyId: string | null;
  propertySlug: string | null;
  propertyTitle: string | null;
  createdAt: string;
  status: string;
};

export type PriorityRegistrationLead = {
  id: string;
  propertyId: string;
  propertySlug: string;
  propertyTitle: string;
  buyerName: string;
  phone: string | null;
  email: string | null;
  purchaseType: string;
  createdAt: string;
};

export type ShowingProfileLead = {
  id: string;
  propertyId: string | null;
  propertySlug: string | null;
  propertyTitle: string | null;
  buyerName: string;
  phone: string | null;
  email: string | null;
  purchaseMethod: string;
  prequalified: string;
  createdAt: string;
};

export type ActionRequiredSummary = {
  newPriorityRegistrations: {
    total: number;
    latestPropertySlug: string | null;
    latestPropertyTitle: string | null;
    latestAt: string | null;
  };
  newShowingProfiles: {
    total: number;
    latestPropertySlug: string | null;
    latestPropertyTitle: string | null;
    latestAt: string | null;
  };
  recentDirectContacts: {
    total: number;
    totalWhatsapp: number;
    totalContact: number;
    latestPropertySlug: string | null;
    latestPropertyTitle: string | null;
    latestAt: string | null;
  };
};

export type ComingSoonRegistrationItem = {
  propertyId: string;
  propertySlug: string;
  propertyTitle: string;
  total: number;
  latestAt: string | null;
};

export type HighRecentDirectInterestItem = {
  propertyId: string | null;
  propertySlug: string;
  propertyTitle: string;
  total: number;
  totalWhatsapp: number;
  totalContact: number;
  latestAt: string | null;
};

type LeadDailyTotalRow = {
  day: string | Date;
  total: number | string;
  total_whatsapp: number | string;
  total_contact: number | string;
};

type LeadSubmissionSummaryRow = {
  source: "priority_registration" | "property_buyer_profile";
  total: number | string;
  last_received: string | Date | null;
};

type LeadSubmissionItemRow = {
  id: string;
  type: "priority_registration" | "property_buyer_profile";
  property_id: string | null;
  property_slug: string | null;
  property_title: string | null;
  created_at: string | Date;
  status: string;
};

type PriorityRegistrationLeadRow = {
  id: string;
  property_id: string;
  property_slug: string;
  property_title: string;
  name: string;
  phone: string | null;
  email: string | null;
  purchase_type: string;
  created_at: string | Date;
};

type ShowingProfileLeadRow = {
  id: string;
  property_id: string | null;
  property_slug: string | null;
  property_title: string | null;
  nombre: string;
  telefono: string | null;
  email: string | null;
  metodo_compra: string;
  prequalified: string;
  created_at: string | Date;
};

type ActionRequiredPriorityRow = {
  total: number | string;
  latest_property_slug: string | null;
  latest_property_title: string | null;
  latest_at: string | Date | null;
};

type ActionRequiredShowingRow = {
  total: number | string;
  latest_property_slug: string | null;
  latest_property_title: string | null;
  latest_at: string | Date | null;
};

type ActionRequiredDirectRow = {
  total: number | string;
  total_whatsapp: number | string;
  total_contact: number | string;
  latest_property_slug: string | null;
  latest_property_title: string | null;
  latest_at: string | Date | null;
};

type ComingSoonRegistrationRow = {
  property_id: string;
  property_slug: string;
  property_title: string;
  total: number | string;
  latest_at: string | Date | null;
};

type HighRecentDirectInterestRow = {
  property_id: string | null;
  property_slug: string;
  property_title: string;
  total: number | string;
  total_whatsapp: number | string;
  total_contact: number | string;
  latest_at: string | Date | null;
};

type LeadPropertyFilterRow = {
  slug: string;
  titulo: string;
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

function buildPriorityRegistrationRangeCondition(range: LeadRange) {
  switch (range) {
    case "today":
      return sql`AND created_at >= date_trunc('day', now())`;
    case "7d":
      return sql`AND created_at >= now() - interval '7 days'`;
    case "30d":
      return sql`AND created_at >= now() - interval '30 days'`;
    case "all":
    default:
      return sql``;
  }
}

function buildShowingProfileRangeCondition(range: LeadRange) {
  switch (range) {
    case "today":
      return sql`AND cp.created_at >= date_trunc('day', now())`;
    case "7d":
      return sql`AND cp.created_at >= now() - interval '7 days'`;
    case "30d":
      return sql`AND cp.created_at >= now() - interval '30 days'`;
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

function buildPropertyCondition(propertySlug?: string | null) {
  if (propertySlug) {
    return sql`AND le.propiedad_slug = ${propertySlug}`;
  }

  return sql``;
}

export async function getLeadPropertyFilterInfo(
  propertySlug?: string | null
): Promise<LeadPropertyFilterInfo | null> {
  if (!propertySlug) return null;

  const rows = await sql<LeadPropertyFilterRow[]>`
    SELECT slug, titulo
    FROM propiedades
    WHERE slug = ${propertySlug}
    LIMIT 1
  `;

  const row = rows[0];

  return row ? { slug: row.slug, titulo: row.titulo } : null;
}

export async function getLeadPropertyMetadataBySlugs(
  propertySlugs: string[]
): Promise<LeadPropertyMetadata[]> {
  const slugs = [
    ...new Set(
      propertySlugs
        .map((slug) => slug.trim())
        .filter((slug) => slug.length > 0 && slug !== "(not set)")
    ),
  ];

  if (slugs.length === 0) return [];

  const rows = await sql<LeadPropertyMetadataRow[]>`
    SELECT
      slug,
      titulo,
      municipio,
      estado
    FROM propiedades
    WHERE slug = ANY(${slugs})
  `;

  return rows.map((row) => ({
    slug: row.slug,
    titulo: row.titulo,
    municipio: row.municipio,
    estado: row.estado,
  }));
}

export async function getLeadsResumen(
  range: LeadRange = "all",
  eventType: LeadEventFilter = "all",
  propertySlug?: string | null
): Promise<LeadResumen[]> {
  const rangeCondition = buildRangeCondition(range);
  const eventTypeCondition = buildEventTypeCondition(eventType);
  const propertyCondition = buildPropertyCondition(propertySlug);

  const rows = await sql<LeadResumenRow[]>`
    SELECT
      p.id AS propiedad_id,
      le.propiedad_slug,
      p.titulo,
      p.municipio,
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
    ${propertyCondition}
    GROUP BY p.id, le.propiedad_slug, p.titulo, p.municipio
    ORDER BY COUNT(*) DESC, MAX(le.created_at) DESC
  `;

  return rows.map((row) => ({
    propiedadId: row.propiedad_id,
    propiedadSlug: row.propiedad_slug,
    titulo: row.titulo ?? row.propiedad_slug,
    municipio: row.municipio,
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
  eventType: LeadEventFilter = "all",
  propertySlug?: string | null
): Promise<LeadActividadItem[]> {
  const rangeCondition = buildRangeCondition(range);
  const eventTypeCondition = buildEventTypeCondition(eventType);
  const propertyCondition = buildPropertyCondition(propertySlug);

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
    ${propertyCondition}
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
  propertySlug?: string | null,
  limit = 8
): Promise<LeadRouteOrigin[]> {
  const rangeCondition = buildRangeCondition(range);
  const eventTypeCondition = buildEventTypeCondition(eventType);
  const propertyCondition = buildPropertyCondition(propertySlug);

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
    ${propertyCondition}
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
  eventType: LeadEventFilter = "all",
  propertySlug?: string | null
): Promise<LeadDailyTotal[]> {
  const rangeCondition = buildRangeCondition(range);
  const eventTypeCondition = buildEventTypeCondition(eventType);
  const propertyCondition = buildPropertyCondition(propertySlug);

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
    ${propertyCondition}
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

export async function getLeadSubmissionSummary(): Promise<LeadSubmissionSummary> {
  const rows = await sql<LeadSubmissionSummaryRow[]>`
    SELECT
      'priority_registration' AS source,
      COUNT(*) AS total,
      MAX(created_at) AS last_received
    FROM property_priority_registrations
    UNION ALL
    SELECT
      'property_buyer_profile' AS source,
      COUNT(*) AS total,
      MAX(created_at) AS last_received
    FROM consultas_propiedad
  `;

  const priority = rows.find((row) => row.source === "priority_registration");
  const profiles = rows.find((row) => row.source === "property_buyer_profile");

  return {
    priorityRegistrations: {
      total: Number(priority?.total ?? 0),
      lastReceived: priority?.last_received
        ? new Date(priority.last_received).toISOString()
        : null,
    },
    propertyBuyerProfiles: {
      total: Number(profiles?.total ?? 0),
      lastReceived: profiles?.last_received
        ? new Date(profiles.last_received).toISOString()
        : null,
    },
  };
}

export async function getLeadPersistedSubmissionCountsByProperty(): Promise<
  LeadPersistedSubmissionCount[]
> {
  return getLeadPersistedSubmissionCountsByPropertyRange("all");
}

export async function getLeadDirectInteractionCountsByPropertyRange(
  range: LeadRange = "all"
): Promise<LeadDirectInteractionCount[]> {
  const rangeCondition = buildRangeCondition(range);
  const rows = await sql<LeadDirectInteractionCountRow[]>`
    SELECT
      le.propiedad_slug AS property_slug,
      COUNT(*) AS direct_interactions
    FROM lead_events le
    WHERE le.propiedad_slug IS NOT NULL
      AND le.tipo_evento IN ('whatsapp_click', 'contact_click')
      ${rangeCondition}
    GROUP BY le.propiedad_slug
  `;

  return rows.map((row) => ({
    propertySlug: row.property_slug,
    directInteractions: Number(row.direct_interactions),
  }));
}

export async function getLeadPersistedSubmissionCountsByPropertyRange(
  range: LeadRange = "all"
): Promise<LeadPersistedSubmissionCount[]> {
  const priorityRangeCondition = buildPriorityRegistrationRangeCondition(range);
  const showingRangeCondition = buildShowingProfileRangeCondition(range);
  const rows = await sql<LeadPersistedSubmissionCountRow[]>`
    SELECT
      property_slug,
      SUM(priority_registrations) AS priority_registrations,
      SUM(showing_profiles) AS showing_profiles
    FROM (
      SELECT
        property_slug,
        COUNT(*) AS priority_registrations,
        0 AS showing_profiles
      FROM property_priority_registrations
      WHERE property_slug IS NOT NULL
      ${priorityRangeCondition}
      GROUP BY property_slug

      UNION ALL

      SELECT
        p.slug AS property_slug,
        0 AS priority_registrations,
        COUNT(*) AS showing_profiles
      FROM consultas_propiedad cp
      INNER JOIN propiedades p ON p.id = cp.propiedad_id
      WHERE p.slug IS NOT NULL
      ${showingRangeCondition}
      GROUP BY p.slug
    ) submissions
    GROUP BY property_slug
  `;

  return rows.map((row) => ({
    propertySlug: row.property_slug,
    priorityRegistrations: Number(row.priority_registrations),
    showingProfiles: Number(row.showing_profiles),
  }));
}

export async function getRecentLeadSubmissions(
  limit = 10
): Promise<LeadSubmissionItem[]> {
  const rows = await sql<LeadSubmissionItemRow[]>`
    SELECT
      id::text,
      'priority_registration' AS type,
      property_id::text AS property_id,
      property_slug,
      property_title,
      created_at,
      CASE
        WHEN notified_at IS NOT NULL THEN 'Notified'
        ELSE 'Received'
      END AS status
    FROM property_priority_registrations
    UNION ALL
    SELECT
      cp.id::text,
      'property_buyer_profile' AS type,
      cp.propiedad_id::text AS property_id,
      p.slug AS property_slug,
      p.titulo AS property_title,
      cp.created_at,
      'Received' AS status
    FROM consultas_propiedad cp
    LEFT JOIN propiedades p ON p.id = cp.propiedad_id
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    propertyId: row.property_id,
    propertySlug: row.property_slug,
    propertyTitle: row.property_title,
    createdAt: new Date(row.created_at).toISOString(),
    status: row.status,
  }));
}

export async function getPriorityRegistrationLeads(
  limit = 25
): Promise<PriorityRegistrationLead[]> {
  const rows = await sql<PriorityRegistrationLeadRow[]>`
    SELECT
      id::text,
      property_id::text,
      property_slug,
      property_title,
      name,
      phone,
      email,
      purchase_type,
      created_at
    FROM property_priority_registrations
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    id: row.id,
    propertyId: row.property_id,
    propertySlug: row.property_slug,
    propertyTitle: row.property_title,
    buyerName: row.name,
    phone: row.phone,
    email: row.email,
    purchaseType: row.purchase_type,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function getShowingProfileLeads(
  limit = 25
): Promise<ShowingProfileLead[]> {
  const rows = await sql<ShowingProfileLeadRow[]>`
    SELECT
      cp.id::text,
      cp.propiedad_id::text AS property_id,
      p.slug AS property_slug,
      p.titulo AS property_title,
      cp.nombre,
      cp.telefono,
      cp.email,
      cp.metodo_compra,
      CASE
        WHEN cp.carta_precalificacion_url IS NOT NULL
          OR cp.carta_precalificacion_key IS NOT NULL
        THEN 'Sí'
        ELSE 'No'
      END AS prequalified,
      cp.created_at
    FROM consultas_propiedad cp
    LEFT JOIN propiedades p ON p.id = cp.propiedad_id
    ORDER BY cp.created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    id: row.id,
    propertyId: row.property_id,
    propertySlug: row.property_slug,
    propertyTitle: row.property_title,
    buyerName: row.nombre,
    phone: row.telefono,
    email: row.email,
    purchaseMethod: row.metodo_compra,
    prequalified: row.prequalified,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function getActionRequiredSummary(): Promise<ActionRequiredSummary> {
  const [priorityRows, showingRows, directRows] = await Promise.all([
    sql<ActionRequiredPriorityRow[]>`
      WITH recent AS (
        SELECT
          property_slug,
          property_title,
          created_at,
          ROW_NUMBER() OVER (ORDER BY created_at DESC) AS row_number
        FROM property_priority_registrations
        WHERE created_at >= now() - interval '24 hours'
      )
      SELECT
        COUNT(*) AS total,
        MAX(property_slug) FILTER (WHERE row_number = 1) AS latest_property_slug,
        MAX(property_title) FILTER (WHERE row_number = 1) AS latest_property_title,
        MAX(created_at) AS latest_at
      FROM recent
    `,
    sql<ActionRequiredShowingRow[]>`
      WITH recent AS (
        SELECT
          p.slug AS property_slug,
          p.titulo AS property_title,
          cp.created_at,
          ROW_NUMBER() OVER (ORDER BY cp.created_at DESC) AS row_number
        FROM consultas_propiedad cp
        LEFT JOIN propiedades p ON p.id = cp.propiedad_id
        WHERE cp.created_at >= now() - interval '24 hours'
      )
      SELECT
        COUNT(*) AS total,
        MAX(property_slug) FILTER (WHERE row_number = 1) AS latest_property_slug,
        MAX(property_title) FILTER (WHERE row_number = 1) AS latest_property_title,
        MAX(created_at) AS latest_at
      FROM recent
    `,
    sql<ActionRequiredDirectRow[]>`
      WITH recent AS (
        SELECT
          le.propiedad_slug,
          p.titulo AS property_title,
          le.tipo_evento,
          le.created_at,
          ROW_NUMBER() OVER (ORDER BY le.created_at DESC) AS row_number
        FROM lead_events le
        LEFT JOIN propiedades p ON p.slug = le.propiedad_slug
        WHERE le.created_at >= now() - interval '24 hours'
          AND le.tipo_evento IN ('whatsapp_click', 'contact_click')
      )
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE tipo_evento = 'whatsapp_click') AS total_whatsapp,
        COUNT(*) FILTER (WHERE tipo_evento = 'contact_click') AS total_contact,
        MAX(propiedad_slug) FILTER (WHERE row_number = 1) AS latest_property_slug,
        MAX(property_title) FILTER (WHERE row_number = 1) AS latest_property_title,
        MAX(created_at) AS latest_at
      FROM recent
    `,
  ]);

  const priority = priorityRows[0];
  const showing = showingRows[0];
  const direct = directRows[0];

  return {
    newPriorityRegistrations: {
      total: Number(priority?.total ?? 0),
      latestPropertySlug: priority?.latest_property_slug ?? null,
      latestPropertyTitle: priority?.latest_property_title ?? null,
      latestAt: priority?.latest_at
        ? new Date(priority.latest_at).toISOString()
        : null,
    },
    newShowingProfiles: {
      total: Number(showing?.total ?? 0),
      latestPropertySlug: showing?.latest_property_slug ?? null,
      latestPropertyTitle: showing?.latest_property_title ?? null,
      latestAt: showing?.latest_at
        ? new Date(showing.latest_at).toISOString()
        : null,
    },
    recentDirectContacts: {
      total: Number(direct?.total ?? 0),
      totalWhatsapp: Number(direct?.total_whatsapp ?? 0),
      totalContact: Number(direct?.total_contact ?? 0),
      latestPropertySlug: direct?.latest_property_slug ?? null,
      latestPropertyTitle: direct?.latest_property_title ?? null,
      latestAt: direct?.latest_at
        ? new Date(direct.latest_at).toISOString()
        : null,
    },
  };
}

export async function getComingSoonPropertiesWithRegistrations(
  limit = 5
): Promise<ComingSoonRegistrationItem[]> {
  const rows = await sql<ComingSoonRegistrationRow[]>`
    SELECT
      p.id::text AS property_id,
      p.slug AS property_slug,
      p.titulo AS property_title,
      COUNT(pr.id) AS total,
      MAX(pr.created_at) AS latest_at
    FROM propiedades p
    INNER JOIN property_priority_registrations pr
      ON pr.property_id = p.id
    WHERE p.estado = 'coming_soon'
    GROUP BY p.id, p.slug, p.titulo
    ORDER BY COUNT(pr.id) DESC, MAX(pr.created_at) DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    propertyId: row.property_id,
    propertySlug: row.property_slug,
    propertyTitle: row.property_title,
    total: Number(row.total),
    latestAt: row.latest_at ? new Date(row.latest_at).toISOString() : null,
  }));
}

export async function getHighRecentDirectInterest(
  limit = 5
): Promise<HighRecentDirectInterestItem[]> {
  const rows = await sql<HighRecentDirectInterestRow[]>`
    SELECT
      p.id::text AS property_id,
      le.propiedad_slug AS property_slug,
      COALESCE(p.titulo, le.propiedad_slug) AS property_title,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE le.tipo_evento = 'whatsapp_click') AS total_whatsapp,
      COUNT(*) FILTER (WHERE le.tipo_evento = 'contact_click') AS total_contact,
      MAX(le.created_at) AS latest_at
    FROM lead_events le
    LEFT JOIN propiedades p ON p.slug = le.propiedad_slug
    WHERE le.created_at >= now() - interval '7 days'
      AND le.tipo_evento IN ('whatsapp_click', 'contact_click')
      AND le.propiedad_slug IS NOT NULL
    GROUP BY p.id, le.propiedad_slug, p.titulo
    ORDER BY COUNT(*) DESC, MAX(le.created_at) DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    propertyId: row.property_id,
    propertySlug: row.property_slug,
    propertyTitle: row.property_title,
    total: Number(row.total),
    totalWhatsapp: Number(row.total_whatsapp),
    totalContact: Number(row.total_contact),
    latestAt: row.latest_at ? new Date(row.latest_at).toISOString() : null,
  }));
}
