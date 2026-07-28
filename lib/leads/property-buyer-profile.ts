import { normalizeEmail, normalizePuertoRicoUsPhone } from "./normalization";
import {
  BUYER_PROFILE_FILE_TOO_LARGE_MESSAGE,
  MAX_BUYER_PROFILE_DOCUMENT_BYTES,
} from "./property-buyer-profile-upload";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PURCHASE_METHODS = new Set(["Financiamiento", "Cash", "Otro"]);
const SOLAR_ANSWERS = new Set(["yes", "no"]);
const DOCUMENT_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type BuyerProfileDocumentType =
  | "prequalification_letter"
  | "proof_of_funds";
export type BuyerProfileDocumentStatus =
  | "none"
  | "pending"
  | "uploaded"
  | "failed";

export type ParsedPropertyBuyerProfile = {
  idempotencyKey: string;
  propertyId: string;
  propertySlug: string;
  submittedPropertyTitle: string;
  name: string;
  email: string | null;
  phone: string;
  purchaseMethod: "Financiamiento" | "Cash" | "Otro";
  purchaseMethodOther: string | null;
  financialInstitution: string | null;
  closingFunds: string | null;
  solarContractAcceptance: string | null;
  comments: string | null;
  file: File | null;
  documentType: BuyerProfileDocumentType | null;
  documentExtension: string | null;
};

export type CanonicalBuyerProfileProperty = {
  id: string;
  slug: string;
  title: string;
  municipio: string;
  sectorComunidad: string | null;
  status: string;
  hasSolarLease: boolean;
};

export class BuyerProfileValidationError extends Error {
  constructor(
    public readonly publicMessage: string,
    public readonly status: number,
    public readonly reason: string
  ) {
    super(publicMessage);
    this.name = "BuyerProfileValidationError";
  }
}

export function parsePropertyBuyerProfileFormData(
  formData: FormData
): ParsedPropertyBuyerProfile {
  const idempotencyKey = getText(formData, "idempotencyKey");
  const propertyId = getText(formData, "propertyId");
  const propertySlug = getText(formData, "propertySlug");
  const submittedPropertyTitle = getText(formData, "propertyTitle");
  const name = getText(formData, "nombre");
  const phone = getText(formData, "telefono");
  const email = getText(formData, "email") || null;
  const purchaseMethod = getText(formData, "metodoCompra");
  const purchaseMethodOther = getText(formData, "metodoCompraOtro") || null;
  const financialInstitution =
    getText(formData, "institucionFinanciera") || null;
  const closingFunds = getText(formData, "fondosCierre") || null;
  const solarContractAcceptance =
    getText(formData, "solarContractAcceptance") || null;
  const comments = getText(formData, "comentarios") || null;
  const file = getFile(formData, "cartaPreaprobacion");

  if (!UUID_PATTERN.test(idempotencyKey)) {
    throw new BuyerProfileValidationError(
      "No pudimos validar este envío. Intenta nuevamente.",
      400,
      "invalid_idempotency_key"
    );
  }

  if (
    !propertyId ||
    !propertySlug ||
    !submittedPropertyTitle ||
    !UUID_PATTERN.test(propertyId)
  ) {
    throw new BuyerProfileValidationError(
      "La información de la propiedad no es válida.",
      400,
      "invalid_property_identity"
    );
  }

  if (!name || !phone || !purchaseMethod) {
    throw new BuyerProfileValidationError(
      "Completa los campos requeridos.",
      400,
      "missing_required_fields"
    );
  }

  if (!normalizePuertoRicoUsPhone(phone)) {
    throw new BuyerProfileValidationError(
      "Ingresa un teléfono válido de Puerto Rico o Estados Unidos.",
      400,
      "invalid_phone"
    );
  }

  if (email && !normalizeEmail(email)) {
    throw new BuyerProfileValidationError(
      "El email no es válido.",
      400,
      "invalid_email"
    );
  }

  if (!PURCHASE_METHODS.has(purchaseMethod)) {
    throw new BuyerProfileValidationError(
      "Selecciona un método de compra válido.",
      400,
      "invalid_purchase_method"
    );
  }

  let documentType: BuyerProfileDocumentType | null = null;
  let documentExtension: string | null = null;

  if (
    (purchaseMethod === "Financiamiento" || purchaseMethod === "Cash") &&
    !file
  ) {
    throw new BuyerProfileValidationError(
      purchaseMethod === "Financiamiento"
        ? "Adjunta la carta de precalificación requerida."
        : "Adjunta la evidencia de fondos requerida.",
      400,
      purchaseMethod === "Financiamiento"
        ? "missing_required_prequalification"
        : "missing_required_proof_of_funds"
    );
  }

  if (file) {
    if (file.size > MAX_BUYER_PROFILE_DOCUMENT_BYTES) {
      throw new BuyerProfileValidationError(
        BUYER_PROFILE_FILE_TOO_LARGE_MESSAGE,
        400,
        "document_too_large"
      );
    }

    documentExtension = DOCUMENT_EXTENSIONS[file.type] || null;
    if (!documentExtension) {
      throw new BuyerProfileValidationError(
        "Solo se aceptan PDF e imágenes JPG, PNG o WebP.",
        400,
        "invalid_document_type"
      );
    }

    if (purchaseMethod === "Financiamiento") {
      documentType = "prequalification_letter";
    } else if (purchaseMethod === "Cash") {
      documentType = "proof_of_funds";
    } else {
      throw new BuyerProfileValidationError(
        "El documento no aplica al método de compra seleccionado.",
        400,
        "unexpected_document"
      );
    }
  }

  return {
    idempotencyKey,
    propertyId,
    propertySlug,
    submittedPropertyTitle,
    name,
    email,
    phone,
    purchaseMethod: purchaseMethod as ParsedPropertyBuyerProfile["purchaseMethod"],
    purchaseMethodOther,
    financialInstitution,
    closingFunds,
    solarContractAcceptance,
    comments,
    file,
    documentType,
    documentExtension,
  };
}

export function validateBuyerProfileForProperty(
  input: ParsedPropertyBuyerProfile,
  property: CanonicalBuyerProfileProperty
) {
  if (property.id !== input.propertyId || property.slug !== input.propertySlug) {
    throw new BuyerProfileValidationError(
      "No encontramos la propiedad seleccionada.",
      400,
      "property_identity_mismatch"
    );
  }

  if (property.status !== "disponible") {
    throw new BuyerProfileValidationError(
      "El perfil de comprador no está disponible para esta propiedad.",
      403,
      "property_not_available"
    );
  }

  if (property.hasSolarLease) {
    if (
      !input.solarContractAcceptance ||
      !SOLAR_ANSWERS.has(input.solarContractAcceptance)
    ) {
      throw new BuyerProfileValidationError(
        "Selecciona una respuesta válida sobre el contrato o leasing de las placas solares.",
        400,
        "invalid_solar_answer"
      );
    }
  } else if (input.solarContractAcceptance) {
    throw new BuyerProfileValidationError(
      "La respuesta sobre placas solares no aplica a esta propiedad.",
      400,
      "unexpected_solar_answer"
    );
  }
}

export function buildBuyerProfileDocumentObjectKey(
  profileId: string,
  documentType: BuyerProfileDocumentType,
  extension: string
) {
  if (!UUID_PATTERN.test(profileId) || !/^[a-z0-9]+$/.test(extension)) {
    throw new Error("Invalid document object key components.");
  }

  return `lead-documents/property-buyer-profiles/${profileId}/${documentType}.${extension}`;
}

function getText(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getFile(formData: FormData, key: string) {
  const file = formData.get(key);
  return file instanceof File && file.size > 0 ? file : null;
}
