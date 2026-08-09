import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isPublicSigningEnabled } from "@/lib/signatures/public-config";
import { requireSignerRequestContext, sameSignerOrigin } from "@/lib/signatures/signer/request";
import {
  SIGNATURE_PROTOTYPE_CONSENT_SHA256,
  SIGNATURE_PROTOTYPE_CONSENT_VERSION,
} from "@/lib/signatures/signer/consent";

export async function POST(request: Request) {
  if (!isPublicSigningEnabled() || !sameSignerOrigin(request)) return new Response(null, { status: 404 });
  const form = await request.formData().catch(() => null);
  const csrfNonce = String(form?.get("csrf") ?? "");
  if (String(form?.get("consentVersion") ?? "") !== SIGNATURE_PROTOTYPE_CONSENT_VERSION) return new Response(null, { status: 400 });
  try {
    const signer = await requireSignerRequestContext({ csrfNonce });
    await signer.runtime.domain.acceptSignerConsent({
      sessionId: signer.sessionId, sessionSecret: signer.sessionSecret, csrfNonce,
      consentVersion: SIGNATURE_PROTOTYPE_CONSENT_VERSION,
      consentTextSha256: SIGNATURE_PROTOTYPE_CONSENT_SHA256,
      locale: "es-PR", idempotencyKey: randomUUID(),
    });
    return NextResponse.redirect(new URL("/firmar/sesion", request.url), 303);
  } catch { return new Response(null, { status: 404 }); }
}
