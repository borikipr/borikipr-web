import { buildSellerLandlordInternalEmail } from "./seller-landlord-inquiry-email";
import type { PersistedSellerLandlordInquiry } from "./postgres-seller-landlord-inquiry";

export async function queueSellerLandlordInternalNotification({
  inquiry,
  recipient,
  enqueue,
  onError,
}: {
  inquiry: PersistedSellerLandlordInquiry;
  recipient: string;
  enqueue: (input: {
    recipient: string;
    subject: string;
    html: string;
    emailType: string;
    canonicalLeadId: string;
    relatedSubmissionType: string;
    relatedSubmissionId: string;
    dedupeKey: string;
  }) => Promise<unknown>;
  onError: (stage: "queue_insert", error: unknown) => void;
}) {
  try {
    const email = buildSellerLandlordInternalEmail(inquiry);
    await enqueue({
      recipient,
      subject: email.subject,
      html: email.html,
      emailType: "seller_landlord_inquiry_internal",
      canonicalLeadId: inquiry.leadId,
      relatedSubmissionType: "seller_landlord_inquiry",
      relatedSubmissionId: inquiry.id,
      dedupeKey: `seller_landlord_inquiry:${inquiry.id}:internal:v1`,
    });
    return "queued" as const;
  } catch (error) {
    onError("queue_insert", error);
    return "failed_to_queue" as const;
  }
}
