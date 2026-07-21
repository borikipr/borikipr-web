import { Resend } from "resend";
import { sql } from "@/lib/db";
import {
  isResendLimitError,
  queueEmail,
  recordEmailSent,
  serializeEmailError,
} from "@/lib/email-queue";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { absoluteUrl } from "@/lib/seo";
import { persistPriorityRegistrationWithCanonicalLead } from "@/lib/leads/postgres-priority-registration";
import {
  isPriorityRegistrationCanonicalLeadEnabled,
  PriorityRegistrationPersistenceError,
} from "@/lib/leads/priority-registration-persistence";

export const runtime = "nodejs";

const purchaseTypes = new Set(["Cash", "Financiamiento", "Otros (especifique)"]);
const prequalifiedStatuses = new Set(["Sí", "No", "En proceso"]);
const propertySizeOptions = new Set([
  "2 habitaciones",
  "3 habitaciones",
  "4 o más habitaciones",
]);
const wantsVisitOptions = new Set(["Sí", "No"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PriorityProperty = {
  id: string;
  slug: string;
  titulo: string;
  estado: string;
};

export async function POST(req: Request) {
  try {
    const rateLimit = checkRateLimit({
      key: `registro-prioritario:${getClientIp(req)}`,
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse();
    }

    const body = await req.json();
    const propertyId = String(body?.propertyId || "").trim();
    const propertySlug = String(body?.propertySlug || "").trim();
    const name = String(body?.name || "").trim();
    const phone = String(body?.phone || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const rawPurchaseType = String(body?.purchaseType || "").trim();
    const purchaseType = normalizePurchaseType(rawPurchaseType);
    const purchaseOther = String(body?.purchaseOther || "").trim();
    const prequalifiedStatus = String(body?.prequalifiedStatus || "").trim();
    const propertySize = String(body?.propertySize || "").trim();
    const searchRange = String(body?.searchRange || "").trim();
    const wantsVisit = String(body?.wantsVisit || "").trim();
    const additionalInfo = String(body?.additionalInfo || "").trim();

    if (!propertyId || !propertySlug || !name || !phone || !email) {
      console.warn("Priority registration validation failed", {
        reason: "missing_required_contact_fields",
        propertyId,
        propertySlug,
        hasName: Boolean(name),
        hasPhone: Boolean(phone),
        hasEmail: Boolean(email),
      });
      return Response.json(
        { ok: false, error: "Completa los campos requeridos." },
        { status: 400 }
      );
    }

    if (!EMAIL_PATTERN.test(email)) {
      console.warn("Priority registration validation failed", {
        reason: "invalid_email",
        propertyId,
        propertySlug,
      });
      return Response.json(
        { ok: false, error: "Ingresa un email válido." },
        { status: 400 }
      );
    }

    const requiresPrequalifiedStatus = purchaseType === "Financiamiento";
    const requiresPurchaseOther = purchaseType === "Otros (especifique)";

    if (
      !purchaseTypes.has(purchaseType) ||
      !propertySizeOptions.has(propertySize) ||
      !wantsVisitOptions.has(wantsVisit) ||
      !searchRange
    ) {
      console.warn("Priority registration validation failed", {
        reason: "invalid_required_questions",
        propertyId,
        propertySlug,
        rawPurchaseType,
        purchaseType,
        propertySize,
        wantsVisit,
        hasSearchRange: Boolean(searchRange),
      });
      return Response.json(
        { ok: false, error: "Completa las preguntas requeridas." },
        { status: 400 }
      );
    }

    if (requiresPrequalifiedStatus && !prequalifiedStatuses.has(prequalifiedStatus)) {
      console.warn("Priority registration validation failed", {
        reason: "missing_prequalification_status",
        propertyId,
        propertySlug,
        purchaseType,
        prequalifiedStatus,
      });
      return Response.json(
        { ok: false, error: "Indica si ya estás precalificado(a)." },
        { status: 400 }
      );
    }

    if (requiresPurchaseOther && !purchaseOther) {
      console.warn("Priority registration validation failed", {
        reason: "missing_purchase_other",
        propertyId,
        propertySlug,
        purchaseType,
      });
      return Response.json(
        { ok: false, error: "Especifica cómo planeas realizar la compra." },
        { status: 400 }
      );
    }

    const properties = await sql<PriorityProperty[]>`
      SELECT id::text, slug, titulo, estado
      FROM propiedades
      WHERE id = ${propertyId}
        AND slug = ${propertySlug}
      LIMIT 1
    `;
    const property = properties[0];

    if (!property) {
      console.warn("Priority registration property lookup failed", {
        reason: "property_not_found",
        propertyId,
        propertySlug,
      });
      return Response.json(
        { ok: false, error: "No encontramos la propiedad seleccionada." },
        { status: 404 }
      );
    }

    if (property.estado !== "coming_soon") {
      console.warn("Priority registration property not active", {
        propertyId: property.id,
        propertySlug: property.slug,
        estado: property.estado,
      });
      return Response.json(
        { ok: false, error: "El registro prioritario no está activo para esta propiedad." },
        { status: 403 }
      );
    }

    const wantsVisitBoolean = wantsVisit === "Sí";
    const propertyUrl = absoluteUrl(`/listados/${property.slug}`);

    let insertedId = "";
    const canonicalLeadEnabled = isPriorityRegistrationCanonicalLeadEnabled();

    if (canonicalLeadEnabled) {
      try {
        const persisted = await persistPriorityRegistrationWithCanonicalLead({
          propertyId: property.id,
          propertySlug: property.slug,
          name,
          phone,
          email,
          purchaseType,
          purchaseOther: requiresPurchaseOther ? purchaseOther : null,
          prequalifiedStatus: requiresPrequalifiedStatus
            ? prequalifiedStatus
            : null,
          propertySize,
          searchRange,
          wantsVisit: wantsVisitBoolean,
          additionalInfo: additionalInfo || null,
        });

        if (!persisted.created) {
          return duplicateResponse();
        }

        insertedId = persisted.id;
        property.titulo = persisted.property.title;
      } catch (error) {
        if (error instanceof PriorityRegistrationPersistenceError) {
          return Response.json(
            { ok: false, error: error.message },
            { status: error.status }
          );
        }
        logPriorityRegistrationError(
          "Canonical Priority Registration persistence failed",
          error
        );
        throw error;
      }
    } else {
      const duplicate = await sql<{ id: string }[]>`
        SELECT id::text
        FROM property_priority_registrations
        WHERE property_id = ${property.id}
          AND lower(email) = lower(${email})
        LIMIT 1
      `;

      if (duplicate.length > 0) {
        return duplicateResponse();
      }

      try {
        const inserted = await sql<{ id: string }[]>`
          INSERT INTO property_priority_registrations (
            property_id,
            property_slug,
            property_title,
            name,
            phone,
            email,
            purchase_type,
            purchase_other,
            prequalified_status,
            property_size,
            search_range,
            wants_visit,
            additional_info,
            source
          ) VALUES (
            ${property.id},
            ${property.slug},
            ${property.titulo},
            ${name},
            ${phone},
            ${email},
            ${purchaseType},
            ${requiresPurchaseOther ? purchaseOther : null},
            ${requiresPrequalifiedStatus ? prequalifiedStatus : null},
            ${propertySize},
            ${searchRange},
            ${wantsVisitBoolean},
            ${additionalInfo || null},
            'registro_prioritario'
          )
          RETURNING id::text
        `;
        insertedId = inserted[0]?.id || "";
      } catch (error) {
        if (isUniqueViolation(error)) {
          return duplicateResponse();
        }

        if (isUndefinedColumn(error)) {
          logPriorityRegistrationError("Missing priority registration migration columns", error);

          try {
            const inserted = await sql<{ id: string }[]>`
              INSERT INTO property_priority_registrations (
                property_id,
                property_slug,
                property_title,
                name,
                phone,
                email,
                purchase_type,
                prequalified_status,
                search_range,
                wants_visit,
                source
              ) VALUES (
                ${property.id},
                ${property.slug},
                ${property.titulo},
                ${name},
                ${phone},
                ${email},
                ${purchaseType},
                ${requiresPrequalifiedStatus ? prequalifiedStatus : null},
                ${searchRange},
                ${wantsVisitBoolean},
                'registro_prioritario'
              )
              RETURNING id::text
            `;
            insertedId = inserted[0]?.id || "";
          } catch (fallbackError) {
            if (isUniqueViolation(fallbackError)) {
              return duplicateResponse();
            }

            logPriorityRegistrationError("Legacy priority registration insert failed", fallbackError);
            throw fallbackError;
          }
        } else {
          if (isCheckViolation(error)) {
            logPriorityRegistrationError("Priority registration insert check constraint failed", error);
          }
          logPriorityRegistrationError("Priority registration insert failed", error);
          throw error;
        }
      }
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("Priority registration email skipped: Missing RESEND_API_KEY", {
        insertedId,
        propertyId: property.id,
        propertySlug: property.slug,
      });
      return successResponse();
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const toEmail =
      process.env.CONTACT_TO_EMAIL?.trim() || "ericksonrealestatepr@gmail.com";
    const fromEmail =
      process.env.CONTACT_FROM_EMAIL?.trim() || "onboarding@resend.dev";

    const html = `<meta charset="utf-8" />
      <div style="font-family: Arial, Helvetica, sans-serif; color: #111; line-height: 1.6; padding: 24px;">
        <div style="max-width: 680px; margin: 0 auto; border: 1px solid #e8e8e8; border-radius: 18px; overflow: hidden;">
          <div style="background: #11518b; padding: 20px 24px;">
            <h2 style="margin: 0; color: #d4af37; font-size: 22px;">
              Nuevo registro prioritario
            </h2>
            <p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">
              Lead de interés temprano para propiedad próximamente disponible
            </p>
          </div>

          <div style="padding: 24px;">
            <h3 style="margin: 0 0 16px; color: #11518b; font-size: 18px;">
              ${escapeHtml(property.titulo)}
            </h3>
            <p style="margin: 0 0 18px;">
              <strong>URL de la propiedad:</strong>
              <a href="${propertyUrl}" style="color: #11518b;">${propertyUrl}</a>
            </p>

            <p style="margin: 0 0 12px;"><strong>Nombre:</strong> ${escapeHtml(name)}</p>
            <p style="margin: 0 0 12px;"><strong>Teléfono:</strong> ${escapeHtml(phone)}</p>
            <p style="margin: 0 0 12px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p style="margin: 0 0 12px;"><strong>Compra cash o financiado:</strong> ${escapeHtml(purchaseType)}</p>
            ${
              requiresPurchaseOther
                ? `<p style="margin: 0 0 12px;"><strong>Especifique:</strong> ${escapeHtml(purchaseOther)}</p>`
                : ""
            }
            ${
              requiresPrequalifiedStatus
                ? `<p style="margin: 0 0 12px;"><strong>Pre-calificado:</strong> ${escapeHtml(prequalifiedStatus)}</p>`
                : ""
            }
            <p style="margin: 0 0 12px;"><strong>Tamaño de propiedad:</strong> ${escapeHtml(propertySize)}</p>
            <p style="margin: 0 0 12px;"><strong>Rango de búsqueda:</strong> ${escapeHtml(searchRange)}</p>
            <p style="margin: 0 0 12px;"><strong>Interés en visita:</strong> ${escapeHtml(wantsVisit)}</p>
            ${
              additionalInfo
                ? `<p style="margin: 0;"><strong>Información adicional:</strong> ${escapeHtml(additionalInfo)}</p>`
                : ""
            }
          </div>

          <div style="background: #f8f8f8; padding: 20px 24px; border-top: 1px solid #e8e8e8;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              Este es un lead automático desde borikipr.com
            </p>
          </div>
        </div>
      </div>
    `;

    const internalSubject = `Nuevo registro prioritario - ${property.titulo}`;
    const { error } = await resend.emails.send({
      from: `Erickson Real Estate <${fromEmail}>`,
      to: [toEmail],
      replyTo: email,
      subject: internalSubject,
      html,
    });

    if (error) {
      logPriorityRegistrationError("RESEND REGISTRO PRIORITARIO ERROR", error);
      if (isResendLimitError(error)) {
        await safelyQueuePriorityRegistrationEmail({
          recipient: toEmail,
          subject: internalSubject,
          html,
          emailType: "priority_registration_internal",
          relatedPropertyId: property.id,
          relatedLeadId: insertedId || null,
          error,
        });
      }
      return successResponse();
    }

    await safelyRecordPriorityRegistrationEmail({
      recipient: toEmail,
      subject: internalSubject,
      html,
      emailType: "priority_registration_internal",
      relatedPropertyId: property.id,
      relatedLeadId: insertedId || null,
    });

    if (email) {
      const confirmationSubject = "Recibimos tu registro prioritario";
      const confirmationHtml = `<meta charset="utf-8" />
          <div style="font-family: Arial, Helvetica, sans-serif; color: #111; line-height: 1.6; padding: 24px;">
            <div style="max-width: 620px; margin: 0 auto; border: 1px solid #e8e8e8; border-radius: 18px; overflow: hidden;">
              <div style="background: #11518b; padding: 20px 24px;">
                <h2 style="margin: 0; color: #d4af37; font-size: 22px;">Recibimos tu registro prioritario</h2>
              </div>
              <div style="padding: 24px;">
                <p style="margin: 0 0 12px;">Hola ${escapeHtml(name)},</p>
                <p style="margin: 0 0 12px;">Gracias por tu interés. Te notificaremos tan pronto esta propiedad esté disponible.</p>
                <p style="margin: 0;"><strong>Propiedad:</strong> ${escapeHtml(property.titulo)}</p>
              </div>
            </div>
          </div>
        `;
      const confirmation = await resend.emails.send({
        from: `Erickson Real Estate <${fromEmail}>`,
        to: [email],
        subject: confirmationSubject,
        html: confirmationHtml,
      });

      if (confirmation.error) {
        logPriorityRegistrationError(
          "RESEND REGISTRO PRIORITARIO CONFIRMATION ERROR",
          confirmation.error
        );
        if (isResendLimitError(confirmation.error)) {
          await safelyQueuePriorityRegistrationEmail({
            recipient: email,
            subject: confirmationSubject,
            html: confirmationHtml,
            emailType: "priority_registration_confirmation",
            relatedPropertyId: property.id,
            relatedLeadId: insertedId || null,
            error: confirmation.error,
          });
        }
      } else if (insertedId) {
        await safelyRecordPriorityRegistrationEmail({
          recipient: email,
          subject: confirmationSubject,
          html: confirmationHtml,
          emailType: "priority_registration_confirmation",
          relatedPropertyId: property.id,
          relatedLeadId: insertedId,
        });
        try {
          await sql`
            UPDATE property_priority_registrations
            SET confirmation_sent_at = now()
            WHERE id = ${insertedId}
              AND confirmation_sent_at IS NULL
          `;
        } catch (updateError) {
          logPriorityRegistrationError(
            "Priority registration confirmation_sent_at update failed",
            updateError
          );
        }
      }
    }

    return successResponse();
  } catch (error) {
    logPriorityRegistrationError("REGISTRO PRIORITARIO ERROR", error);
    return Response.json(
      { ok: false, error: "No se pudo completar el registro prioritario." },
      { status: 500 }
    );
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizePurchaseType(value: string) {
  switch (value) {
    case "Financiado":
      return "Financiamiento";
    case "Otro (especifique)":
      return "Otros (especifique)";
    default:
      return value;
  }
}

async function safelyRecordPriorityRegistrationEmail(input: {
  recipient: string;
  subject: string;
  html: string;
  emailType: string;
  relatedPropertyId?: string | null;
  relatedLeadId?: string | null;
}) {
  try {
    await recordEmailSent(input);
  } catch (error) {
    logPriorityRegistrationError(
      "Priority registration successful email audit insert failed",
      error
    );
  }
}

function successResponse() {
  return Response.json({
    ok: true,
    success: true,
    duplicate: false,
    message:
      "Gracias. Recibimos tu registro prioritario para esta propiedad.",
  });
}

function duplicateResponse() {
  return Response.json({
    ok: true,
    success: true,
    duplicate: true,
    message: "Ya tenemos tu registro para esta propiedad.",
  });
}

async function safelyQueuePriorityRegistrationEmail({
  recipient,
  subject,
  html,
  emailType,
  relatedPropertyId,
  relatedLeadId,
  error,
}: {
  recipient: string;
  subject: string;
  html: string;
  emailType: string;
  relatedPropertyId?: string | null;
  relatedLeadId?: string | null;
  error: unknown;
}) {
  try {
    await queueEmail({
      recipient,
      subject,
      html,
      emailType,
      relatedPropertyId,
      relatedLeadId,
      lastError: serializeEmailError(error),
    });
  } catch (queueError) {
    logPriorityRegistrationError(
      "Priority registration email queue insert failed",
      queueError
    );
  }
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function isUndefinedColumn(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "42703"
  );
}

function isCheckViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23514"
  );
}

function logPriorityRegistrationError(message: string, error: unknown) {
  if (typeof error === "object" && error !== null) {
    const details = error as {
      code?: unknown;
      column?: unknown;
      constraint_name?: unknown;
      constraint?: unknown;
      table?: unknown;
      message?: unknown;
    };

    console.error(message, {
      code: details.code,
      column: details.column,
      constraint: details.constraint_name ?? details.constraint,
      table: details.table,
      message: details.message,
    });
    return;
  }

  console.error(message, error);
}
