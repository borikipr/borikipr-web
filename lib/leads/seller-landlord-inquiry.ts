import {
  normalizeEmail,
  normalizePuertoRicoUsPhone,
} from "./normalization";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROPERTY_TYPES = new Map<string, SellerLandlordPropertyType>([
  ["Casa", "Casa"],
  ["Apartamento", "Apartamento"],
  ["Terreno", "Terreno"],
  ["Multifamiliar", "Multifamiliar"],
  ["Propiedad Comercial", "Propiedad comercial"],
  ["Propiedad comercial", "Propiedad comercial"],
]);

const PRIMARY_REASONS = new Set<SellerLandlordPrimaryReason>([
  "Vender",
  "Alquilar",
  "Evaluar ambas opciones",
]);

export type SellerLandlordPropertyType =
  | "Casa"
  | "Apartamento"
  | "Terreno"
  | "Multifamiliar"
  | "Propiedad comercial";

export type SellerLandlordPrimaryReason =
  | "Vender"
  | "Alquilar"
  | "Evaluar ambas opciones";

export type ParsedSellerLandlordInquiry = {
  idempotencyKey: string;
  name: string;
  email: string;
  phone: string;
  propertyType: SellerLandlordPropertyType | null;
  location: string | null;
  primaryReason: SellerLandlordPrimaryReason | null;
  comments: string | null;
};

export class SellerLandlordValidationError extends Error {
  constructor(
    public readonly publicMessage: string,
    public readonly status: number,
    public readonly reason: string
  ) {
    super(publicMessage);
    this.name = "SellerLandlordValidationError";
  }
}

export function parseSellerLandlordInquiryBody(
  body: unknown
): ParsedSellerLandlordInquiry {
  const record = isRecord(body) ? body : {};
  const idempotencyKey = getText(record, "idempotencyKey");
  const name = getText(record, "nombre");
  const email = getText(record, "email");
  const phone = getText(record, "telefono");
  const propertyTypeInput = getText(record, "tipoPropiedad");
  const location = getText(record, "ubicacion") || null;
  const primaryReasonInput = getText(record, "razonVenta");
  const comments = getText(record, "comentarios") || null;

  if (!UUID_PATTERN.test(idempotencyKey)) {
    throw new SellerLandlordValidationError(
      "No pudimos validar este envío. Intenta nuevamente.",
      400,
      "invalid_idempotency_key"
    );
  }

  if (!name || !email || !phone) {
    throw new SellerLandlordValidationError(
      "Nombre, email y teléfono son requeridos.",
      400,
      "missing_required_fields"
    );
  }

  if (!normalizeEmail(email)) {
    throw new SellerLandlordValidationError(
      "El email no es válido.",
      400,
      "invalid_email"
    );
  }

  if (!normalizePuertoRicoUsPhone(phone)) {
    throw new SellerLandlordValidationError(
      "Ingresa un teléfono válido de Puerto Rico o Estados Unidos.",
      400,
      "invalid_phone"
    );
  }

  const propertyType = propertyTypeInput
    ? PROPERTY_TYPES.get(propertyTypeInput) || null
    : null;
  if (propertyTypeInput && !propertyType) {
    throw new SellerLandlordValidationError(
      "Selecciona un tipo de propiedad válido.",
      400,
      "invalid_property_type"
    );
  }

  const primaryReason = primaryReasonInput
    ? (primaryReasonInput as SellerLandlordPrimaryReason)
    : null;
  if (primaryReason && !PRIMARY_REASONS.has(primaryReason)) {
    throw new SellerLandlordValidationError(
      "Selecciona un interés principal válido.",
      400,
      "invalid_primary_reason"
    );
  }

  return {
    idempotencyKey,
    name,
    email,
    phone,
    propertyType,
    location,
    primaryReason,
    comments,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getText(record: Record<string, unknown>, key: string) {
  return String(record[key] || "").trim();
}
