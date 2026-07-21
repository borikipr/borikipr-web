import { buildPropertyBuyerProfileInternalEmail } from "./property-buyer-profile-email";
import type {
  BuyerProfileDocumentStatus,
} from "./property-buyer-profile";
import type { PersistedPropertyBuyerProfile } from "./postgres-property-buyer-profile";

export type BuyerProfilePostCommitErrorHandler = (
  stage:
    | "document_upload"
    | "document_status_update"
    | "permanent_send"
    | "queue_insert",
  error: unknown
) => void;

export async function settleBuyerProfileDocument({
  profile,
  file,
  isConfigured,
  upload,
  updateStatus,
  onError,
}: {
  profile: PersistedPropertyBuyerProfile;
  file: File | null;
  isConfigured: () => boolean;
  upload: (file: File, objectKey: string) => Promise<void>;
  updateStatus: (
    profileId: string,
    objectKey: string,
    status: "uploaded" | "failed"
  ) => Promise<boolean>;
  onError: BuyerProfilePostCommitErrorHandler;
}): Promise<BuyerProfileDocumentStatus> {
  if (!profile.documentObjectKey || !profile.documentType) {
    return "none";
  }

  if (profile.documentStatus === "uploaded") {
    return "uploaded";
  }

  const matchesPersistedMetadata =
    file !== null &&
    file.name === profile.documentOriginalName &&
    file.type === profile.documentContentType &&
    file.size === profile.documentSizeBytes;

  if (!matchesPersistedMetadata || !isConfigured()) {
    return markFailed(profile, updateStatus, onError);
  }

  try {
    await upload(file, profile.documentObjectKey);
    const updated = await updateStatus(
      profile.id,
      profile.documentObjectKey,
      "uploaded"
    );
    return updated ? "uploaded" : "pending";
  } catch (error) {
    onError("document_upload", error);
    return markFailed(profile, updateStatus, onError);
  }
}

export async function queueBuyerProfileInternalNotification({
  profile,
  documentStatus,
  recipient,
  deliver,
  resolveAttachments,
  onError,
}: {
  profile: PersistedPropertyBuyerProfile;
  documentStatus: BuyerProfileDocumentStatus;
  recipient: string;
  deliver: (input: {
    recipient: string;
    subject: string;
    html: string;
    emailType: string;
    relatedPropertyId: string;
    canonicalLeadId: string;
    relatedSubmissionType: string;
    relatedSubmissionId: string;
    dedupeKey: string;
    attachments?: Array<{
      filename: string;
      content: string;
      contentType: string;
    }>;
    resolveAttachments?: () => Promise<Array<{
      filename: string;
      content: string;
      contentType: string;
    }> | undefined>;
  }, onError: BuyerProfilePostCommitErrorHandler) => Promise<
    | "sent"
    | "queued"
    | "already_sent"
    | "already_queued"
    | "permanent_failure"
    | "failed_to_queue"
  >;
  resolveAttachments?: () => Promise<Array<{
    filename: string;
    content: string;
    contentType: string;
  }> | undefined>;
  onError: BuyerProfilePostCommitErrorHandler;
}) {
  try {
    const email = buildPropertyBuyerProfileInternalEmail({
      profile,
      documentStatus,
    });
    if (profile.documentObjectKey && documentStatus !== "uploaded") {
      throw new Error(
        "Buyer Profile document is not durably available for email delivery."
      );
    }
    return await deliver({
      recipient,
      subject: email.subject,
      html: email.html,
      emailType: "property_buyer_profile_internal",
      relatedPropertyId: profile.property.id,
      canonicalLeadId: profile.leadId,
      relatedSubmissionType: "property_buyer_profile",
      relatedSubmissionId: profile.id,
      dedupeKey: `property_buyer_profile:${profile.id}:internal:v1`,
      resolveAttachments,
    }, onError);
  } catch (error) {
    onError("permanent_send", error);
    return "permanent_failure" as const;
  }
}

async function markFailed(
  profile: PersistedPropertyBuyerProfile,
  updateStatus: (
    profileId: string,
    objectKey: string,
    status: "uploaded" | "failed"
  ) => Promise<boolean>,
  onError: BuyerProfilePostCommitErrorHandler
): Promise<"failed"> {
  try {
    await updateStatus(profile.id, profile.documentObjectKey!, "failed");
  } catch (error) {
    onError("document_status_update", error);
  }
  return "failed";
}
