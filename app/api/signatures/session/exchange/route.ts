import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isSignerRuntimeEnabled } from "@/lib/signatures/public-config";
import { createSignatureDomainRuntime } from "@/lib/signatures/runtime";
import { isSignerAccessAuthorized } from "@/lib/signatures/canary-gate";
import {
  encodeSignerCookie,
  SIGNER_COOKIE_NAME,
  SIGNER_COOKIE_PATH,
  SIGNER_CSRF_COOKIE_NAME,
} from "@/lib/signatures/signer/cookie";
import {
  isIsolatedLocalSignerRequest,
  sameSignerExchangeOrigin,
} from "@/lib/signatures/signer/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const isolatedLocalDevelopment = isIsolatedLocalSignerRequest(request);
  if (!isSignerRuntimeEnabled()) return new Response(null, { status: 404 });
  if (!sameSignerExchangeOrigin(request)) return new Response(null, { status: 404 });
  const form = await request.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return new Response(null, { status: 404 });
  try {
    const clientIp = getClientIp(request);
    const limit = await checkRateLimit({ key: `signature_exchange:${clientIp}`, limit: 10, windowMs: 15 * 60_000 });
    if (!limit.allowed) return new Response(null, { status: 404 });
    const runtime = createSignatureDomainRuntime();
    const eligibility = await runtime.domain.inspectSigningToken(token);
    if (!eligibility.eligible) {
      const reason = await runtime.domain.inspectSigningTokenUnavailableReason(token);
      if (reason === "invalid" || !request.headers.get("accept")?.includes("application/json")) return new Response(null,{status:404});
      return NextResponse.json({ reason }, { status:410, headers:{"Cache-Control":"private, no-store"} });
    }
    if (!await isSignerAccessAuthorized(runtime.database, eligibility)) return new Response(null,{status:404});
    const session = await runtime.domain.redeemSigningToken({
      plaintextToken: token,
      idempotencyKey: randomUUID(),
      networkAddress: clientIp,
      userAgent: request.headers.get("user-agent"),
    });
    const response = request.headers.get("accept")?.includes("application/json")
      ? new NextResponse(null, { status: 204 })
      : NextResponse.redirect(new URL("/firmar/sesion", request.url), 303);
    // Remove cookies issued by the earlier /firmar-only scope before writing
    // the session cookie shared by signer pages and mutation routes.
    response.cookies.set(SIGNER_COOKIE_NAME, "", { path: "/firmar", maxAge: 0 });
    response.cookies.set(SIGNER_CSRF_COOKIE_NAME, "", { path: "/firmar", maxAge: 0 });
    response.cookies.set(SIGNER_COOKIE_NAME, encodeSignerCookie(session.sessionId, session.sessionSecret), {
      httpOnly: true, secure: !isolatedLocalDevelopment, sameSite: "strict", path: SIGNER_COOKIE_PATH, maxAge: 20 * 60,
    });
    response.cookies.set(SIGNER_CSRF_COOKIE_NAME, session.csrfNonce, {
      httpOnly: false, secure: !isolatedLocalDevelopment, sameSite: "strict", path: SIGNER_COOKIE_PATH, maxAge: 20 * 60,
    });
    return response;
  } catch {
    return new Response(null, { status: 404 });
  }
}
