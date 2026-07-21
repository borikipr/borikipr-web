import { buildSellerLandlordInternalEmail } from "./seller-landlord-inquiry-email";
import type { PersistedSellerLandlordInquiry } from "./postgres-seller-landlord-inquiry";

export async function queueSellerLandlordInternalNotification({
  inquiry,
  recipient,
  deliver,
  onError,
}: {
  inquiry: PersistedSellerLandlordInquiry;
  recipient: string;
  deliver: (input: {
    recipient: string;
    subject: string;
    html: string;
    emailType: string;
    canonicalLeadId: string;
    relatedSubmissionType: string;
    relatedSubmissionId: string;
    dedupeKey: string;
  }, onError: (stage: "permanent_send" | "queue_insert", error: unknown) => void) => Promise<
    | "sent"
    | "queued"
    | "already_sent"
    | "already_queued"
    | "permanent_failure"
    | "failed_to_queue"
  >;
  onError: (stage: "permanent_send" | "queue_insert", error: unknown) => void;
}) {
  try {
    const email = buildSellerLandlordInternalEmail(inquiry);
    return await deliver({
      recipient,
      subject: email.subject,
      html: email.html,
      emailType: "seller_landlord_inquiry_internal",
      canonicalLeadId: inquiry.leadId,
      relatedSubmissionType: "seller_landlord_inquiry",
      relatedSubmissionId: inquiry.id,
      dedupeKey: `seller_landlord_inquiry:${inquiry.id}:internal:v1`,
    }, onError);
  } catch (error) {
    onError("permanent_send", error);
    return "permanent_failure" as const;
  }
}
