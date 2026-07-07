import { sql } from "@/lib/db";

type TipoNegocio = "venta" | "renta";
type EstadoPropiedad =
  | "disponible"
  | "coming_soon"
  | "bajo_contrato"
  | "vendida"
  | "rentada";

function publicOriginExpression() {
  return sql`
    CASE
      WHEN p.origen_listado IN ('co_broke', 'co-broke', 'co broke', 'colaboracion', 'colaboración')
        THEN 'co_broke'
      ELSE p.origen_listado
    END
  `;
}

function publicVisibilityCondition() {
  return sql`(
    p.origen_listado = 'propio'
    OR (
      p.origen_listado IN ('co_broke', 'co-broke', 'co broke', 'colaboracion', 'colaboración')
      AND COALESCE(p.permiso_publicar_web, false) = true
    )
  )`;
}

export type PropiedadQueryRow = {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  municipio: string;
  sector_comunidad?: string | null;
  precio: string | number;
  tipo_negocio: TipoNegocio;
  tipo_propiedad: string;
  habitaciones: number;
  banos: number;
  estacionamientos: number;
  metros_cuadrados: number;
  estado: EstadoPropiedad;
  destacado: boolean;
  imagenes: string[];
  origen_listado: "propio" | "co_broke" | "externo";
  configuracion_formulario?: Record<string, unknown> | null;
  requiere_precalificacion?: boolean | null;
  fecha_showing?: string | Date | null;
  pregunta_personalizada?: string | null;
  formulario_showing_activo?: boolean;
};

export type PropiedadHomeDestacada = {
  id: string;
  slug: string;
  titulo: string;
  municipio: string;
  sector_comunidad?: string | null;
  precio: string | number;
  tipo_negocio: TipoNegocio;
  tipo_propiedad: string;
  habitaciones: number;
  banos: number;
  estado: EstadoPropiedad;
  destacado: boolean;
  imagenes: string[];
  origen_listado: "propio" | "co_broke" | "externo";
  configuracion_formulario?: Record<string, unknown> | null;
  requiere_precalificacion?: boolean | null;
  fecha_showing?: string | Date | null;
  pregunta_personalizada?: string | null;
  formulario_showing_activo?: boolean;
};

export async function getPropiedadesDestacadas(limit = 3) {
  const rows = await sql<PropiedadHomeDestacada[]>`
    SELECT
      p.id,
      p.slug,
      p.titulo,
      p.municipio,
      to_jsonb(p)->>'sector_comunidad' AS sector_comunidad,
      p.precio,
      p.tipo_negocio,
      p.tipo_propiedad,
      p.habitaciones,
      p.banos,
      p.estado,
      p.destacado,
      ${publicOriginExpression()} AS origen_listado,
      p.configuracion_formulario,
      p.requiere_precalificacion,
      p.fecha_showing,
      p.pregunta_personalizada,
      p.formulario_showing_activo,
      COALESCE(
        json_agg(pi.url ORDER BY pi.orden) FILTER (WHERE pi.url IS NOT NULL),
        '[]'
      ) AS imagenes
    FROM propiedades p
    LEFT JOIN propiedad_imagenes pi ON pi.propiedad_id = p.id
    WHERE p.destacado = true
      AND p.estado IN ('disponible', 'coming_soon', 'bajo_contrato')
      AND ${publicVisibilityCondition()}
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT ${limit}
  `;

  return rows;
}

export async function getPropiedades() {
  const rows = await sql<PropiedadQueryRow[]>`
    SELECT
      p.id,
      p.slug,
      p.titulo,
      p.descripcion,
      p.municipio,
      to_jsonb(p)->>'sector_comunidad' AS sector_comunidad,
      p.precio,
      p.tipo_negocio,
      p.tipo_propiedad,
      p.habitaciones,
      p.banos,
      p.estacionamientos,
      p.metros_cuadrados,
      p.estado,
      p.destacado,
      ${publicOriginExpression()} AS origen_listado,
      p.configuracion_formulario,
      p.requiere_precalificacion,
      p.fecha_showing,
      p.pregunta_personalizada,
      p.formulario_showing_activo,
      COALESCE(
        json_agg(pi.url ORDER BY pi.orden) FILTER (WHERE pi.url IS NOT NULL),
        '[]'
      ) AS imagenes
    FROM propiedades p
    LEFT JOIN propiedad_imagenes pi ON pi.propiedad_id = p.id
    WHERE p.estado IN ('disponible', 'coming_soon', 'bajo_contrato')
      AND ${publicVisibilityCondition()}
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `;

  return rows;
}

export async function getPropiedadBySlug(slug: string) {
  const rows = await sql<PropiedadQueryRow[]>`
    SELECT
      p.id,
      p.slug,
      p.titulo,
      p.descripcion,
      p.municipio,
      to_jsonb(p)->>'sector_comunidad' AS sector_comunidad,
      p.precio,
      p.tipo_negocio,
      p.tipo_propiedad,
      p.habitaciones,
      p.banos,
      p.estacionamientos,
      p.metros_cuadrados,
      p.estado,
      p.destacado,
      ${publicOriginExpression()} AS origen_listado,
      p.configuracion_formulario,
      p.requiere_precalificacion,
      p.fecha_showing,
      p.pregunta_personalizada,
      p.formulario_showing_activo,
      COALESCE(
        json_agg(pi.url ORDER BY pi.orden) FILTER (WHERE pi.url IS NOT NULL),
        '[]'
      ) AS imagenes
    FROM propiedades p
    LEFT JOIN propiedad_imagenes pi ON pi.propiedad_id = p.id
    WHERE p.slug = ${slug}
      AND ${publicVisibilityCondition()}
    GROUP BY p.id
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function getPropiedadesSimilares(
  slug: string,
  municipio: string,
  tipoNegocio: "venta" | "renta",
  tipoPropiedad: string,
  limit = 3
) {
  const rows = await sql<PropiedadQueryRow[]>`
    SELECT
      p.id,
      p.slug,
      p.titulo,
      p.descripcion,
      p.municipio,
      to_jsonb(p)->>'sector_comunidad' AS sector_comunidad,
      p.precio,
      p.tipo_negocio,
      p.tipo_propiedad,
      p.habitaciones,
      p.banos,
      p.estacionamientos,
      p.metros_cuadrados,
      p.estado,
      p.destacado,
      ${publicOriginExpression()} AS origen_listado,
      p.configuracion_formulario,
      p.requiere_precalificacion,
      p.fecha_showing,
      p.pregunta_personalizada,
      p.formulario_showing_activo,
      COALESCE(
        json_agg(pi.url ORDER BY pi.orden) FILTER (WHERE pi.url IS NOT NULL),
        '[]'
      ) AS imagenes
    FROM propiedades p
    LEFT JOIN propiedad_imagenes pi ON pi.propiedad_id = p.id
    WHERE p.slug <> ${slug}
      AND p.tipo_negocio = ${tipoNegocio}
      AND p.estado IN ('disponible', 'coming_soon', 'bajo_contrato')
      AND ${publicVisibilityCondition()}
      AND (
        p.municipio = ${municipio}
        OR p.tipo_propiedad = ${tipoPropiedad}
      )
    GROUP BY p.id
    ORDER BY
      CASE
        WHEN p.municipio = ${municipio} THEN 0
        ELSE 1
      END,
      p.destacado DESC,
      p.created_at DESC
    LIMIT ${limit}
  `;

  return rows;
}

export type PropiedadesPaginadas = {
  propiedades: PropiedadQueryRow[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
};

export type PropiedadesFiltros = {
  q?: string;
  tipoNegocio?: "" | TipoNegocio;
  municipio?: string;
  tipoPropiedad?: string[];
  precioMin?: string;
  precioMax?: string;
  habitaciones?: string;
  banos?: string;
  estado?: "" | EstadoPropiedad;
  orden?: "" | "precio-asc" | "precio-desc" | "municipio-asc" | "municipio-desc";
};

function parseNumericFilter(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace("+", ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function getPropiedadesPaginadas(
  page: number = 1,
  itemsPerPage: number = 12,
  filtros: PropiedadesFiltros = {}
) {
  const offset = (page - 1) * itemsPerPage;
  const q = filtros.q?.trim();
  const qLike = q ? `%${q}%` : null;
  const precioMin = parseNumericFilter(filtros.precioMin);
  const precioMax = parseNumericFilter(filtros.precioMax);
  const habitaciones = parseNumericFilter(filtros.habitaciones);
  const banos = parseNumericFilter(filtros.banos);
  const tipoPropiedad = filtros.tipoPropiedad?.filter(Boolean) ?? [];

  const conditions = [
    filtros.estado
      ? sql`p.estado = ${filtros.estado}`
      : sql`p.estado IN ('disponible', 'coming_soon', 'bajo_contrato')`,
    publicVisibilityCondition(),
  ];

  if (qLike) {
    conditions.push(sql`(
      p.titulo ILIKE ${qLike}
      OR p.descripcion ILIKE ${qLike}
      OR p.municipio ILIKE ${qLike}
      OR (to_jsonb(p)->>'sector_comunidad') ILIKE ${qLike}
      OR p.tipo_propiedad ILIKE ${qLike}
    )`);
  }

  if (filtros.tipoNegocio) {
    conditions.push(sql`p.tipo_negocio = ${filtros.tipoNegocio}`);
  }

  if (filtros.municipio?.trim()) {
    conditions.push(sql`p.municipio = ${filtros.municipio.trim()}`);
  }

  if (tipoPropiedad.length > 0) {
    conditions.push(sql`p.tipo_propiedad IN ${sql(tipoPropiedad)}`);
  }

  if (precioMin !== null) {
    conditions.push(sql`p.precio >= ${precioMin}`);
  }

  if (precioMax !== null) {
    conditions.push(sql`p.precio <= ${precioMax}`);
  }

  if (habitaciones !== null) {
    conditions.push(sql`p.habitaciones >= ${habitaciones}`);
  }

  if (banos !== null) {
    conditions.push(sql`p.banos >= ${banos}`);
  }

  const whereClause = conditions.reduce((acc, condition) => sql`${acc} AND ${condition}`);
  const orderClause =
    filtros.orden === "precio-asc"
      ? sql`p.precio ASC, p.created_at DESC`
      : filtros.orden === "precio-desc"
        ? sql`p.precio DESC, p.created_at DESC`
        : filtros.orden === "municipio-asc"
          ? sql`p.municipio ASC, p.created_at DESC`
          : filtros.orden === "municipio-desc"
            ? sql`p.municipio DESC, p.created_at DESC`
            : sql`p.created_at DESC`;

  const rows = await sql<PropiedadQueryRow[]>`
    SELECT
      p.id,
      p.slug,
      p.titulo,
      p.descripcion,
      p.municipio,
      to_jsonb(p)->>'sector_comunidad' AS sector_comunidad,
      p.precio,
      p.tipo_negocio,
      p.tipo_propiedad,
      p.habitaciones,
      p.banos,
      p.estacionamientos,
      p.metros_cuadrados,
      p.estado,
      p.destacado,
      ${publicOriginExpression()} AS origen_listado,
      p.configuracion_formulario,
      p.requiere_precalificacion,
      p.fecha_showing,
      p.pregunta_personalizada,
      p.formulario_showing_activo,
      COALESCE(
        json_agg(pi.url ORDER BY pi.orden) FILTER (WHERE pi.url IS NOT NULL),
        '[]'
      ) AS imagenes
    FROM propiedades p
    LEFT JOIN propiedad_imagenes pi ON pi.propiedad_id = p.id
    WHERE ${whereClause}
    GROUP BY p.id
    ORDER BY ${orderClause}
    LIMIT ${itemsPerPage} OFFSET ${offset}
  `;

  const countResult = await sql<{ total: number }[]>`
    SELECT COUNT(DISTINCT p.id) as total
    FROM propiedades p
    WHERE ${whereClause}
  `;

  const totalItems = countResult[0]?.total || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return {
    propiedades: rows,
    totalPages,
    currentPage: page,
    totalItems,
  };
}
