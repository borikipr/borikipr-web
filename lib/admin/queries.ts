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

export async function getAdminPropiedades() {
  const rows = await sql<AdminPropiedadRow[]>`
    SELECT
      id,
      slug,
      titulo,
      municipio,
      precio,
      tipo_negocio,
      tipo_propiedad,
      estado,
      destacado,
      created_at
    FROM propiedades
    ORDER BY created_at DESC
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