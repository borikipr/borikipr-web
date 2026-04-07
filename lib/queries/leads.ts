import { sql } from "@/lib/db";

export async function trackLeadEvent(
  slug: string | null,
  tipo: string,
  rutaOrigen?: string | null
) {
  if (!tipo) return;

  await sql`
    INSERT INTO lead_events (propiedad_slug, tipo_evento, ruta_origen)
    VALUES (${slug ?? null}, ${tipo}, ${rutaOrigen ?? null})
  `;
}