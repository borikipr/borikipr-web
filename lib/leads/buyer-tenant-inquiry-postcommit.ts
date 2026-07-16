import { buildBuyerTenantInternalEmail } from "./buyer-tenant-inquiry-email";
import type { PersistedBuyerTenantInquiry } from "./postgres-buyer-tenant-inquiry";

export async function queueBuyerTenantInternalNotification({
  inquiry,
  recipient,
  enqueue,
  onError,
}: {
  inquiry: PersistedBuyerTenantInquiry;
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
    const email = buildBuyerTenantInternalEmail(inquiry);
    await enqueue({
      recipient,
      subject: email.subject,
      html: email.html,
      emailType: "buyer_tenant_inquiry_internal",
      canonicalLeadId: inquiry.leadId,
      relatedSubmissionType: "buyer_tenant_inquiry",
      relatedSubmissionId: inquiry.id,
      dedupeKey: `buyer_tenant_inquiry:${inquiry.id}:internal:v1`,
    });
    return "queued" as const;
  } catch (error) {
    onError("queue_insert", error);
    return "failed_to_queue" as const;
  }
}
