import { getAdminSession } from "@/lib/admin/auth";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import {
  SignatureDraftValidationError,
} from "@/lib/signatures/draft-application";
import { createSignatureDraftRuntime } from "@/lib/signatures/runtime";
import { MAX_SIGNATURE_SOURCE_BYTES } from "@/lib/signatures/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function response(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status, headers: HEADERS });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function message(code: string) {
  const messages: Record<string, string> = {
    invalid_mime: "Selecciona un archivo PDF válido.",
    oversized_pdf: "El PDF excede el límite de 3 MB.",
    malformed_pdf: "El PDF está dañado o no puede verificarse.",
    encrypted_pdf: "Los PDF cifrados no son compatibles.",
    excessive_page_count: "El PDF excede el límite de 25 páginas.",
    xfa_not_supported: "Los formularios XFA no son compatibles.",
    embedded_files_not_supported: "El PDF contiene archivos adjuntos no permitidos.",
    javascript_not_supported: "El PDF contiene JavaScript no permitido.",
    actions_not_supported: "El PDF contiene acciones no permitidas.",
    existing_signature_not_supported: "El PDF ya contiene una firma digital.",
    signature_title_invalid: "Escribe un título válido.",
    signature_document_type_unknown: "Selecciona un tipo de documento válido.",
    signature_source_filename_invalid: "El nombre del archivo PDF no es válido.",
    signature_link_id_invalid: "El enlace opcional seleccionado no es válido.",
  };
  return messages[code] ?? "No se pudo crear el borrador de firma.";
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return response({ ok: false }, 401);
  if (!sameOrigin(request)) return response({ ok: false }, 403);

  const rateLimit = await checkRateLimit({
    key: `signature_upload:${session.id}:${getClientIp(request)}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) return rateLimitResponse();

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("sourcePdf");
  if (!(file instanceof File) || file.size < 1) {
    return response({ ok: false, error: "Selecciona un archivo PDF." }, 400);
  }
  if (file.size > MAX_SIGNATURE_SOURCE_BYTES) {
    return response({ ok: false, error: "El PDF excede el límite de 3 MB." }, 413);
  }

  try {
    const runtime = createSignatureDraftRuntime();
    const created = await runtime.drafts.createDraft({
      title: String(formData?.get("title") ?? ""),
      documentType: String(formData?.get("documentType") ?? ""),
      createdByAdminId: session.id,
      canonicalLeadId: String(formData?.get("canonicalLeadId") ?? "") || null,
      leadGroupId: String(formData?.get("leadGroupId") ?? "") || null,
      filename: file.name,
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return response(
      {
        ok: true,
        documentId: created.documentId,
        compatibility: created.compatibility,
      },
      201
    );
  } catch (error) {
    if (error instanceof SignatureDraftValidationError) {
      return response({ ok: false, error: message(error.code) }, 400);
    }
    return response({ ok: false, error: "No se pudo crear el borrador." }, 500);
  }
}
