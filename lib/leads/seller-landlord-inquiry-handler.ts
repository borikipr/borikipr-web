import { deliverCanonicalLeadEmail } from "@/lib/email-queue";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { persistSellerLandlordInquiry } from "./postgres-seller-landlord-inquiry";
import {
  parseSellerLandlordInquiryBody,
  SellerLandlordValidationError,
} from "./seller-landlord-inquiry";
import { queueSellerLandlordInternalNotification } from "./seller-landlord-inquiry-postcommit";

export async function handlePersistedSellerLandlordInquiry(req: Request) {
  const rateLimit = await checkRateLimit({
    key: `formulario-vendedor:${getClientIp(req)}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse();
  }

  try {
    const input = parseSellerLandlordInquiryBody(await req.json());
    const inquiry = await persistSellerLandlordInquiry(input);
    const notificationState = await queueSellerLandlordInternalNotification({
      inquiry,
      recipient:
        process.env.CONTACT_TO_EMAIL?.trim() ||
        "ericksonrealestatepr@gmail.com",
      deliver: deliverCanonicalLeadEmail,
      onError: (stage, error) => logSellerLandlordIssue(stage, error),
    });

    return Response.json({
      ok: true,
      success: true,
      duplicate: !inquiry.created,
      notificationState,
      warning: ["failed_to_queue", "permanent_failure"].includes(notificationState),
    });
  } catch (error) {
    if (error instanceof SellerLandlordValidationError) {
      logSellerLandlordIssue("validation", error, error.reason);
      return Response.json(
        { ok: false, error: error.publicMessage },
        { status: error.status }
      );
    }

    logSellerLandlordIssue("persistence", error);
    return Response.json(
      { ok: false, error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}

function logSellerLandlordIssue(
  stage: string,
  error: unknown,
  reason?: string
) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : undefined;

  console.error("SELLER LANDLORD INQUIRY FLOW", {
    stage,
    reason,
    code,
  });
}
