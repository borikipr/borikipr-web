export const HACIENDA_SHOWING_SLUG =
  "hacienda-monte-carmelo-cascadas-cafe-guayanilla";
export const HACIENDA_SHOWING_ROUTE =
  `/listados/${HACIENDA_SHOWING_SLUG}/registro-showing`;
export const HACIENDA_SHOWING_CUTOFF_ISO = "2026-10-25T14:00:00.000Z";
export const HACIENDA_SHOWING_MAX_BODY_BYTES = 24_000;

export const ATTENDANCE_OPTIONS = [
  "Sí, asistiré.",
  "No podré asistir, pero me interesa la propiedad.",
  "Todavía no estoy seguro/a.",
] as const;

export const PURCHASE_METHOD_OPTIONS = [
  "Compra en efectivo (cash).",
  "Mediante financiamiento.",
  "Dependerá de la negociación y las condiciones de compra.",
  "Estoy evaluando mis opciones.",
] as const;

export const FINANCING_STATUS_OPTIONS = [
  "Tengo carta de precualificación o preaprobación.",
  "Estoy en proceso con una institución financiera.",
  "Todavía no he comenzado el proceso.",
  "No aplica.",
] as const;

export const PROPERTY_INTEREST_OPTIONS = [
  "Proyecto agrícola o cultivo de café.",
  "Proyecto ecoturístico o recreativo.",
  "Inversión.",
  "Uso personal o familiar.",
  "Otro interés.",
] as const;

export const REALTOR_OPTIONS = ["Sí.", "No."] as const;

type Attendance = (typeof ATTENDANCE_OPTIONS)[number];
type PurchaseMethod = (typeof PURCHASE_METHOD_OPTIONS)[number];
type FinancingStatus = (typeof FINANCING_STATUS_OPTIONS)[number];
type PropertyInterest = (typeof PROPERTY_INTEREST_OPTIONS)[number];
type RealtorAnswer = (typeof REALTOR_OPTIONS)[number];

export type HaciendaShowingSubmission = {
  name: string;
  phone: string;
  email: string;
  attendance: Attendance;
  purchaseMethod: PurchaseMethod;
  financingStatus: FinancingStatus | null;
  interests: PropertyInterest[];
  otherInterest: string | null;
  worksWithRealtor: RealtorAnswer;
  realtorName: string | null;
  realtorPhone: string | null;
  comments: string | null;
  privacyAcknowledged: true;
};

export class HaciendaShowingValidationError extends Error {
  constructor(
    public readonly publicMessage: string,
    public readonly reason: string,
    public readonly status = 400
  ) {
    super(publicMessage);
    this.name = "HaciendaShowingValidationError";
  }
}

export function isHaciendaShowingClosed(now = new Date()) {
  return now.getTime() >= Date.parse(HACIENDA_SHOWING_CUTOFF_ISO);
}

export function validateHaciendaShowingPayload(
  input: unknown
): HaciendaShowingSubmission {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    invalid("No pudimos validar el formulario.", "invalid_payload");
  }

  const body = input as Record<string, unknown>;
  if (cleanText(body.website, 120)) {
    invalid("No pudimos procesar el formulario.", "honeypot_triggered");
  }

  const name = cleanText(body.name, 120);
  if (!name || !hasMeaningfulName(name)) {
    invalid("Ingresa tu nombre completo.", "invalid_name");
  }

  const phone = normalizePhone(cleanText(body.phone, 40));
  if (!phone) {
    invalid("Ingresa un número de teléfono válido.", "invalid_phone");
  }

  const email = cleanText(body.email, 254).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    invalid("Ingresa un correo electrónico válido.", "invalid_email");
  }

  const attendance = cleanText(body.attendance, 100);
  if (!includes(ATTENDANCE_OPTIONS, attendance)) {
    invalid("Selecciona una respuesta de asistencia.", "invalid_attendance");
  }

  const purchaseMethod = cleanText(body.purchaseMethod, 120);
  if (!includes(PURCHASE_METHOD_OPTIONS, purchaseMethod)) {
    invalid("Selecciona cómo contemplas adquirir la propiedad.", "invalid_purchase_method");
  }

  const rawFinancingStatus = cleanText(body.financingStatus, 120);
  let financingStatus: FinancingStatus | null = null;
  if (purchaseMethod === "Mediante financiamiento.") {
    if (!includes(FINANCING_STATUS_OPTIONS, rawFinancingStatus)) {
      invalid("Selecciona tu situación de financiamiento.", "invalid_financing_status");
    }
    financingStatus = rawFinancingStatus;
  } else if (rawFinancingStatus) {
    invalid("La situación de financiamiento no aplica a esta respuesta.", "unexpected_financing_status");
  }

  const interests = Array.isArray(body.interests)
    ? body.interests.map((value) => cleanText(value, 80))
    : [];
  if (
    interests.length > PROPERTY_INTEREST_OPTIONS.length ||
    new Set(interests).size !== interests.length ||
    interests.some((value) => !includes(PROPERTY_INTEREST_OPTIONS, value))
  ) {
    invalid("Selecciona intereses válidos.", "invalid_interests");
  }

  const rawOtherInterest = cleanText(body.otherInterest, 160);
  const selectedOther = interests.includes("Otro interés.");
  if (!selectedOther && rawOtherInterest) {
    invalid("La explicación de otro interés no aplica.", "unexpected_other_interest");
  }
  const otherInterest = selectedOther && rawOtherInterest ? rawOtherInterest : null;

  const worksWithRealtor = cleanText(body.worksWithRealtor, 10);
  if (!includes(REALTOR_OPTIONS, worksWithRealtor)) {
    invalid("Indica si trabajas con otro corredor o Realtor®.", "invalid_realtor_answer");
  }

  const rawRealtorName = cleanText(body.realtorName, 120);
  const rawRealtorPhone = cleanText(body.realtorPhone, 40);
  let realtorName: string | null = null;
  let realtorPhone: string | null = null;
  if (worksWithRealtor === "Sí.") {
    if (!rawRealtorName || !hasMeaningfulName(rawRealtorName)) {
      invalid("Ingresa el nombre completo del corredor o Realtor®.", "invalid_realtor_name");
    }
    const normalizedRealtorPhone = normalizePhone(rawRealtorPhone);
    if (!normalizedRealtorPhone) {
      invalid("Ingresa un teléfono válido para el corredor o Realtor®.", "invalid_realtor_phone");
    }
    realtorName = rawRealtorName;
    realtorPhone = normalizedRealtorPhone;
  } else if (rawRealtorName || rawRealtorPhone) {
    invalid("Los datos del corredor no aplican a esta respuesta.", "unexpected_realtor_fields");
  }

  const comments = cleanMultilineText(body.comments, 1_200) || null;
  if (body.privacyAcknowledged !== true) {
    invalid("Debes aceptar el aviso de privacidad para continuar.", "privacy_not_acknowledged");
  }

  return {
    name,
    phone,
    email,
    attendance,
    purchaseMethod,
    financingStatus,
    interests: interests as PropertyInterest[],
    otherInterest,
    worksWithRealtor,
    realtorName,
    realtorPhone,
    comments,
    privacyAcknowledged: true,
  };
}

export function buildHaciendaShowingEmail(
  submission: HaciendaShowingSubmission,
  submittedAt: Date
) {
  const rows = [
    detailRow("Propiedad", "Hacienda Monte Carmelo: Cascadas & Café"),
    detailRow("Fecha del evento", "Domingo, 25 de octubre de 2026 — 10:00 a. m."),
    detailRow("Enviado", formatPuertoRicoTimestamp(submittedAt)),
    detailRow("Nombre completo", submission.name),
    detailRow("Teléfono", submission.phone),
    detailRow("Correo electrónico", submission.email),
    detailRow("Asistencia", submission.attendance),
    detailRow("Método de compra", submission.purchaseMethod),
    detailRow("Situación de financiamiento", submission.financingStatus),
    detailRow("Intereses", submission.interests.length ? submission.interests.join("\n") : "No indicó"),
    detailRow("Otro interés", submission.otherInterest),
    detailRow("Trabaja con otro corredor o Realtor®", submission.worksWithRealtor),
    detailRow("Nombre del corredor o Realtor®", submission.realtorName),
    detailRow("Teléfono del corredor o Realtor®", submission.realtorPhone),
    detailRow("Comentarios", submission.comments),
  ].join("");

  return {
    subject: `Hacienda Monte Carmelo | Registro Showing | ${submission.name}`,
    html: `<meta charset="utf-8" />
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.6;padding:24px">
        <div style="max-width:680px;margin:0 auto;border:1px solid #e8e8e8;border-radius:18px;overflow:hidden">
          <div style="background:#11518b;padding:20px 24px">
            <h2 style="margin:0;color:#fff;font-size:22px">Registro para Showing</h2>
            <p style="margin:6px 0 0;color:#f2d16b;font-size:14px">Hacienda Monte Carmelo</p>
          </div>
          <div style="padding:24px">${rows}</div>
          <div style="background:#f8f8f8;padding:16px 24px;border-top:1px solid #e8e8e8">
            <p style="margin:0;font-size:12px;color:#666">Erickson Real Estate PR · Registro recibido desde borikipr.com</p>
          </div>
        </div>
      </div>`,
  };
}

export function formatPuertoRicoTimestamp(value: Date) {
  return new Intl.DateTimeFormat("es-PR", {
    dateStyle: "full",
    timeStyle: "long",
    timeZone: "America/Puerto_Rico",
  }).format(value);
}

function detailRow(label: string, value: string | null) {
  if (!value) return "";
  return `<p style="margin:0 0 12px"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value).replaceAll("\n", "<br />")}</p>`;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cleanText(value: unknown, maxLength: number) {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (text.length > maxLength || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
    invalid("Uno de los campos excede el tamaño permitido.", "invalid_text_length");
  }
  return text;
}

function cleanMultilineText(value: unknown, maxLength: number) {
  const text = typeof value === "string"
    ? value.replace(/\r\n?/g, "\n").trim()
    : "";
  if (text.length > maxLength || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
    invalid("Los comentarios exceden el tamaño permitido.", "invalid_comments_length");
  }
  return text;
}

function hasMeaningfulName(value: string) {
  return value.length >= 3 && (value.match(/[\p{L}]/gu)?.length ?? 0) >= 2;
}

function normalizePhone(value: string) {
  if (!value) return null;
  const hasPlus = value.startsWith("+");
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 && /^(787|939)/.test(digits)) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (hasPlus && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }
  if (digits.length >= 10 && digits.length <= 15) {
    return digits;
  }
  return null;
}

function includes<const T extends readonly string[]>(options: T, value: string): value is T[number] {
  return (options as readonly string[]).includes(value);
}

function invalid(message: string, reason: string, status = 400): never {
  throw new HaciendaShowingValidationError(message, reason, status);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
