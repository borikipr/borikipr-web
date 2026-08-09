export const SIGNATURE_DOCUMENT_CLASSIFICATIONS = [
  "ALLOWED_CANDIDATE",
  "LEGAL_REVIEW_REQUIRED",
  "BLOCKED",
] as const;

export type SignatureDocumentClassification =
  (typeof SIGNATURE_DOCUMENT_CLASSIFICATIONS)[number];

export const SIGNATURE_DOCUMENT_APPROVAL_STATES = [
  "pending_counsel_review",
  "approved_by_counsel",
  "blocked_by_counsel",
] as const;

export type SignatureDocumentApprovalState =
  (typeof SIGNATURE_DOCUMENT_APPROVAL_STATES)[number];

export type SignatureDocumentTypeDefinition = Readonly<{
  id: string;
  label: string;
  classification: SignatureDocumentClassification;
  approvalState: SignatureDocumentApprovalState;
  counselReference: string | null;
}>;

function candidate(id: string, label: string): SignatureDocumentTypeDefinition {
  return Object.freeze({
    id,
    label,
    classification: "ALLOWED_CANDIDATE",
    approvalState: "pending_counsel_review",
    counselReference: null,
  });
}

function legalReview(
  id: string,
  label: string
): SignatureDocumentTypeDefinition {
  return Object.freeze({
    id,
    label,
    classification: "LEGAL_REVIEW_REQUIRED",
    approvalState: "pending_counsel_review",
    counselReference: null,
  });
}

const SIGNATURE_DOCUMENT_TYPE_DEFINITIONS = [
  candidate("ordinary_brokerage_agreement", "Ordinary brokerage agreement"),
  candidate("buyer_representation_agreement", "Buyer representation agreement"),
  candidate("listing_related_agreement", "Listing-related agreement"),
  candidate("ordinary_transaction_addendum", "Ordinary transaction addendum"),
  candidate("lease", "Lease"),
  candidate("transaction_acknowledgment", "Transaction acknowledgment"),
  candidate("ordinary_offer_or_contract", "Ordinary offer or contract"),
  legalReview("deed", "Deed"),
  legalReview("mortgage", "Mortgage"),
  legalReview("power_of_attorney", "Power of attorney"),
  legalReview("sworn_statement", "Sworn statement"),
  legalReview("affidavit", "Affidavit"),
  legalReview("notarized_document", "Notarized document"),
  legalReview("witnessed_document", "Witnessed document"),
  legalReview("property_registry_instrument", "Property-registry instrument"),
  legalReview(
    "foreclosure_default_acceleration_notice",
    "Foreclosure, default, or acceleration notice"
  ),
  legalReview("inheritance_or_succession", "Inheritance or succession document"),
  legalReview("judicial_filing", "Judicial filing"),
  legalReview(
    "externally_controlled_execution",
    "Document controlled by a lender, insurer, regulator, governing law, or counterparty"
  ),
] as const satisfies readonly SignatureDocumentTypeDefinition[];

export const SIGNATURE_DOCUMENT_TYPES: readonly SignatureDocumentTypeDefinition[] =
  Object.freeze(SIGNATURE_DOCUMENT_TYPE_DEFINITIONS);

export function isSignatureDocumentTypeApproved(
  definition: SignatureDocumentTypeDefinition
) {
  return (
    definition.classification === "ALLOWED_CANDIDATE" &&
    definition.approvalState === "approved_by_counsel" &&
    Boolean(definition.counselReference?.trim())
  );
}

export function getSignatureDocumentTypeDefinition(documentType: string) {
  return SIGNATURE_DOCUMENT_TYPES.find(
    (definition) => definition.id === documentType
  ) ?? null;
}
