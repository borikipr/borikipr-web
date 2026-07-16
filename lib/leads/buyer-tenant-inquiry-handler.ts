import { queueCanonicalLeadEmail } from "@/lib/email-queue";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import {
  BuyerTenantValidationError,
  parseBuyerTenantInquiryBody,
} from "./buyer-tenant-inquiry";
import { queueBuyerTenantInternalNotification } from "./buyer-tenant-inquiry-postcommit";
import { persistBuyerTenantInquiry } from "./postgres-buyer-tenant-inquiry";

export async function handlePersistedBuyerTenantInquiry(req: Request) {
  const rateLimit = checkRateLimit({
    key: `formulario-comprador:${getClientIp(req)}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) return rateLimitResponse();

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch (error) {
      logBuyerTenantIssue("validation", error, "invalid_json");
      return Response.json(
        { ok: false, error: "No pudimos validar este envío. Intenta nuevamente." },
        { status: 400 }
      );
    }

    const input = parseBuyerTenantInquiryBody(body);
    const inquiry = await persistBuyerTenantInquiry(input);
    const notificationState = await queueBuyerTenantInternalNotification({
      inquiry,
      recipient:
        process.env.CONTACT_TO_EMAIL?.trim() ||
        "ericksonrealestatepr@gmail.com",
      enqueue: queueCanonicalLeadEmail,
      onError: (stage, error) => logBuyerTenantIssue(stage, error),
    });

    return Response.json({
      ok: true,
      success: true,
      duplicate: !inquiry.created,
      notificationState,
      warning: notificationState === "failed_to_queue",
    });
  } catch (error) {
    if (error instanceof BuyerTenantValidationError) {
      logBuyerTenantIssue("validation", error, error.reason);
      return Response.json(
        { ok: false, error: error.publicMessage },
        { status: error.status }
      );
    }

    logBuyerTenantIssue("persistence", error);
    return Response.json(
      { ok: false, error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}

function logBuyerTenantIssue(stage: string, error: unknown, reason?: string) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : undefined;

  console.error("BUYER TENANT INQUIRY FLOW", { stage, reason, code });
}
