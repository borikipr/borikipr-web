export const SIGNATURE_APPROVAL_MODES = [
  "internal_business",
  "external_review",
  "out_of_scope",
] as const;

export type SignatureApprovalMode = (typeof SIGNATURE_APPROVAL_MODES)[number];

export const SIGNATURE_DOCUMENT_SCOPES = [
  "ordinary_brokerage",
  "formality_caution",
  "externally_controlled",
] as const;

export type SignatureDocumentScope = (typeof SIGNATURE_DOCUMENT_SCOPES)[number];

export type SignatureDocumentTypeDefinition = Readonly<{
  id: string;
  label: string;
  scope: SignatureDocumentScope;
  defaultApprovalMode: SignatureApprovalMode;
  guidance: string;
}>;

const INTERNAL_GUIDANCE =
  "Documento ordinario del flujo de corretaje. Puede aprobarse internamente para firma electrónica.";
const FORMALITY_GUIDANCE =
  "Este tipo de documento puede requerir formalidades externas y no debe habilitarse para firma electrónica interna sin confirmar que corresponde al alcance de Erickson Real Estate.";
const EXTERNAL_GUIDANCE =
  "Su ejecución puede estar controlada por una entidad o requisito externo. Confirme el alcance antes de habilitarlo.";

function ordinary(id: string, label: string): SignatureDocumentTypeDefinition {
  return Object.freeze({ id, label, scope: "ordinary_brokerage", defaultApprovalMode: "internal_business", guidance: INTERNAL_GUIDANCE });
}

function formality(id: string, label: string): SignatureDocumentTypeDefinition {
  return Object.freeze({ id, label, scope: "formality_caution", defaultApprovalMode: "out_of_scope", guidance: FORMALITY_GUIDANCE });
}

const SIGNATURE_DOCUMENT_TYPE_DEFINITIONS = [
  ordinary("ordinary_brokerage_agreement", "Acuerdo ordinario de corretaje"),
  ordinary("buyer_representation_agreement", "Acuerdo de representación de comprador"),
  ordinary("listing_related_agreement", "Acuerdo de representación/listado"),
  ordinary("ordinary_transaction_addendum", "Adenda ordinaria de transacción"),
  ordinary("lease", "Arrendamiento"),
  ordinary("transaction_acknowledgment", "Acuse o informe de transacción"),
  ordinary("ordinary_offer_or_contract", "Oferta o contrato ordinario"),
  formality("deed", "Escritura"),
  formality("mortgage", "Hipoteca"),
  formality("power_of_attorney", "Poder"),
  formality("sworn_statement", "Declaración jurada"),
  formality("affidavit", "Affidavit"),
  formality("notarized_document", "Documento notarizado"),
  formality("witnessed_document", "Documento con testigos"),
  formality("property_registry_instrument", "Instrumento del Registro de la Propiedad"),
  formality("foreclosure_default_acceleration_notice", "Aviso de ejecución, incumplimiento o aceleración"),
  formality("inheritance_or_succession", "Documento de herencia o sucesión"),
  formality("judicial_filing", "Documento judicial"),
  Object.freeze({
    id: "externally_controlled_execution",
    label: "Documento controlado por prestamista, aseguradora, regulador, ley aplicable o contraparte",
    scope: "externally_controlled",
    defaultApprovalMode: "out_of_scope",
    guidance: EXTERNAL_GUIDANCE,
  }),
] as const satisfies readonly SignatureDocumentTypeDefinition[];

export const SIGNATURE_DOCUMENT_TYPES: readonly SignatureDocumentTypeDefinition[] =
  Object.freeze(SIGNATURE_DOCUMENT_TYPE_DEFINITIONS);

export function isOrdinaryBrokerageDocumentType(definition: SignatureDocumentTypeDefinition) {
  return definition.scope === "ordinary_brokerage";
}

export function getSignatureDocumentTypeDefinition(documentType: string) {
  return SIGNATURE_DOCUMENT_TYPES.find((definition) => definition.id === documentType) ?? null;
}
