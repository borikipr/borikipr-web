import type {
  SignatureDocumentStatus,
  SignatureParticipantStatus,
} from "./types";

const DOCUMENT_TRANSITIONS: Readonly<
  Record<SignatureDocumentStatus, readonly SignatureDocumentStatus[]>
> = {
  draft: ["sent", "voided"],
  sent: ["viewed", "partially_signed", "completed", "voided", "expired"],
  viewed: ["partially_signed", "completed", "voided", "expired"],
  partially_signed: ["completed", "voided", "expired"],
  completed: [],
  voided: [],
  expired: ["voided"],
};

const PARTICIPANT_TRANSITIONS: Readonly<
  Record<SignatureParticipantStatus, readonly SignatureParticipantStatus[]>
> = {
  pending: ["invited", "revoked", "expired", "declined"],
  invited: ["viewed", "revoked", "expired", "declined"],
  viewed: ["consented", "revoked", "expired", "declined"],
  consented: ["completed", "revoked", "expired", "declined"],
  completed: [],
  revoked: [],
  expired: [],
  declined: [],
};

export function isAllowedDocumentTransition(
  from: SignatureDocumentStatus,
  to: SignatureDocumentStatus
) {
  return from === to || DOCUMENT_TRANSITIONS[from].includes(to);
}

export function isAllowedParticipantTransition(
  from: SignatureParticipantStatus,
  to: SignatureParticipantStatus
) {
  return from === to || PARTICIPANT_TRANSITIONS[from].includes(to);
}

export function assertAllowedDocumentTransition(
  from: SignatureDocumentStatus,
  to: SignatureDocumentStatus
) {
  if (!isAllowedDocumentTransition(from, to)) {
    throw new Error("signature_document_transition_rejected");
  }
}

export function assertAllowedParticipantTransition(
  from: SignatureParticipantStatus,
  to: SignatureParticipantStatus
) {
  if (!isAllowedParticipantTransition(from, to)) {
    throw new Error("signature_participant_transition_rejected");
  }
}
