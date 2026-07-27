import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { findReusableFinancialDocument } from "@/lib/leads/financial-document-reuse";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit({
    key: `open-house-document-status:${getClientIp(request)}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.allowed) return rateLimitResponse();

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const document = await findReusableFinancialDocument({
      name: text(body.name),
      email: text(body.email) || null,
      phone: text(body.phone),
      purchaseMethod: text(body.purchaseMethod),
    });
    return Response.json({
      ok: true,
      reusable: Boolean(document),
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : undefined;
    console.error("OPEN HOUSE DOCUMENT STATUS", { code });
    return Response.json(
      { ok: false, reusable: false },
      { status: 503 }
    );
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
