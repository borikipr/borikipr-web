import {
  sanitizeAttachmentFilename,
  type EmailAttachment,
} from "./property-buyer-profile-queue-attachment";

export const OPEN_HOUSE_SUBMISSION_TYPE = "open_house_registration";
export const PRIVATE_SHOWING_SUBMISSION_TYPE = "private_showing_registration";

export type OpenHouseAttachmentMetadata = {
  objectKey: string | null;
  originalName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  status: string;
};

export async function resolveOpenHouseInternalAttachment({
  emailType,
  relatedSubmissionType,
  relatedSubmissionId,
  loadMetadata,
  download,
}: {
  emailType: string;
  relatedSubmissionType: string | null;
  relatedSubmissionId: string | null;
  loadMetadata: (
    submissionId: string
  ) => Promise<OpenHouseAttachmentMetadata | null>;
  download: (
    objectKey: string
  ) => Promise<{ bytes: Uint8Array; contentType: string | null }>;
}): Promise<EmailAttachment[] | undefined> {
  if (
    !(
      (emailType === "open_house_registration_internal" &&
        relatedSubmissionType === OPEN_HOUSE_SUBMISSION_TYPE) ||
      (emailType === "private_showing_registration_internal" &&
        relatedSubmissionType === PRIVATE_SHOWING_SUBMISSION_TYPE)
    ) ||
    !relatedSubmissionId
  ) {
    return undefined;
  }

  const metadata = await loadMetadata(relatedSubmissionId);
  if (!metadata) throw new Error("Open House submission metadata is missing.");
  if (metadata.status === "none") return undefined;
  if (
    metadata.status !== "uploaded" ||
    !metadata.objectKey ||
    !metadata.originalName ||
    !metadata.contentType ||
    metadata.sizeBytes === null
  ) {
    throw new Error("Open House attachment metadata is invalid or incomplete.");
  }
  const object = await download(metadata.objectKey);
  if (object.bytes.byteLength !== metadata.sizeBytes) {
    throw new Error("Open House document size does not match persisted metadata.");
  }
  return [{
    filename: sanitizeAttachmentFilename(metadata.originalName),
    content: Buffer.from(object.bytes).toString("base64"),
    contentType: metadata.contentType,
  }];
}
