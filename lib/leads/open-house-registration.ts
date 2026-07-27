import { normalizeEmail, normalizePuertoRicoUsPhone } from "./normalization";

export const OPEN_HOUSE_PERSISTENCE_FEATURE_FLAG =
  "OPEN_HOUSE_PERSISTENCE_V2";
export const MAX_OPEN_HOUSE_DOCUMENT_BYTES = 10 * 1024 * 1024;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PURCHASE_METHODS = new Set(["Financiamiento", "Cash", "Otro"]);
const ATTENDANCE_ANSWERS = new Set(["Sí", "No"]);
const CLOSING_FUNDS_ANSWERS = new Set(["Sí", "Parcialmente", "Aún no"]);
const SOLAR_ANSWERS = new Set(["yes", "no"]);
const BROKER_ANSWERS = new Set(["Sí", "No"]);
const PUBLIC_PROPERTY_STATUSES = new Set([
  "disponible",
  "coming_soon",
  "bajo_contrato",
]);
const DOCUMENT_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type OpenHouseDocumentStatus =
  | "none"
  | "pending"
  | "uploaded"
  | "failed";

export type ParsedOpenHouseRegistration = {
  idempotencyKey: string;
  propertyId: string;
  propertySlug: string;
  submittedShowingAt: Date;
  name: string;
  phone: string;
  email: string | null;
  purchaseMethod: "Financiamiento" | "Cash" | "Otro";
  purchaseMethodOther: string | null;
  attendanceAvailability: string;
  closingFunds: "Sí" | "Parcialmente" | "Aún no";
  workingWithBroker: "Sí" | "No";
  brokerName: string | null;
  brokerPhone: string | null;
  solarContractAcceptance: "yes" | "no" | null;
  prequalificationFile: File | null;
  proofOfFundsFile: File | null;
  documentFile: File | null;
  documentKind: "prequalification_letter" | "proof_of_funds" | null;
  documentExtension: string | null;
};

export type CanonicalOpenHouseProperty = {
  id: string;
  slug: string;
  title: string;
  status: string;
  origin: string;
  mayPublishOnWeb: boolean;
  showingFormActive: boolean;
  showingAt: Date | null;
  requiresPrequalification: boolean;
  hasSolarLease: boolean;
};

export class OpenHouseValidationError extends Error {
  constructor(
    public readonly publicMessage: string,
    public readonly status: number,
    public readonly reason: string
  ) {
    super(publicMessage);
    this.name = "OpenHouseValidationError";
  }
}

export function isOpenHousePersistenceEnabled() {
  return process.env[OPEN_HOUSE_PERSISTENCE_FEATURE_FLAG] === "true";
}

export function parseOpenHouseRegistrationFormData(
  formData: FormData
): ParsedOpenHouseRegistration {
  const idempotencyKey = getText(formData, "idempotencyKey");
  const propertyId = getText(formData, "propertyId");
  const propertySlug = getText(formData, "propertySlug");
  const showingAtText = getText(formData, "showingAt");
  const name = getText(formData, "nombre");
  const phone = getText(formData, "telefono");
  const email = getText(formData, "email") || null;
  const purchaseMethod = getText(formData, "metodo_compra");
  const purchaseMethodOther = getText(formData, "metodoCompraOtro") || null;
  const attendanceAvailability = getText(formData, "disponibilidad_visita");
  const closingFunds = getText(formData, "fondos_gastos_cierre");
  const workingWithBroker = getText(formData, "trabajando_con_corredor");
  const brokerName = getText(formData, "nombre_corredor") || null;
  const brokerPhone = getText(formData, "telefono_corredor") || null;
  const solarContractAcceptance =
    getText(formData, "solarContractAcceptance") || null;
  const legacyCustomAnswer =
    getText(formData, "respuesta_personalizada") || null;

  requireUuid(idempotencyKey, "invalid_idempotency_key");
  requireUuid(propertyId, "invalid_property_id");
  if (!SLUG_PATTERN.test(propertySlug) || propertySlug.length > 200) {
    invalid("La propiedad seleccionada no es válida.", "invalid_property_slug");
  }

  const submittedShowingAt = parseIsoInstant(showingAtText);
  requireText(name, 200, "nombre");
  requireText(phone, 64, "telefono");
  requireText(attendanceAvailability, 32, "disponibilidad_visita");
  requireText(closingFunds, 32, "fondos_gastos_cierre");
  optionalText(purchaseMethodOther, 500, "metodoCompraOtro");
  optionalText(solarContractAcceptance, 16, "solarContractAcceptance");
  optionalText(legacyCustomAnswer, 2000, "respuesta_personalizada");
  if (legacyCustomAnswer) {
    invalid(
      "La respuesta personalizada no aplica.",
      "unexpected_custom_answer"
    );
  }

  if (!normalizePuertoRicoUsPhone(phone)) {
    invalid(
      "Ingresa un teléfono válido de Puerto Rico o Estados Unidos.",
      "invalid_phone"
    );
  }
  if (email && (email.length > 320 || !normalizeEmail(email))) {
    invalid("Ingresa un correo electrónico válido.", "invalid_email");
  }
  if (!PURCHASE_METHODS.has(purchaseMethod)) {
    invalid("Selecciona un método de compra válido.", "invalid_purchase_method");
  }
  if (purchaseMethod === "Otro" && !purchaseMethodOther) {
    invalid(
      "Especifica el método o programa de compra.",
      "missing_purchase_method_other"
    );
  }
  if (purchaseMethod !== "Otro" && purchaseMethodOther) {
    invalid(
      "La descripción de otro método no aplica.",
      "unexpected_purchase_method_other"
    );
  }
  if (!ATTENDANCE_ANSWERS.has(attendanceAvailability)) {
    invalid(
      "Confirma si podrás asistir al Open House.",
      "invalid_attendance_answer"
    );
  }
  if (!CLOSING_FUNDS_ANSWERS.has(closingFunds)) {
    invalid(
      "Selecciona una respuesta válida sobre los fondos de cierre.",
      "invalid_closing_funds_answer"
    );
  }
  if (!BROKER_ANSWERS.has(workingWithBroker)) {
    invalid("Selecciona una respuesta válida sobre el corredor.", "invalid_broker_answer");
  }

  if (workingWithBroker === "Sí") {
    requireText(brokerName, 200, "nombre_corredor");
    requireText(brokerPhone, 64, "telefono_corredor");
  } else if (brokerName || brokerPhone) {
    invalid(
      "Los datos del corredor no aplican a esta respuesta.",
      "unexpected_broker_fields"
    );
  }

  const prequalificationFile = getSingleFile(
    formData,
    "carta_precalificacion"
  );
  const proofOfFundsFile = getSingleFile(
    formData,
    "evidencia_fondos_archivo"
  );
  if (prequalificationFile && proofOfFundsFile) {
    invalid("Adjunta solamente el documento aplicable.", "multiple_documents");
  }
  if (purchaseMethod === "Financiamiento" && proofOfFundsFile) {
    invalid(
      "La evidencia de fondos no aplica a financiamiento.",
      "unexpected_proof_of_funds"
    );
  }
  if (purchaseMethod === "Cash" && prequalificationFile) {
    invalid(
      "La carta de precalificación no aplica a una compra Cash.",
      "unexpected_prequalification"
    );
  }

  const documentFile = prequalificationFile || proofOfFundsFile;
  let documentExtension: string | null = null;
  if (documentFile) {
    if (documentFile.size > MAX_OPEN_HOUSE_DOCUMENT_BYTES) {
      invalid("El archivo excede el máximo permitido de 10 MB.", "document_too_large");
    }
    documentExtension = DOCUMENT_EXTENSIONS[documentFile.type] || null;
    if (!documentExtension) {
      invalid(
        "Solo se aceptan PDF e imágenes JPG, PNG o WebP.",
        "invalid_document_type"
      );
    }
  }

  return {
    idempotencyKey,
    propertyId,
    propertySlug,
    submittedShowingAt,
    name,
    phone,
    email,
    purchaseMethod: purchaseMethod as ParsedOpenHouseRegistration["purchaseMethod"],
    purchaseMethodOther:
      purchaseMethod === "Otro" ? purchaseMethodOther : null,
    attendanceAvailability,
    closingFunds: closingFunds as ParsedOpenHouseRegistration["closingFunds"],
    workingWithBroker: workingWithBroker as ParsedOpenHouseRegistration["workingWithBroker"],
    brokerName: workingWithBroker === "Sí" ? brokerName : null,
    brokerPhone: workingWithBroker === "Sí" ? brokerPhone : null,
    solarContractAcceptance:
      solarContractAcceptance as ParsedOpenHouseRegistration["solarContractAcceptance"],
    prequalificationFile,
    proofOfFundsFile,
    documentFile,
    documentKind: prequalificationFile
      ? "prequalification_letter"
      : proofOfFundsFile
        ? "proof_of_funds"
        : null,
    documentExtension,
  };
}

export function validateOpenHouseForProperty(
  input: ParsedOpenHouseRegistration,
  property: CanonicalOpenHouseProperty,
  now = new Date(),
  hasReusableDocument = false
) {
  if (property.id !== input.propertyId || property.slug !== input.propertySlug) {
    invalid("La propiedad seleccionada cambió. Recarga la página.", "property_identity_mismatch");
  }
  const publiclyVisible =
    property.origin === "propio" ||
    (isCollaborativeOrigin(property.origin) && property.mayPublishOnWeb);
  if (!publiclyVisible || !PUBLIC_PROPERTY_STATUSES.has(property.status)) {
    invalid("Este formulario no está disponible para la propiedad.", "property_not_public", 403);
  }
  if (!property.showingFormActive) {
    invalid("Este formulario de showing no está activo.", "inactive_showing", 403);
  }
  if (!property.showingAt) {
    invalid("La fecha del showing no está disponible.", "missing_showing_date", 403);
  }
  if (property.showingAt.getTime() <= now.getTime()) {
    invalid("Este showing ya no está disponible.", "past_showing", 403);
  }
  if (property.showingAt.getTime() !== input.submittedShowingAt.getTime()) {
    invalid("La fecha del showing cambió. Recarga la página.", "showing_mismatch");
  }
  if (
    input.purchaseMethod === "Financiamiento" &&
    !input.prequalificationFile &&
    !hasReusableDocument
  ) {
    invalid(
      "La carta de precalificación es requerida para completar este registro.",
      "missing_required_prequalification"
    );
  }
  if (
    input.purchaseMethod === "Cash" &&
    !input.proofOfFundsFile &&
    !hasReusableDocument
  ) {
    invalid(
      "La evidencia de fondos es requerida para completar este registro.",
      "missing_required_proof_of_funds"
    );
  }
  if (property.hasSolarLease) {
    if (
      !input.solarContractAcceptance ||
      !SOLAR_ANSWERS.has(input.solarContractAcceptance)
    ) {
      invalid(
        "Selecciona una respuesta válida sobre el contrato o leasing de las placas solares.",
        "invalid_solar_answer"
      );
    }
  } else if (input.solarContractAcceptance) {
    invalid(
      "La respuesta sobre placas solares no aplica a esta propiedad.",
      "unexpected_solar_answer"
    );
  }
}

export function buildOpenHouseShowingEventKey(propertyId: string, showingAt: Date) {
  requireUuid(propertyId, "invalid_property_id");
  if (Number.isNaN(showingAt.getTime())) throw new Error("Invalid showing instant.");
  return `open-house:v1:${propertyId}:${showingAt.toISOString()}`;
}

export function buildOpenHouseDocumentObjectKey(
  registrationId: string,
  kind: "prequalification_letter" | "proof_of_funds",
  extension: string
) {
  requireUuid(registrationId, "invalid_registration_id");
  if (!/^[a-z0-9]+$/.test(extension)) throw new Error("Invalid document extension.");
  return `lead-documents/open-house-registrations/${registrationId}/${kind}.${extension}`;
}

function parseIsoInstant(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    invalid("La fecha del showing no es válida.", "invalid_showing_at");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    invalid("La fecha del showing no es válida.", "invalid_showing_at");
  }
  return date;
}

function requireUuid(value: string, reason: string) {
  if (!UUID_PATTERN.test(value)) {
    invalid("No pudimos validar este envío. Intenta nuevamente.", reason);
  }
}

function requireText(value: string | null, max: number, field: string) {
  if (!value || value.length > max) {
    invalid("Completa los campos requeridos correctamente.", `invalid_${field}`);
  }
}

function optionalText(value: string | null, max: number, field: string) {
  if (value && value.length > max) {
    invalid("Uno de los campos excede el tamaño permitido.", `invalid_${field}`);
  }
}

function getText(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getSingleFile(formData: FormData, key: string) {
  const values = formData.getAll(key);
  if (values.some((value) => !(value instanceof File))) {
    invalid("El documento enviado no es válido.", "invalid_document_payload");
  }
  const files = values.filter(
    (value): value is File => value instanceof File && value.size > 0
  );
  if (files.length > 1) invalid("Adjunta un solo archivo.", "too_many_files");
  return files[0] || null;
}

function isCollaborativeOrigin(value: string) {
  return ["co_broke", "co-broke", "co broke", "colaboracion", "colaboración"].includes(
    value
  );
}

function invalid(message: string, reason: string, status = 400): never {
  throw new OpenHouseValidationError(message, status, reason);
}
