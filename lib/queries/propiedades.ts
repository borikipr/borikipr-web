import { sql } from "@/lib/db";

type TipoNegocio = "venta" | "renta";
type EstadoPropiedad =
  | "disponible"
  | "bajo_contrato"
  | "vendida"
  | "rentada";

export type PropiedadQueryRow = {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  municipio: string;
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
};

export type PropiedadHomeDestacada = {
  id: string;
  slug: string;
  titulo: string;
  municipio: string;
  precio: string | number;
  tipo_negocio: TipoNegocio;
  tipo_propiedad: string;
  habitaciones: number;
  banos: number;
  estado: EstadoPropiedad;
  destacado: boolean;
  imagenes: string[];
};

export async function getPropiedadesDestacadas(limit = 3) {
  const rows = await sql<PropiedadHomeDestacada[]>`
    SELECT
      p.id,
      p.slug,
      p.titulo,
      p.municipio,
      p.precio,
      p.tipo_negocio,
      p.tipo_propiedad,
      p.habitaciones,
      p.banos,
      p.estado,
      p.destacado,
      COALESCE(
        json_agg(pi.url ORDER BY pi.orden) FILTER (WHERE pi.url IS NOT NULL),
        '[]'
      ) AS imagenes
    FROM propiedades p
    LEFT JOIN propiedad_imagenes pi ON pi.propiedad_id = p.id
    WHERE p.destacado = true
      AND p.estado IN ('disponible', 'bajo_contrato')
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
      p.precio,
      p.tipo_negocio,
      p.tipo_propiedad,
      p.habitaciones,
      p.banos,
      p.estacionamientos,
      p.metros_cuadrados,
      p.estado,
      p.destacado,
      COALESCE(
        json_agg(pi.url ORDER BY pi.orden) FILTER (WHERE pi.url IS NOT NULL),
        '[]'
      ) AS imagenes
    FROM propiedades p
    LEFT JOIN propiedad_imagenes pi ON pi.propiedad_id = p.id
    WHERE p.estado IN ('disponible', 'bajo_contrato')
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
      p.precio,
      p.tipo_negocio,
      p.tipo_propiedad,
      p.habitaciones,
      p.banos,
      p.estacionamientos,
      p.metros_cuadrados,
      p.estado,
      p.destacado,
      COALESCE(
        json_agg(pi.url ORDER BY pi.orden) FILTER (WHERE pi.url IS NOT NULL),
        '[]'
      ) AS imagenes
    FROM propiedades p
    LEFT JOIN propiedad_imagenes pi ON pi.propiedad_id = p.id
    WHERE p.slug = ${slug}
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
      p.precio,
      p.tipo_negocio,
      p.tipo_propiedad,
      p.habitaciones,
      p.banos,
      p.estacionamientos,
      p.metros_cuadrados,
      p.estado,
      p.destacado,
      COALESCE(
        json_agg(pi.url ORDER BY pi.orden) FILTER (WHERE pi.url IS NOT NULL),
        '[]'
      ) AS imagenes
    FROM propiedades p
    LEFT JOIN propiedad_imagenes pi ON pi.propiedad_id = p.id
    WHERE p.slug <> ${slug}
      AND p.tipo_negocio = ${tipoNegocio}
      AND p.estado IN ('disponible', 'bajo_contrato')
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

export async function getPropiedadesPaginadas(
  page: number = 1,
  itemsPerPage: number = 12
) {
  const offset = (page - 1) * itemsPerPage;

  const rows = await sql<PropiedadQueryRow[]>`
    SELECT
      p.id,
      p.slug,
      p.titulo,
      p.descripcion,
      p.municipio,
      p.precio,
      p.tipo_negocio,
      p.tipo_propiedad,
      p.habitaciones,
      p.banos,
      p.estacionamientos,
      p.metros_cuadrados,
      p.estado,
      p.destacado,
      COALESCE(
        json_agg(pi.url ORDER BY pi.orden) FILTER (WHERE pi.url IS NOT NULL),
        '[]'
      ) AS imagenes
    FROM propiedades p
    LEFT JOIN propiedad_imagenes pi ON pi.propiedad_id = p.id
    WHERE p.estado IN ('disponible', 'bajo_contrato')
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT ${itemsPerPage} OFFSET ${offset}
  `;

  const countResult = await sql<{ total: number }[]>`
    SELECT COUNT(DISTINCT p.id) as total FROM propiedades p WHERE p.estado IN ('disponible', 'bajo_contrato')
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
