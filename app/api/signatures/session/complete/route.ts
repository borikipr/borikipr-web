import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isSignerRuntimeEnabled } from "@/lib/signatures/public-config";
import { requireSignerRequestContext, sameSignerOrigin } from "@/lib/signatures/signer/request";
import { SIGNER_COOKIE_NAME, SIGNER_COOKIE_PATH, SIGNER_CSRF_COOKIE_NAME } from "@/lib/signatures/signer/cookie";

export async function POST(request: Request) {
  if (!isSignerRuntimeEnabled() || !sameSignerOrigin(request)) return new Response(null, { status: 404 });
  const form = await request.formData().catch(() => null);
  const csrfNonce = String(form?.get("csrf") ?? "");
  try {
    const signer = await requireSignerRequestContext({ csrfNonce });
    const result = await signer.runtime.domain.completeSignerParticipant({
      sessionId: signer.sessionId, sessionSecret: signer.sessionSecret, csrfNonce,
      idempotencyKey: randomUUID(),
    });
    // Finalization is invoked only after every participant has completed.
    if (result.allParticipantsCompleted) {
      const { finalizeCompletedSignatureDocument } = await import("@/lib/signatures/signer/finalize");
      await finalizeCompletedSignatureDocument(result.documentId);
    } else {
      const { createSignatureDeliveryRuntime } = await import("@/lib/signatures/runtime");
      await createSignatureDeliveryRuntime().delivery.releaseNextRoutingGroup({
        documentVersionId:result.documentVersionId,locale:"es-PR",
      });
    }
    const response = request.headers.get("accept")?.includes("application/json")
      ? new NextResponse(null, { status: 204 })
      : NextResponse.redirect(new URL(`/firmar/completado?document=${result.allParticipantsCompleted?"completed":"continuing"}`, request.url), 303);
    response.cookies.set(SIGNER_COOKIE_NAME, "", { path: SIGNER_COOKIE_PATH, maxAge: 0 });
    response.cookies.set(SIGNER_CSRF_COOKIE_NAME, "", { path: SIGNER_COOKIE_PATH, maxAge: 0 });
    return response;
  } catch { return new Response(null, { status: 400 }); }
}
