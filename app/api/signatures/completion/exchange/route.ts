import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isSignerRuntimeEnabled } from "@/lib/signatures/public-config";
import { createSignatureDomainRuntime } from "@/lib/signatures/runtime";
import { COMPLETION_COOKIE_NAME, COMPLETION_COOKIE_PATH, encodeSignerCookie } from "@/lib/signatures/signer/cookie";
import { sameSignerOrigin } from "@/lib/signatures/signer/request";
import { isSignerAccessAuthorized } from "@/lib/signatures/canary-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSignerRuntimeEnabled() || !sameSignerOrigin(request)) return new Response(null, { status: 404 });
  const form = await request.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return new Response(null, { status: 404 });
  try {
    const clientIp = getClientIp(request);
    const limit = await checkRateLimit({ key: `signature_completion_exchange:${clientIp}`, limit: 10, windowMs: 15 * 60_000 });
    if (!limit.allowed) return new Response(null, { status: 404 });
    const runtime=createSignatureDomainRuntime();
    const eligibility=await runtime.domain.inspectCompletionAccessToken(token);
    if(!eligibility.eligible || !await isSignerAccessAuthorized(runtime.database,eligibility)) return new Response(null,{status:404});
    const session = await runtime.domain.redeemCompletionAccessToken({
      plaintextToken: token, idempotencyKey: randomUUID(), networkAddress: clientIp,
      userAgent: request.headers.get("user-agent"),
    });
    const response = NextResponse.redirect(new URL("/firmar/completado/archivos", request.url), 303);
    response.cookies.set(COMPLETION_COOKIE_NAME, encodeSignerCookie(session.sessionId, session.sessionSecret), {
      httpOnly: true, secure: true, sameSite: "strict", path: COMPLETION_COOKIE_PATH, maxAge: 20 * 60,
    });
    return response;
  } catch { return new Response(null, { status: 404 }); }
}
