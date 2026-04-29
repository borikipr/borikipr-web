import { sql } from "@/lib/db";

export type AdminPropiedadRow = {
  id: string;
  slug: string;
  titulo: string;
  municipio: string;
  precio: string | number;
  tipo_negocio: "venta" | "renta";
  tipo_propiedad: "Casa" | "Apartamento" | "Condominio" | "Terreno";
  estado: "disponible" | "bajo_contrato" | "vendida" | "rentada";
  destacado: boolean;
  created_at: string;
  total_leads: number;
};

export type AdminPropiedadDetalle = {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  municipio: string;
  precio: string | number;
  tipo_negocio: "venta" | "renta";
  tipo_propiedad: "Casa" | "Apartamento" | "Condominio" | "Terreno";
  habitaciones: number;
  banos: number;
  estacionamientos: number;
  metros_cuadrados: number;
  estado: "disponible" | "bajo_contrato" | "vendida" | "rentada";
  destacado: boolean;
  imagenes: string[];
};

export type AdminDashboardStats = {
  total: number;
  disponibles: number;
  bajoContrato: number;
  cerradas: number;
  destacadas: number;
};

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const rows = await sql<{
    total: number;
    disponibles: number;
    bajo_contrato: number;
    cerradas: number;
    destacadas: number;
  }[]>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE estado = 'disponible')::int AS disponibles,
      COUNT(*) FILTER (WHERE estado = 'bajo_contrato')::int AS bajo_contrato,
      COUNT(*) FILTER (WHERE estado IN ('vendida', 'rentada'))::int AS cerradas,
      COUNT(*) FILTER (WHERE destacado = true)::int AS destacadas
    FROM propiedades
  `;

  const row = rows[0];

  return {
    total: row?.total ?? 0,
    disponibles: row?.disponibles ?? 0,
    bajoContrato: row?.bajo_contrato ?? 0,
    cerradas: row?.cerradas ?? 0,
    destacadas: row?.destacadas ?? 0,
  };
}

export async function getAdminPropiedades(tipo?: string) {
  const rows = await sql<AdminPropiedadRow[]>`
    SELECT
      p.id,
      p.slug,
      p.titulo,
      p.municipio,
      p.precio,
      p.tipo_negocio,
      p.tipo_propiedad,
      p.estado,
      p.destacado,
      p.created_at,
      COUNT(le.id)::int AS total_leads
    FROM propiedades p
    LEFT JOIN lead_events le ON le.propiedad_slug = p.slug
    WHERE 1=1
    ${tipo ? sql`AND p.tipo_propiedad = ${tipo}` : sql``}
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `;

  return rows;
}

export async function getAdminPropiedadById(id: string) {
  const rows = await sql<AdminPropiedadDetalle[]>`
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
    WHERE p.id = ${id}
    GROUP BY p.id
    LIMIT 1
  `;

  return rows[0] ?? null;
}