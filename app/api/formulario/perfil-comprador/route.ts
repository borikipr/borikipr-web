import { Resend } from "resend";
import { isR2Configured, uploadImageToR2 } from "@/lib/r2";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { getPropiedadBySlug } from "@/lib/queries/propiedades";
import { handlePersistedPropertyBuyerProfile } from "@/lib/leads/property-buyer-profile-handler";
import { isPropertyBuyerProfilePersistenceEnabled } from "@/lib/leads/property-buyer-profile";
import { buildPropertyBuyerProfileInternalEmail } from "@/lib/leads/property-buyer-profile-email";
import {
  BUYER_PROFILE_FILE_TOO_LARGE_MESSAGE,
  MAX_BUYER_PROFILE_DOCUMENT_BYTES,
} from "@/lib/leads/property-buyer-profile-upload";

export const runtime = "nodejs";

const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOLAR_CONTRACT_ACCEPTANCE_LABELS: Record<string, string> = {
  yes: "Sí",
  no: "No",
};

function getText(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getFile(formData: FormData, key: string) {
  const file = formData.get(key);
  return file instanceof File && file.size > 0 ? file : null;
}

function validateFile(file: File) {
  if (file.size > MAX_BUYER_PROFILE_DOCUMENT_BYTES) {
    return BUYER_PROFILE_FILE_TOO_LARGE_MESSAGE;
  }

  if (!ALLOWED_FILE_TYPES.has(file.type)) {
    return "Solo se aceptan PDF e imágenes JPG, PNG o WebP.";
  }

  return "";
}

export async function POST(req: Request) {
  if (isPropertyBuyerProfilePersistenceEnabled()) {
    return handlePersistedPropertyBuyerProfile(req);
  }

  try {
    const rateLimit = checkRateLimit({
      key: `perfil-comprador:${getClientIp(req)}`,
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse();
    }

    const formData = await req.formData();

    const propertyId = getText(formData, "propertyId");
    const propertySlug = getText(formData, "propertySlug");
    const submittedPropertyTitle = getText(formData, "propertyTitle");
    const nombre = getText(formData, "nombre");
    const telefono = getText(formData, "telefono");
    const email = getText(formData, "email").toLowerCase();
    const metodoCompra = getText(formData, "metodoCompra");
    const metodoCompraOtro = getText(formData, "metodoCompraOtro");
    const institucionFinanciera = getText(formData, "institucionFinanciera");
    const fondosCierre = getText(formData, "fondosCierre");
    const comentarios = getText(formData, "comentarios");
    const solarContractAcceptance = getText(formData, "solarContractAcceptance");

    if (
      !propertyId ||
      !propertySlug ||
      !submittedPropertyTitle ||
      !UUID_PATTERN.test(propertyId)
    ) {
      return Response.json(
        { ok: false, error: "La información de la propiedad no es válida." },
        { status: 400 }
      );
    }

    const property = await getPropiedadBySlug(propertySlug);

    if (!property || property.id !== propertyId) {
      return Response.json(
        { ok: false, error: "No encontramos la propiedad seleccionada." },
        { status: 400 }
      );
    }

    if (property.estado !== "disponible") {
      return Response.json(
        { ok: false, error: "El perfil de comprador no está disponible para esta propiedad." },
        { status: 403 }
      );
    }

    const requiresSolarContractAcceptance = property.placas_en_lease === true;

    if (requiresSolarContractAcceptance) {
      if (!SOLAR_CONTRACT_ACCEPTANCE_LABELS[solarContractAcceptance]) {
        return Response.json(
          {
            ok: false,
            error:
              "Selecciona una respuesta válida sobre el contrato o leasing de las placas solares.",
          },
          { status: 400 }
        );
      }
    } else if (solarContractAcceptance) {
      return Response.json(
        {
          ok: false,
          error: "La respuesta sobre placas solares no aplica a esta propiedad.",
        },
        { status: 400 }
      );
    }

    if (!nombre || !telefono || !metodoCompra) {
      return Response.json(
        { ok: false, error: "Completa los campos requeridos." },
        { status: 400 }
      );
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return Response.json(
          { ok: false, error: "El email no es válido." },
          { status: 400 }
        );
      }
    }

    const cartaFile = getFile(formData, "cartaPreaprobacion");
    if (
      (metodoCompra === "Financiamiento" || metodoCompra === "Cash") &&
      !cartaFile
    ) {
      return Response.json(
        {
          ok: false,
          error:
            metodoCompra === "Financiamiento"
              ? "Adjunta la carta de precalificación requerida."
              : "Adjunta la evidencia de fondos requerida.",
        },
        { status: 400 }
      );
    }
    let uploadNote = "";
    const attachments: {
      filename: string;
      content: string;
      contentType: string;
    }[] = [];

    if (cartaFile) {
      const validationError = validateFile(cartaFile);
      if (validationError) {
        return Response.json({ ok: false, error: validationError }, { status: 400 });
      }

      const attachmentBuffer = Buffer.from(await cartaFile.arrayBuffer());
      attachments.push({
        filename: cartaFile.name || "carta-precalificacion",
        content: attachmentBuffer.toString("base64"),
        contentType: cartaFile.type,
      });

      if (isR2Configured()) {
        await uploadImageToR2(cartaFile, "contact/perfiles-comprador");
      } else {
        uploadNote =
          "Se adjuntó un archivo, pero R2 no está configurado en este ambiente. TODO: habilitar R2 para guardar la carta.";
      }
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY");
      return Response.json(
        { ok: false, error: "Falta configuración del servidor." },
        { status: 500 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const toEmail =
      process.env.CONTACT_TO_EMAIL?.trim() || "ericksonrealestatepr@gmail.com";
    const fromEmail =
      process.env.CONTACT_FROM_EMAIL?.trim() || "onboarding@resend.dev";

    const emailMessage = buildPropertyBuyerProfileInternalEmail({
      profile: {
        nameSnapshot: nombre,
        emailSnapshot: email || null,
        phoneSnapshot: telefono,
        purchaseMethod: metodoCompra as "Financiamiento" | "Cash" | "Otro",
        purchaseMethodOther: metodoCompraOtro || null,
        financialInstitution: institucionFinanciera || null,
        closingFunds: fondosCierre || null,
        solarContractAcceptance: solarContractAcceptance || null,
        comments: comentarios || null,
        documentOriginalName: cartaFile?.name || null,
        property: {
          id: property.id,
          slug: property.slug,
          title: property.titulo,
          municipio: property.municipio,
          sectorComunidad: property.sector_comunidad ?? null,
          status: property.estado,
          hasSolarLease: requiresSolarContractAcceptance,
        },
      },
      documentStatus: cartaFile ? "uploaded" : "none",
    });

    const { data, error } = await resend.emails.send({
      from: `Erickson Real Estate <${fromEmail}>`,
      to: [toEmail],
      replyTo: email || undefined,
      subject: emailMessage.subject,
      html: emailMessage.html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (error) {
      console.error("RESEND PERFIL COMPRADOR ERROR:", error);
      return Response.json(
        { ok: false, error: "No se pudo enviar el mensaje." },
        { status: 500 }
      );
    }

    console.log("Perfil comprador email sent:", data?.id);
    return Response.json({ ok: true, uploadSkipped: Boolean(uploadNote) });
  } catch (error) {
    console.error("API PERFIL COMPRADOR ERROR:", error);
    return Response.json(
      { ok: false, error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
