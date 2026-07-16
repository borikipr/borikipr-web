import { queueCanonicalLeadEmail } from "@/lib/email-queue";
import {
  isPrivateR2Configured,
  uploadFileToR2Key,
} from "@/lib/r2";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import {
  BuyerProfileValidationError,
  parsePropertyBuyerProfileFormData,
} from "./property-buyer-profile";
import {
  persistPropertyBuyerProfile,
  updateBuyerProfileDocumentStatus,
} from "./postgres-property-buyer-profile";
import {
  queueBuyerProfileInternalNotification,
  settleBuyerProfileDocument,
} from "./property-buyer-profile-postcommit";

export async function handlePersistedPropertyBuyerProfile(req: Request) {
  const rateLimit = checkRateLimit({
    key: `perfil-comprador:${getClientIp(req)}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse();
  }

  try {
    const input = parsePropertyBuyerProfileFormData(await req.formData());
    const profile = await persistPropertyBuyerProfile(input);

    const documentState = await settleBuyerProfileDocument({
      profile,
      file: input.file,
      isConfigured: isPrivateR2Configured,
      upload: uploadFileToR2Key,
      updateStatus: updateBuyerProfileDocumentStatus,
      onError: (stage, error) => logBuyerProfileIssue(stage, error),
    });
    const notificationState = await queueBuyerProfileInternalNotification({
      profile,
      documentStatus: documentState,
      recipient:
        process.env.CONTACT_TO_EMAIL?.trim() ||
        "ericksonrealestatepr@gmail.com",
      enqueue: queueCanonicalLeadEmail,
      onError: (stage, error) => logBuyerProfileIssue(stage, error),
    });

    return Response.json({
      ok: true,
      success: true,
      duplicate: !profile.created,
      documentState,
      notificationState,
      warning:
        !["none", "uploaded"].includes(documentState) ||
        notificationState === "failed_to_queue",
    });
  } catch (error) {
    if (error instanceof BuyerProfileValidationError) {
      logBuyerProfileIssue("validation", error, error.reason);
      return Response.json(
        { ok: false, error: error.publicMessage },
        { status: error.status }
      );
    }

    logBuyerProfileIssue("persistence", error);
    return Response.json(
      { ok: false, error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}

function logBuyerProfileIssue(
  stage: string,
  error: unknown,
  reason?: string
) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : undefined;

  console.error("PROPERTY BUYER PROFILE FLOW", {
    stage,
    reason,
    code,
  });
}
