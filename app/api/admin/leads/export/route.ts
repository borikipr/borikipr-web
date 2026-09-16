import { AdminAccessError, requireModuleAccess } from "@/lib/admin/access-context";
import { getOperationalExportRows } from "@/lib/admin/queries/leads-export";
import { generateLeadsCsv, LeadsExportLimitError } from "@/lib/admin/leads-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  try {
    await requireModuleAccess("leads", "view");
    const search = new URL(request.url).searchParams;
    const allowed = new Set(["q", "status", "source", "property", "range", "sort", "page", "individuals"]);
    if ([...search.keys()].some((key) => !allowed.has(key))) return Response.json({ error: "Filtros inválidos." }, { status: 400, headers });
    if ([...search.keys()].some((key) => search.getAll(key).length > 1)) return Response.json({ error: "Filtros inválidos." }, { status: 400, headers });
    const rows = await getOperationalExportRows(Object.fromEntries(search));
    const csv = generateLeadsCsv(rows);
    return new Response(csv, { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="boriki-leads-${new Date().toISOString().slice(0, 10)}.csv"` } });
  } catch (error) {
    if (error instanceof AdminAccessError) return Response.json({ error: error.code === "unauthenticated" ? "Inicia sesión para exportar." : "No tienes acceso a Leads." }, { status: error.code === "unauthenticated" ? 401 : 403, headers });
    if (error instanceof LeadsExportLimitError) return Response.json({ error: error.message }, { status: 413, headers });
    if (error instanceof Error && error.message === "invalid_filters") return Response.json({ error: "Filtros inválidos. Revisa el directorio e intenta nuevamente." }, { status: 400, headers });
    return Response.json({ error: "No se pudo generar el archivo. Intenta nuevamente." }, { status: 500, headers });
  }
}
