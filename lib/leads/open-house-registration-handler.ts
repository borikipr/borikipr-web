import { deliverCanonicalLeadEmail } from "@/lib/email-queue";
import { downloadPrivateR2Object, isPrivateR2Configured, uploadFileToR2Key } from "@/lib/r2";
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
import { resolveOpenHouseInternalAttachment } from "./open-house-registration-queue-attachment";
import { findReusableFinancialDocument } from "./financial-document-reuse";

export async function handleOpenHouseRegistrationV2(request: Request) {
  const rateLimit = checkRateLimit({
    key: `consultas-propiedad:${getClientIp(request)}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.allowed) return rateLimitResponse();

  try {
    const input = parseOpenHouseRegistrationFormData(await request.formData());
    const reusableDocument = input.documentFile
      ? null
      : await findReusableFinancialDocument({
          name: input.name,
          email: input.email,
          phone: input.phone,
          purchaseMethod: input.purchaseMethod,
        }).catch((error) => {
          logOpenHouseIssue("document_reuse_lookup", error);
          return null;
        });
    const registration = await persistOpenHouseRegistration(input, {
      reusableDocument,
    });
    const postCommit = await processOpenHousePostCommit({
      registration,
      input,
      isR2Configured: isPrivateR2Configured,
      upload: uploadFileToR2Key,
      updateDocumentStatus: updateOpenHouseDocumentStatus,
      deliver: deliverCanonicalLeadEmail,
      resolveInternalAttachments: () =>
        resolveOpenHouseInternalAttachment({
          emailType: "open_house_registration_internal",
          relatedSubmissionType: "open_house_registration",
          relatedSubmissionId: registration.id,
          loadMetadata: async () => {
            const objectKey =
              registration.prequalificationKey || registration.proofOfFundsKey;
            const status = registration.prequalificationKey
              ? postUploadStatus(registration.prequalificationStatus)
              : postUploadStatus(registration.proofOfFundsStatus);
            return {
              objectKey,
              originalName: registration.documentOriginalName,
              contentType: registration.documentContentType,
              sizeBytes: registration.documentSizeBytes,
              status,
            };
          },
          download: downloadPrivateR2Object,
        }),
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
        Object.values(postCommit.notificationState).some((state) =>
          ["failed_to_queue", "permanent_failure"].includes(state)
        ),
      documentReused: Boolean(registration.reusedPropertyBuyerProfileId),
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

function postUploadStatus(status: string) {
  return status === "pending" ? "uploaded" : status;
}

function logOpenHouseIssue(stage: string, error: unknown, reason?: string) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : undefined;
  console.error("OPEN HOUSE REGISTRATION V2", { stage, reason, code });
}
