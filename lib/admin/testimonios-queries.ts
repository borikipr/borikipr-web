import { sql } from "@/lib/db";

export type AdminTestimonioRow = {
  id: string;
  nombre: string;
  texto: string;
  ubicacion: string | null;
  foto_url: string | null;
  tipo: "comprador" | "vendedor";
  activo: boolean;
  destacado: boolean;
  orden: number;
  created_at: string;
};

export type AdminTestimonioDetalle = {
  id: string;
  nombre: string;
  texto: string;
  ubicacion: string | null;
  foto_url: string | null;
  tipo: "comprador" | "vendedor";
  activo: boolean;
  destacado: boolean;
  orden: number;
};

export async function getAdminTestimonios() {
  const rows = await sql<AdminTestimonioRow[]>`
    SELECT
      id,
      nombre,
      texto,
      ubicacion,
      foto_url,
      tipo,
      activo,
      destacado,
      orden,
      created_at
    FROM testimonios
    ORDER BY orden ASC, created_at DESC
  `;

  return rows;
}

export async function getAdminTestimonioById(id: string) {
  const rows = await sql<AdminTestimonioDetalle[]>`
    SELECT
      id,
      nombre,
      texto,
      ubicacion,
      foto_url,
      tipo,
      activo,
      destacado,
      orden
    FROM testimonios
    WHERE id = ${id}
    LIMIT 1
  `;

  return rows[0] ?? null;
}