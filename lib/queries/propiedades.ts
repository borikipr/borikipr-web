import { sql } from "@/lib/db";

export async function getPropiedades() {
  const rows = await sql`
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
  const rows = await sql`
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
  const rows = await sql`
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