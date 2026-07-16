import { queueCanonicalLeadEmail } from "@/lib/email-queue";
import { isPrivateR2Configured, uploadFileToR2Key } from "@/lib/r2";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import {
  OpenHouseValidationError,
  parseOpenHouseRegistrationFormData,
} from "./open-house-registration";
import { processOpenHousePostCommit } from "./open-house-registration-postcommit";
import {
  persistOpenHouseRegistration,
  updateOpenHouseDocumentStatus,
} from "./postgres-open-house-registration";

export async function handleOpenHouseRegistrationV2(request: Request) {
  const rateLimit = checkRateLimit({
    key: `consultas-propiedad:${getClientIp(request)}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.allowed) return rateLimitResponse();

  try {
    const input = parseOpenHouseRegistrationFormData(await request.formData());
    const registration = await persistOpenHouseRegistration(input);
    const postCommit = await processOpenHousePostCommit({
      registration,
      input,
      isR2Configured: isPrivateR2Configured,
      upload: uploadFileToR2Key,
      updateDocumentStatus: updateOpenHouseDocumentStatus,
      enqueue: queueCanonicalLeadEmail,
      internalRecipient:
        process.env.CONTACT_TO_EMAIL?.trim() ||
        "ericksonrealestatepr@gmail.com",
      onError: (stage, error) => logOpenHouseIssue(stage, error),
    });

    return Response.json({
      ok: true,
      success: true,
      duplicate: !registration.created,
      documentState: postCommit.documentState,
      notificationState: postCommit.notificationState,
      warning:
        postCommit.documentState === "failed" ||
        Object.values(postCommit.notificationState).includes("failed_to_queue"),
    });
  } catch (error) {
    if (error instanceof OpenHouseValidationError) {
      logOpenHouseIssue("validation", error, error.reason);
      return Response.json(
        { ok: false, error: error.publicMessage },
        { status: error.status }
      );
    }
    logOpenHouseIssue("persistence", error);
    return Response.json(
      { ok: false, error: "No se pudo guardar el registro." },
      { status: 500 }
    );
  }
}

function logOpenHouseIssue(stage: string, error: unknown, reason?: string) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : undefined;
  console.error("OPEN HOUSE REGISTRATION V2", { stage, reason, code });
}
