export const SIGNATURE_DOCUMENT_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "partially_signed",
  "completed",
  "voided",
  "expired",
] as const;

export type SignatureDocumentStatus =
  (typeof SIGNATURE_DOCUMENT_STATUSES)[number];

export const SIGNATURE_PARTICIPANT_STATUSES = [
  "pending",
  "invited",
  "viewed",
  "consented",
  "completed",
  "revoked",
  "expired",
  "declined",
] as const;

export type SignatureParticipantStatus =
  (typeof SIGNATURE_PARTICIPANT_STATUSES)[number];

export const SIGNATURE_FIELD_TYPES = [
  "signature",
  "initials",
  "date",
  "text",
] as const;

export type SignatureFieldType = (typeof SIGNATURE_FIELD_TYPES)[number];

export const SIGNATURE_CAPTURE_METHODS = [
  "drawn_vector",
  "typed",
  "system_date",
  "text_entry",
] as const;

export type SignatureCaptureMethod =
  (typeof SIGNATURE_CAPTURE_METHODS)[number];

export const SIGNATURE_ACTOR_CLASSES = [
  "admin",
  "participant",
  "system",
  "delivery",
] as const;

export type SignatureActorClass = (typeof SIGNATURE_ACTOR_CLASSES)[number];

export const SIGNATURE_EVENT_TYPES = [
  "document_created",
  "version_created",
  "participant_added",
  "participant_updated",
  "field_added",
  "field_updated",
  "field_removed",
  "send_prepared",
  "document_sent",
  "document_viewed",
  "document_partially_signed",
  "document_completed",
  "document_voided",
  "document_expired",
  "participant_invited",
  "participant_viewed",
  "participant_consented",
  "participant_completed",
  "participant_revoked",
  "participant_expired",
  "participant_declined",
  "field_submitted",
  "token_issued",
  "token_revoked",
  "token_superseded",
  "session_created",
  "session_revoked",
  "session_completed",
  "finalization_completed",
  "delivery_recorded",
  "document_downloaded",
] as const;

export type SignatureEventType = (typeof SIGNATURE_EVENT_TYPES)[number];

export type SignatureQueryExecutor = {
  unsafe<Row extends Record<string, unknown>>(
    query: string,
    parameters?: unknown[]
  ): Promise<Row[]>;
};

export type SignatureDatabase = SignatureQueryExecutor & {
  begin<Result>(
    callback: (transaction: SignatureQueryExecutor) => Promise<Result>
  ): Promise<Result>;
};

export type SignatureClock = () => Date;

export type SignatureEventMetadata = Readonly<Record<string, string>>;

export type SignatureEventRecord = Readonly<{
  id: string;
  documentId: string;
  documentVersionId: string;
  participantId: string | null;
  sessionId: string | null;
  eventType: SignatureEventType;
  actorClass: SignatureActorClass;
  actorAdminId: string | null;
  serverTimestamp: string;
  sequenceNumber: number;
  versionHash: string;
  controlledMetadata: SignatureEventMetadata;
  idempotencyKey: string;
  previousEventDigest: string | null;
  eventDigest: string;
  keyVersion: number;
  networkAddressDigest: string | null;
  userAgentDigest: string | null;
}>;
