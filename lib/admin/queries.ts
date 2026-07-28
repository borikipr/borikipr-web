import { sql } from "@/lib/db";
import { getOperationalPropertyCounts } from "@/lib/admin/queries/unified-lead-directory";

export type AdminPropiedadRow = {
  id: string;
  slug: string;
  titulo: string;
  municipio: string;
  sector_comunidad?: string | null;
  precio: string | number;
  tipo_negocio: "venta" | "renta";
  tipo_propiedad: "Casa" | "Apartamento" | "Condominio" | "Terreno";
  estado: "disponible" | "coming_soon" | "bajo_contrato" | "vendida" | "rentada";
  destacado: boolean;
  created_at: string;
  total_interactions: number;
  total_contacts: number;
  origen_listado: "propio" | "co_broke" | "externo";
};

export type AdminPropiedadDetalle = {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  municipio: string;
  sector_comunidad?: string | null;
  precio: string | number;
  tipo_negocio: "venta" | "renta";
  tipo_propiedad: "Casa" | "Apartamento" | "Condominio" | "Terreno";
  habitaciones: number;
  banos: number;
  estacionamientos: number;
  metros_cuadrados: number;
  estado: "disponible" | "coming_soon" | "bajo_contrato" | "vendida" | "rentada";
  destacado: boolean;
  imagenes: string[];
  origen_listado: "propio" | "co_broke" | "externo";
  corredor_colaborador_nombre?: string;
  corredor_colaborador_empresa?: string;
  corredor_colaborador_contacto?: string;
  enlace_original?: string;
  permiso_publicar_web: boolean;
  permiso_usar_fotos: boolean;
  notas_internas?: string;
  configuracion_formulario?: Record<string, unknown> | null;
  tiene_placas_solares?: boolean | null;
  cantidad_placas?: number | null;
  placas_en_lease?: boolean | null;
  open_house_solar_question_enabled: boolean;
  requiere_precalificacion?: boolean | null;
  acepta_cdbg?: boolean | null;
  fecha_showing?: string | null;
  pregunta_personalizada?: string | null;
  formulario_showing_activo: boolean;
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
  const [rows, operationalCounts] = await Promise.all([
    sql<Omit<AdminPropiedadRow, "total_contacts">[]>`
      SELECT
        p.id,
        p.slug,
        p.titulo,
        p.municipio,
        to_jsonb(p)->>'sector_comunidad' AS sector_comunidad,
        p.precio,
        p.tipo_negocio,
        p.tipo_propiedad,
        p.estado,
        p.destacado,
        p.created_at,
        p.origen_listado,
        COUNT(le.id)::int AS total_interactions
      FROM propiedades p
      LEFT JOIN lead_events le ON le.propiedad_slug = p.slug
      WHERE 1=1
      ${tipo ? sql`AND p.tipo_propiedad = ${tipo}` : sql``}
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `,
    getOperationalPropertyCounts(),
  ]);
  const countsByProperty = new Map(
    operationalCounts.map((row) => [row.propertyId, row.contactCount])
  );

  return rows.map((row) => ({
    ...row,
    total_contacts: countsByProperty.get(row.id) ?? 0,
  }));
}

export async function getAdminPropiedadById(id: string) {
  const rows = await sql<AdminPropiedadDetalle[]>`
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
      p.origen_listado,
      p.corredor_colaborador_nombre,
      p.corredor_colaborador_empresa,
      p.corredor_colaborador_contacto,
      p.enlace_original,
      p.permiso_publicar_web,
      p.permiso_usar_fotos,
      p.notas_internas,
      p.configuracion_formulario,
      p.tiene_placas_solares,
      p.cantidad_placas,
      p.placas_en_lease,
      p.open_house_solar_question_enabled,
      p.requiere_precalificacion,
      p.acepta_cdbg,
      p.fecha_showing,
      p.pregunta_personalizada,
      p.formulario_showing_activo,
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
