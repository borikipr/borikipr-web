import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isSignerRuntimeEnabled } from "@/lib/signatures/public-config";
import { requireSignerRequestContext, sameSignerOrigin } from "@/lib/signatures/signer/request";

export async function POST(request: Request) {
  if (!isSignerRuntimeEnabled() || !sameSignerOrigin(request)) return new Response(null, { status: 404 });
  const form = await request.formData().catch(() => null);
  const csrfNonce = String(form?.get("csrf") ?? "");
  try {
    const signer = await requireSignerRequestContext({ csrfNonce });
    const context = signer.context;
    if (!context.consentVersion || !context.consentTextSha256 || !context.consentLocale) return new Response(null, { status: 400 });
    await signer.runtime.domain.acceptSignerConsent({
      sessionId: signer.sessionId, sessionSecret: signer.sessionSecret, csrfNonce,
      consentVersion: context.consentVersion,
      consentTextSha256: context.consentTextSha256,
      locale: context.consentLocale, idempotencyKey: randomUUID(),
    });
    return NextResponse.redirect(new URL("/firmar/sesion", request.url), 303);
  } catch { return new Response(null, { status: 404 }); }
}
