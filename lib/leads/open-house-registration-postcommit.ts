import { buildOpenHouseCustomerEmail } from "./open-house-registration-customer-email";
import { buildOpenHouseInternalEmail } from "./open-house-registration-email";
import type {
  OpenHouseDocumentStatus,
  ParsedOpenHouseRegistration,
} from "./open-house-registration";
import type { PersistedOpenHouseRegistration } from "./postgres-open-house-registration";

type QueueState =
  | "sent"
  | "queued"
  | "already_sent"
  | "already_queued"
  | "pending"
  | "permanent_failure"
  | "failed_to_queue"
  | "not_applicable";
type IssueHandler = (
  stage:
    | "document_upload"
    | "document_status_update"
    | "permanent_send"
    | "queue_insert",
  error: unknown
) => void;

export async function processOpenHousePostCommit({
  registration,
  input,
  isR2Configured,
  upload,
  updateDocumentStatus,
  deliver,
  resolveInternalAttachments,
  internalRecipient,
  onError,
}: {
  registration: PersistedOpenHouseRegistration;
  input: ParsedOpenHouseRegistration;
  isR2Configured: () => boolean;
  upload: (file: File, key: string) => Promise<void>;
  updateDocumentStatus: (
    registrationId: string,
    kind: "prequalification_letter" | "proof_of_funds",
    key: string,
    status: "uploaded" | "failed"
  ) => Promise<boolean>;
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
    attachments?: Array<{ filename: string; content: string; contentType: string }>;
    resolveAttachments?: () => Promise<Array<{
      filename: string;
      content: string;
      contentType: string;
    }> | undefined>;
  }, onError: IssueHandler) => Promise<QueueState>;
  resolveInternalAttachments: () => Promise<
    Array<{ filename: string; content: string; contentType: string }> | undefined
  >;
  internalRecipient: string;
  onError: IssueHandler;
}) {
  const documentState = await settleDocument({
    registration,
    input,
    isR2Configured,
    upload,
    updateDocumentStatus,
    onError,
  });

  const internal = await queueInternal({
    registration,
    documentState,
    recipient: internalRecipient,
    deliver,
    resolveInternalAttachments,
    onError,
  });
  const customer = registration.email
    ? await queueCustomer({ registration, deliver, onError })
    : "not_applicable";

  return {
    documentState,
    notificationState: { internal, customer },
  };
}

async function settleDocument({
  registration,
  input,
  isR2Configured,
  upload,
  updateDocumentStatus,
  onError,
}: {
  registration: PersistedOpenHouseRegistration;
  input: ParsedOpenHouseRegistration;
  isR2Configured: () => boolean;
  upload: (file: File, key: string) => Promise<void>;
  updateDocumentStatus: Parameters<typeof processOpenHousePostCommit>[0]["updateDocumentStatus"];
  onError: IssueHandler;
}): Promise<OpenHouseDocumentStatus> {
  const kind =
    (registration.prequalificationKey
      ? "prequalification_letter"
      : registration.proofOfFundsKey
        ? "proof_of_funds"
        : null) || input.documentKind;
  if (!kind) return "none";
  const key =
    kind === "prequalification_letter"
      ? registration.prequalificationKey
      : registration.proofOfFundsKey;
  const status =
    kind === "prequalification_letter"
      ? registration.prequalificationStatus
      : registration.proofOfFundsStatus;
  if (!key || status !== "pending") return status;

  if (!input.documentFile || !isR2Configured()) {
    return markFailed(registration.id, kind, key, updateDocumentStatus, onError);
  }
  try {
    await upload(input.documentFile, key);
    const updated = await updateDocumentStatus(
      registration.id,
      kind,
      key,
      "uploaded"
    );
    return updated ? "uploaded" : "pending";
  } catch (error) {
    onError("document_upload", error);
    return markFailed(registration.id, kind, key, updateDocumentStatus, onError);
  }
}

async function markFailed(
  registrationId: string,
  kind: "prequalification_letter" | "proof_of_funds",
  key: string,
  update: Parameters<typeof processOpenHousePostCommit>[0]["updateDocumentStatus"],
  onError: IssueHandler
): Promise<"failed"> {
  try {
    await update(registrationId, kind, key, "failed");
  } catch (error) {
    onError("document_status_update", error);
  }
  return "failed";
}

async function queueInternal({
  registration,
  documentState,
  recipient,
  deliver,
  resolveInternalAttachments,
  onError,
}: {
  registration: PersistedOpenHouseRegistration;
  documentState: OpenHouseDocumentStatus;
  recipient: string;
  deliver: Parameters<typeof processOpenHousePostCommit>[0]["deliver"];
  resolveInternalAttachments: Parameters<typeof processOpenHousePostCommit>[0]["resolveInternalAttachments"];
  onError: IssueHandler;
}): Promise<QueueState> {
  try {
    const email = buildOpenHouseInternalEmail({ registration, documentStatus: documentState });
    const isPrivateShowing = registration.workflow === "private_showing";
    if (
      (registration.prequalificationKey || registration.proofOfFundsKey) &&
      documentState !== "uploaded"
    ) {
      throw new Error("Buyer visit document is not durably available for email delivery.");
    }
    return await deliver({
      recipient,
      subject: email.subject,
      html: email.html,
      emailType: isPrivateShowing
        ? "private_showing_registration_internal"
        : "open_house_registration_internal",
      relatedPropertyId: registration.property.id,
      canonicalLeadId: registration.leadId,
      relatedSubmissionType: isPrivateShowing
        ? "private_showing_registration"
        : "open_house_registration",
      relatedSubmissionId: registration.id,
      dedupeKey: `${isPrivateShowing ? "private_showing_registration" : "open_house_registration"}:${registration.id}:internal:v1`,
      resolveAttachments: resolveInternalAttachments,
    }, onError);
  } catch (error) {
    onError("permanent_send", error);
    return "permanent_failure";
  }
}

async function queueCustomer({ registration, deliver, onError }: {
  registration: PersistedOpenHouseRegistration;
  deliver: Parameters<typeof processOpenHousePostCommit>[0]["deliver"];
  onError: IssueHandler;
}): Promise<QueueState> {
  try {
    const email = buildOpenHouseCustomerEmail(registration);
    const isPrivateShowing = registration.workflow === "private_showing";
    return await deliver({
      recipient: registration.email!,
      subject: email.subject,
      html: email.html,
      emailType: isPrivateShowing
        ? "private_showing_registration_customer"
        : "open_house_registration_customer",
      relatedPropertyId: registration.property.id,
      canonicalLeadId: registration.leadId,
      relatedSubmissionType: isPrivateShowing
        ? "private_showing_registration"
        : "open_house_registration",
      relatedSubmissionId: registration.id,
      dedupeKey: `${isPrivateShowing ? "private_showing_registration" : "open_house_registration"}:${registration.id}:customer:v1`,
    }, onError);
  } catch (error) {
    onError("permanent_send", error);
    return "permanent_failure";
  }
}
