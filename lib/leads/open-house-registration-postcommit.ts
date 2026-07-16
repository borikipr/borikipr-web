import { buildOpenHouseCustomerEmail } from "./open-house-registration-customer-email";
import { buildOpenHouseInternalEmail } from "./open-house-registration-email";
import type {
  OpenHouseDocumentStatus,
  ParsedOpenHouseRegistration,
} from "./open-house-registration";
import type { PersistedOpenHouseRegistration } from "./postgres-open-house-registration";

type QueueState = "queued" | "pending" | "failed_to_queue" | "not_applicable";
type IssueHandler = (
  stage: "document_upload" | "document_status_update" | "internal_queue" | "customer_queue",
  error: unknown
) => void;

export async function processOpenHousePostCommit({
  registration,
  input,
  isR2Configured,
  upload,
  updateDocumentStatus,
  enqueue,
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
  enqueue: (input: {
    recipient: string;
    subject: string;
    html: string;
    emailType: string;
    relatedPropertyId: string;
    canonicalLeadId: string;
    relatedSubmissionType: string;
    relatedSubmissionId: string;
    dedupeKey: string;
  }) => Promise<unknown>;
  internalRecipient: string;
  onError: IssueHandler;
}) {
  if (!registration.created) {
    return {
      documentState: currentDocumentStatus(registration),
      notificationState: {
        internal: "pending" as QueueState,
        customer: registration.email ? ("pending" as QueueState) : ("not_applicable" as QueueState),
      },
    };
  }

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
    enqueue,
    onError,
  });
  const customer = registration.email
    ? await queueCustomer({ registration, enqueue, onError })
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
  const kind = input.documentKind;
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
  enqueue,
  onError,
}: {
  registration: PersistedOpenHouseRegistration;
  documentState: OpenHouseDocumentStatus;
  recipient: string;
  enqueue: Parameters<typeof processOpenHousePostCommit>[0]["enqueue"];
  onError: IssueHandler;
}): Promise<QueueState> {
  try {
    const email = buildOpenHouseInternalEmail({ registration, documentStatus: documentState });
    await enqueue({
      recipient,
      subject: email.subject,
      html: email.html,
      emailType: "open_house_registration_internal",
      relatedPropertyId: registration.property.id,
      canonicalLeadId: registration.leadId,
      relatedSubmissionType: "open_house_registration",
      relatedSubmissionId: registration.id,
      dedupeKey: `open_house_registration:${registration.id}:internal:v1`,
    });
    return "queued";
  } catch (error) {
    onError("internal_queue", error);
    return "failed_to_queue";
  }
}

async function queueCustomer({ registration, enqueue, onError }: {
  registration: PersistedOpenHouseRegistration;
  enqueue: Parameters<typeof processOpenHousePostCommit>[0]["enqueue"];
  onError: IssueHandler;
}): Promise<QueueState> {
  try {
    const email = buildOpenHouseCustomerEmail(registration);
    await enqueue({
      recipient: registration.email!,
      subject: email.subject,
      html: email.html,
      emailType: "open_house_registration_customer",
      relatedPropertyId: registration.property.id,
      canonicalLeadId: registration.leadId,
      relatedSubmissionType: "open_house_registration",
      relatedSubmissionId: registration.id,
      dedupeKey: `open_house_registration:${registration.id}:customer:v1`,
    });
    return "queued";
  } catch (error) {
    onError("customer_queue", error);
    return "failed_to_queue";
  }
}

function currentDocumentStatus(registration: PersistedOpenHouseRegistration) {
  return registration.prequalificationKey
    ? registration.prequalificationStatus
    : registration.proofOfFundsKey
      ? registration.proofOfFundsStatus
      : "none";
}
