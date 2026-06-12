import { sql } from "@/lib/db";

export type TipoTestimonio = "comprador" | "vendedor";

export type TestimonioPublico = {
  id: string;
  nombre: string;
  lugar: string;
  tipo: TipoTestimonio;
  texto: string;
  imagen: string;
  etiqueta?: string;
  titulo?: string;
  destacado: boolean;
  orden: number;
};

export type TestimoniosPaginados = {
  testimonios: TestimonioPublico[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
};

export async function getTestimoniosPublicos() {
  const rows = await sql<{
    id: string;
    nombre: string;
    texto: string;
    ubicacion: string | null;
    foto_url: string | null;
    activo: boolean;
    destacado: boolean;
    orden: number;
    tipo: TipoTestimonio;
  }[]>`
    SELECT
      id,
      nombre,
      texto,
      ubicacion,
      foto_url,
      activo,
      destacado,
      orden,
      tipo
    FROM testimonios
    WHERE activo = true
    ORDER BY destacado DESC, orden ASC, created_at DESC
  `;

  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    lugar: row.ubicacion || "Puerto Rico",
    tipo: row.tipo,
    texto: row.texto,
    imagen: row.foto_url || "/og-image.jpg",
    etiqueta: row.destacado ? "Testimonio destacado" : "Experiencia real",
    titulo: row.tipo === "comprador" ? "Compra completada" : "Venta completada",
    destacado: row.destacado,
    orden: row.orden,
  })) as TestimonioPublico[];
}

export async function getTestimoniosPublicosPaginados(
  page: number = 1,
  itemsPerPage: number = 8
) {
  const offset = (page - 1) * itemsPerPage;

  const rows = await sql<{
    id: string;
    nombre: string;
    texto: string;
    ubicacion: string | null;
    foto_url: string | null;
    activo: boolean;
    destacado: boolean;
    orden: number;
    tipo: TipoTestimonio;
  }[]>`
    SELECT
      id,
      nombre,
      texto,
      ubicacion,
      foto_url,
      activo,
      destacado,
      orden,
      tipo
    FROM testimonios
    WHERE activo = true
    ORDER BY destacado DESC, orden ASC, created_at DESC
    LIMIT ${itemsPerPage} OFFSET ${offset}
  `;

  const countResult = await sql<{ total: number }[]>`
    SELECT COUNT(*) as total FROM testimonios WHERE activo = true
  `;

  const totalItems = countResult[0]?.total || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const testimonios = rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    lugar: row.ubicacion || "Puerto Rico",
    tipo: row.tipo,
    texto: row.texto,
    imagen: row.foto_url || "/og-image.jpg",
    etiqueta: row.destacado ? "Testimonio destacado" : "Experiencia real",
    titulo: row.tipo === "comprador" ? "Compra completada" : "Venta completada",
    destacado: row.destacado,
    orden: row.orden,
  })) as TestimonioPublico[];

  return {
    testimonios,
    totalPages,
    currentPage: page,
    totalItems,
  };
}
