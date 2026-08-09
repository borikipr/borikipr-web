import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getCompletedArtifactDescriptor, safeCompletedFilename } from "@/lib/signatures/completed-access";
import { isPublicSigningEnabled } from "@/lib/signatures/public-config";
import { createSignatureRuntime } from "@/lib/signatures/runtime";
import { COMPLETION_COOKIE_NAME, parseSignerCookie } from "@/lib/signatures/signer/cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  if (!isPublicSigningEnabled()) return new Response(null, { status: 404 });
  const { kind } = await params;
  if (kind !== "document" && kind !== "certificate") return new Response(null, { status: 404 });
  const parsed = parseSignerCookie((await cookies()).get(COMPLETION_COOKIE_NAME)?.value);
  if (!parsed) return new Response(null, { status: 404 });
  try {
    const runtime = createSignatureRuntime();
    const context = await runtime.domain.getSessionContext({ ...parsed, purpose: "completed_document_access", touch: true });
    const descriptor = await getCompletedArtifactDescriptor({ database: runtime.database,
      documentVersionId: context.documentVersionId, participantId: context.participantId, kind });
    if (!descriptor) return new Response(null, { status: 404 });
    const bytes = kind === "document" ? await runtime.storage.getFinal(descriptor) : await runtime.storage.getCertificate(descriptor);
    await runtime.domain.appendEvent({ documentId: descriptor.documentId,
      documentVersionId: context.documentVersionId, participantId: context.participantId,
      sessionId: parsed.sessionId, eventType: kind === "document" ? "completed_document_accessed" : "certificate_accessed",
      actorClass: "participant", versionHash: descriptor.sourceSha256,
      controlledMetadata: { access_type: kind }, idempotencyKey: randomUUID() });
    return new Response(Buffer.from(bytes), { headers: {
      "Content-Type": "application/pdf", "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeCompletedFilename(descriptor.filename))}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer",
    }});
  } catch { return new Response(null, { status: 404 }); }
}
