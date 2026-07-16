import {
  normalizeEmail,
  normalizePuertoRicoUsPhone,
} from "./normalization";

export const BUYER_TENANT_FEATURE_FLAG = "BUYER_TENANT_PERSISTENCE_V1";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const INTERESTS = new Set<BuyerTenantInterest>(["Comprar", "Alquilar"]);
const PROPERTY_TYPES = new Set<BuyerTenantPropertyType>([
  "Casa",
  "Apartamento",
  "Condominio",
  "Terreno",
  "Propiedad comercial",
]);
const BEDROOMS = new Set<BuyerTenantBedrooms>(["1", "2", "3", "4+"]);
const BATHROOMS = new Set<BuyerTenantBathrooms>(["1", "2", "3+"]);

export const BUYER_QUALIFICATION_VALUES = [
  "Cuento con una carta de precalificación vigente.",
  "Estoy en proceso de obtener mi carta de precalificación.",
  "Aún no he iniciado el proceso con una institución financiera.",
  "La compra sería en efectivo.",
  "Utilizaré otro método o programa de ayuda.",
] as const;

const BUYER_QUALIFICATIONS = new Set<string>(BUYER_QUALIFICATION_VALUES);

const TEXT_LIMITS = {
  name: 200,
  email: 320,
  phone: 64,
  municipalities: 500,
  budget: 100,
  comments: 4000,
} as const;

export type BuyerTenantInterest = "Comprar" | "Alquilar";
export type BuyerTenantPropertyType =
  | "Casa"
  | "Apartamento"
  | "Condominio"
  | "Terreno"
  | "Propiedad comercial";
export type BuyerTenantBedrooms = "1" | "2" | "3" | "4+";
export type BuyerTenantBathrooms = "1" | "2" | "3+";

export type ParsedBuyerTenantInquiry = {
  idempotencyKey: string;
  name: string;
  email: string | null;
  phone: string;
  primaryInterest: BuyerTenantInterest;
  purchaseQualification: string | null;
  budget: string;
  municipalities: string;
  propertyTypes: BuyerTenantPropertyType[] | null;
  bedrooms: BuyerTenantBedrooms | null;
  bathrooms: BuyerTenantBathrooms | null;
  comments: string | null;
};

export class BuyerTenantValidationError extends Error {
  constructor(
    public readonly publicMessage: string,
    public readonly status: number,
    public readonly reason: string
  ) {
    super(publicMessage);
    this.name = "BuyerTenantValidationError";
  }
}

export function isBuyerTenantPersistenceEnabled() {
  return process.env[BUYER_TENANT_FEATURE_FLAG] === "true";
}

export function parseBuyerTenantInquiryBody(
  body: unknown
): ParsedBuyerTenantInquiry {
  if (!isRecord(body)) {
    invalid("No pudimos validar este envío. Intenta nuevamente.", "invalid_body");
  }

  const idempotencyKey = requiredString(body, "idempotencyKey");
  const name = requiredString(body, "nombre");
  const email = optionalString(body, "email");
  const phone = requiredString(body, "telefono");
  const municipalities = requiredString(body, "municipios");
  const primaryInterestInput = requiredString(body, "interesPrincipal");
  const purchaseQualification = optionalString(body, "cualificacionCompra");
  const budget = requiredString(body, "presupuesto");
  const bedroomsInput = optionalString(body, "habitaciones");
  const bathroomsInput = optionalString(body, "banos");
  const comments = optionalString(body, "comentarios");

  if (!UUID_PATTERN.test(idempotencyKey)) {
    invalid(
      "No pudimos validar este envío. Intenta nuevamente.",
      "invalid_idempotency_key"
    );
  }

  requireLength(name, TEXT_LIMITS.name, "name_too_long");
  requireLength(phone, TEXT_LIMITS.phone, "phone_too_long");
  requireLength(municipalities, TEXT_LIMITS.municipalities, "municipalities_too_long");
  requireLength(budget, TEXT_LIMITS.budget, "budget_too_long");
  if (email) requireLength(email, TEXT_LIMITS.email, "email_too_long");
  if (comments) requireLength(comments, TEXT_LIMITS.comments, "comments_too_long");

  if (!normalizePuertoRicoUsPhone(phone)) {
    invalid(
      "Ingresa un teléfono válido de Puerto Rico o Estados Unidos.",
      "invalid_phone"
    );
  }

  if (email && !normalizeEmail(email)) {
    invalid("El email no es válido.", "invalid_email");
  }

  const primaryInterest = primaryInterestInput as BuyerTenantInterest;
  if (!INTERESTS.has(primaryInterest)) {
    invalid("Selecciona un interés principal válido.", "invalid_interest");
  }

  if (primaryInterest === "Comprar") {
    if (!purchaseQualification) {
      invalid(
        "Selecciona cómo te encuentras cualificado(a) para la compra.",
        "missing_purchase_qualification"
      );
    }
    if (!BUYER_QUALIFICATIONS.has(purchaseQualification)) {
      invalid(
        "Selecciona una cualificación para compra válida.",
        "invalid_purchase_qualification"
      );
    }
  } else if (purchaseQualification) {
    invalid(
      "La cualificación de compra no aplica al interés de alquiler.",
      "unexpected_purchase_qualification"
    );
  }

  const propertyTypes = parsePropertyTypes(body.tipoPropiedad);
  const bedrooms = parseOptionalAllowlistedValue(
    bedroomsInput,
    BEDROOMS,
    "Selecciona una cantidad de habitaciones válida.",
    "invalid_bedrooms"
  );
  const bathrooms = parseOptionalAllowlistedValue(
    bathroomsInput,
    BATHROOMS,
    "Selecciona una cantidad de baños válida.",
    "invalid_bathrooms"
  );

  return {
    idempotencyKey,
    name,
    email,
    phone,
    primaryInterest,
    purchaseQualification:
      primaryInterest === "Comprar" ? purchaseQualification : null,
    budget,
    municipalities,
    propertyTypes,
    bedrooms,
    bathrooms,
    comments,
  };
}

function parsePropertyTypes(value: unknown) {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    invalid(
      "Selecciona tipos de propiedad válidos.",
      "invalid_property_types"
    );
  }
  if (value.length === 0) return null;
  if (value.length > PROPERTY_TYPES.size) {
    invalid(
      "Selecciona tipos de propiedad válidos.",
      "invalid_property_types"
    );
  }

  const values = value.map((item) => {
    if (typeof item !== "string") {
      invalid(
        "Selecciona tipos de propiedad válidos.",
        "invalid_property_types"
      );
    }
    return item.trim() as BuyerTenantPropertyType;
  });

  if (
    values.some((item) => !PROPERTY_TYPES.has(item)) ||
    new Set(values).size !== values.length
  ) {
    invalid(
      "Selecciona tipos de propiedad válidos.",
      "invalid_property_types"
    );
  }
  return values;
}

function parseOptionalAllowlistedValue<T extends string>(
  value: string | null,
  allowed: Set<T>,
  message: string,
  reason: string
) {
  if (!value) return null;
  const candidate = value as T;
  if (!allowed.has(candidate)) invalid(message, reason);
  return candidate;
}

function requiredString(record: Record<string, unknown>, key: string) {
  const value = optionalString(record, key);
  if (!value) {
    invalid("Completa todos los campos requeridos.", `missing_${key}`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    invalid("No pudimos validar este envío. Intenta nuevamente.", `invalid_${key}`);
  }
  return value.trim() || null;
}

function requireLength(value: string, maximum: number, reason: string) {
  if (value.length > maximum) {
    invalid("Uno de los campos excede el largo permitido.", reason);
  }
}

function invalid(message: string, reason: string): never {
  throw new BuyerTenantValidationError(message, 400, reason);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
