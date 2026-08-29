import { requireSuperAdmin } from "@/lib/admin/access-context";
import { consumeIsolatedSignatureDelivery } from "@/lib/signatures/isolated-test-sink";
import { createSignatureDeliveryRuntime } from "@/lib/signatures/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function unavailable() {
  return new Response(null, { status: 404, headers: HEADERS });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";
  try {
    const expectedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return Boolean(expectedHost) && new URL(origin).host === expectedHost;
  }
  catch { return false; }
}

export async function POST(request: Request) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.SIGNING_ISOLATED_ENVIRONMENT !== "true" ||
    process.env.SIGNING_ISOLATED_EMAIL_SINK !== "memory" ||
    !sameOrigin(request) ||
    !(await requireSuperAdmin().then(() => true).catch(() => false))
  ) return unavailable();

  const result = await createSignatureDeliveryRuntime().delivery.processPending(1);
  const delivery = consumeIsolatedSignatureDelivery();
  if (!delivery || result.sent !== 1) {
    return Response.json({ ok: false }, { status: 409, headers: HEADERS });
  }
  return Response.json(
    { ok: true, signingUrl: delivery.signingUrl, kind: delivery.kind },
    { headers: HEADERS }
  );
}
