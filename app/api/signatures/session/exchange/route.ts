import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isPublicSigningEnabled } from "@/lib/signatures/public-config";
import { createSignatureDomainRuntime } from "@/lib/signatures/runtime";
import {
  encodeSignerCookie,
  SIGNER_COOKIE_NAME,
  SIGNER_COOKIE_PATH,
  SIGNER_CSRF_COOKIE_NAME,
} from "@/lib/signatures/signer/cookie";
import { sameSignerOrigin } from "@/lib/signatures/signer/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isPublicSigningEnabled()) return new Response(null, { status: 404 });
  if (!sameSignerOrigin(request)) return new Response(null, { status: 404 });
  const form = await request.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return new Response(null, { status: 404 });
  try {
    const clientIp = getClientIp(request);
    const limit = await checkRateLimit({ key: `signature_exchange:${clientIp}`, limit: 10, windowMs: 15 * 60_000 });
    if (!limit.allowed) return new Response(null, { status: 404 });
    const session = await createSignatureDomainRuntime().domain.redeemSigningToken({
      plaintextToken: token,
      idempotencyKey: randomUUID(),
      networkAddress: clientIp,
      userAgent: request.headers.get("user-agent"),
    });
    const response = NextResponse.redirect(new URL("/firmar/sesion", request.url), 303);
    response.cookies.set(SIGNER_COOKIE_NAME, encodeSignerCookie(session.sessionId, session.sessionSecret), {
      httpOnly: true, secure: true, sameSite: "strict", path: SIGNER_COOKIE_PATH, maxAge: 20 * 60,
    });
    response.cookies.set(SIGNER_CSRF_COOKIE_NAME, session.csrfNonce, {
      httpOnly: false, secure: true, sameSite: "strict", path: SIGNER_COOKIE_PATH, maxAge: 20 * 60,
    });
    return response;
  } catch {
    return new Response(null, { status: 404 });
  }
}
