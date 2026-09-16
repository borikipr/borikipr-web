import "server-only";

import { sql } from "@/lib/db";
import type { PropertyPerformanceMetadata } from "./property-performance";

type PropertyMetadataRow = {
  slug: string;
  titulo: string;
  estado: string;
  municipio: string;
};

export async function getPropertyPerformanceMetadata(): Promise<
  PropertyPerformanceMetadata[]
> {
  const rows = await sql<PropertyMetadataRow[]>`
    SELECT slug, titulo, estado, municipio
    FROM propiedades
    ORDER BY titulo ASC
  `;

  return rows.map((row) => ({
    slug: row.slug,
    title: row.titulo,
    status: row.estado,
    municipality: row.municipio,
  }));
}
