import { randomUUID } from "node:crypto";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { requireModuleAccess } from "@/lib/admin/access-context";
import {
  buildContentDisposition,
  resolveLeadDocument,
  type LeadDocumentSource,
} from "@/lib/admin/queries/lead-documents";
import { sql } from "@/lib/db";
import {
  PrivateR2ObjectNotFoundError,
  downloadPrivateR2Object,
  inspectPrivateR2Object,
} from "@/lib/r2";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCES = new Set<LeadDocumentSource>([
  "property_buyer_profile",
  "open_house_registration",
  "private_showing_registration",
]);

const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function errorResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { ...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; source: string; documentId: string }> }
) {
  const username = await getAdminSessionUser();
  if (!username) return errorResponse("No autorizado.", 401);
  try { await requireModuleAccess("leads", "view"); }
  catch { return errorResponse("Documento no encontrado.", 404); }

  const { id: leadId, source: rawSource, documentId } = await context.params;
  if (!UUID_PATTERN.test(leadId) || !UUID_PATTERN.test(documentId) || !SOURCES.has(rawSource as LeadDocumentSource)) {
    return errorResponse("Documento no encontrado.", 404);
  }
  const source = rawSource as LeadDocumentSource;
  const document = await resolveLeadDocument(leadId, source, documentId);
  if (!document) return errorResponse("Documento no encontrado.", 404);
  if (document.state === "pending") return errorResponse("La carga del documento está pendiente.", 409);
  if (document.state === "failed") return errorResponse("No se pudo completar la carga del documento.", 410);
  if (document.state !== "available" || !document.objectKey || !document.originalName || !document.contentType) {
    return errorResponse("Los metadatos del documento están incompletos.", 409);
  }

  try {
    const object = await inspectPrivateR2Object(document.objectKey);
    if (!object.exists) return errorResponse("El archivo ya no está disponible.", 404);
    if (
      (object.contentLength !== null && document.sizeBytes !== null && object.contentLength !== document.sizeBytes) ||
      (object.contentType && object.contentType !== document.contentType)
    ) return errorResponse("Los metadatos del archivo no coinciden.", 409);

    const downloaded = await downloadPrivateR2Object(document.objectKey);
    if (document.sizeBytes !== null && downloaded.bytes.byteLength !== document.sizeBytes) {
      return errorResponse("El archivo no pudo verificarse.", 409);
    }

    const requestedMode = new URL(request.url).searchParams.get("mode");
    const inline = requestedMode === "preview" && document.previewable;
    const responseType = document.previewable ? document.contentType : "application/octet-stream";

    await sql.begin(async (transaction) => {
      await transaction.unsafe(
        `INSERT INTO public.lead_management_events (
          lead_id, event_type, event_data, actor_username, idempotency_key
        ) VALUES (
          $1::uuid, 'document_accessed',
          jsonb_build_object(
            'sourceInteractionType', $2::text,
            'sourceInteractionId', $3::uuid,
            'documentCategory', $4::text
          ),
          $5, $6::uuid
        )`,
        [leadId, document.source, document.submissionId, document.category, username, randomUUID()]
      );
    });

    return new Response(Buffer.from(downloaded.bytes), {
      headers: {
        ...SECURITY_HEADERS,
        "Content-Disposition": buildContentDisposition(document.originalName, inline),
        "Content-Length": String(downloaded.bytes.byteLength),
        "Content-Type": responseType,
      },
    });
  } catch (error) {
    if (error instanceof PrivateR2ObjectNotFoundError) {
      return errorResponse("El archivo ya no está disponible.", 404);
    }
    return errorResponse("No se pudo recuperar el documento.", 502);
  }
}
