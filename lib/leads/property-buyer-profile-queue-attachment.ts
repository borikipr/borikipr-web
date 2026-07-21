export const PROPERTY_BUYER_PROFILE_SUBMISSION_TYPE =
  "property_buyer_profile";

export type BuyerProfileAttachmentMetadata = {
  objectKey: string | null;
  originalName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  status: string;
};

export type EmailAttachment = {
  filename: string;
  content: string;
  contentType: string;
};

export async function resolvePropertyBuyerProfileAttachment({
  emailType,
  relatedSubmissionType,
  relatedSubmissionId,
  loadMetadata,
  download,
}: {
  emailType?: string;
  relatedSubmissionType: string | null;
  relatedSubmissionId: string | null;
  loadMetadata: (
    submissionId: string
  ) => Promise<BuyerProfileAttachmentMetadata | null>;
  download: (
    objectKey: string
  ) => Promise<{ bytes: Uint8Array; contentType: string | null }>;
}): Promise<EmailAttachment[] | undefined> {
  if (
    (emailType && ![
      "property_buyer_profile_internal",
      "property_buyer_profile_internal_correction",
    ].includes(emailType)) ||
    relatedSubmissionType !== PROPERTY_BUYER_PROFILE_SUBMISSION_TYPE ||
    !relatedSubmissionId
  ) {
    return undefined;
  }

  const metadata = await loadMetadata(relatedSubmissionId);
  if (!metadata) throw new Error("Buyer Profile submission metadata is missing.");
  if (metadata.status === "none") return undefined;
  if (
    metadata.status !== "uploaded" ||
    !metadata.objectKey ||
    !metadata.originalName ||
    !metadata.contentType ||
    metadata.sizeBytes === null
  ) {
    throw new Error("Buyer Profile attachment metadata is invalid or incomplete.");
  }

  const object = await download(metadata.objectKey);
  if (object.bytes.byteLength !== metadata.sizeBytes) {
    throw new Error("Private document size does not match persisted metadata.");
  }

  return [
    {
      filename: sanitizeAttachmentFilename(metadata.originalName),
      content: Buffer.from(object.bytes).toString("base64"),
      contentType: metadata.contentType,
    },
  ];
}

export function sanitizeAttachmentFilename(originalName: string) {
  const lastSegment = originalName.split(/[\\/]/).pop() || "documento";
  const cleaned = lastSegment
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255);
  return cleaned || "documento";
}
