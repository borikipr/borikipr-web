import { Resend } from "resend";
import { isR2Configured, uploadImageToR2 } from "@/lib/r2";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_FILE_SIZE_MB = 10;
const MAX_ATTACHMENT_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
]);

function getText(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getFile(formData: FormData, key: string) {
  const file = formData.get(key);
  return file instanceof File && file.size > 0 ? file : null;
}

function validateFile(file: File) {
  if (!ALLOWED_FILE_TYPES.has(file.type)) {
    return "Solo se aceptan PDF e imágenes JPG, PNG o WebP.";
  }

  return "";
}

export async function POST(req: Request) {
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

    const nombre = getText(formData, "nombre");
    const telefono = getText(formData, "telefono");
    const email = getText(formData, "email").toLowerCase();
    const metodoCompra = getText(formData, "metodoCompra");
    const metodoCompraOtro = getText(formData, "metodoCompraOtro");
    const institucionFinanciera = getText(formData, "institucionFinanciera");
    const evidenciaFondos = getText(formData, "evidenciaFondos");
    const fondosCierre = getText(formData, "fondosCierre");
    const trabajaConCorredor = getText(formData, "trabajaConCorredor");
    const nombreCorredor = getText(formData, "nombreCorredor");
    const telefonoCorredor = getText(formData, "telefonoCorredor");
    const comentarios = getText(formData, "comentarios");
    const cartaFile = getFile(formData, "cartaPreaprobacion");

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

    let cartaUrl = "";
    let uploadNote = "";
    let attachmentNote = "";
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

      if (cartaFile.size <= MAX_ATTACHMENT_SIZE_BYTES) {
        const attachmentBuffer = Buffer.from(await cartaFile.arrayBuffer());
        attachments.push({
          filename: cartaFile.name || "carta-precalificacion",
          content: attachmentBuffer.toString("base64"),
          contentType: cartaFile.type,
        });
      } else {
        attachmentNote = `El archivo excede ${MAX_FILE_SIZE_MB}MB y no se adjuntó al correo. Usa el enlace de respaldo.`;
      }

      if (isR2Configured()) {
        cartaUrl = await uploadImageToR2(cartaFile, "contact/perfiles-comprador");
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

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; color: #111; line-height: 1.6; padding: 24px;">
        <div style="max-width: 680px; margin: 0 auto; border: 1px solid #e8e8e8; border-radius: 18px; overflow: hidden;">
          <div style="background: #11518b; padding: 20px 24px;">
            <h2 style="margin: 0; color: #d4af37; font-size: 22px;">
              Perfil del Cliente Comprador
            </h2>
            <p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">
              Formulario compartido por Ivonne Erickson para continuar el proceso de orientación y coordinar posibles visitas.
            </p>
          </div>

          <div style="padding: 24px;">
            <h3 style="margin: 0 0 12px;">Información de contacto</h3>
            <p style="margin: 0 0 12px;"><strong>Nombre:</strong> ${escapeHtml(nombre)}</p>
            <p style="margin: 0 0 12px;"><strong>Teléfono:</strong> ${escapeHtml(telefono)}</p>
            <p style="margin: 0 0 20px;"><strong>Email:</strong> ${escapeHtml(email || "No provisto")}</p>

            <h3 style="margin: 20px 0 12px;">Método de compra</h3>
            <p style="margin: 0 0 12px;"><strong>Método:</strong> ${escapeHtml(metodoCompra)}</p>
            <p style="margin: 0 0 12px;"><strong>Método/programa especificado:</strong> ${escapeHtml(metodoCompraOtro || "No especificado")}</p>
            <p style="margin: 0 0 12px;"><strong>Institución financiera:</strong> ${escapeHtml(institucionFinanciera || "No especificado")}</p>
            <p style="margin: 0 0 12px;"><strong>Evidencia de fondos:</strong> ${escapeHtml(evidenciaFondos || "No especificado")}</p>
            ${cartaFile ? `
              <p style="margin: 0 0 12px;"><strong>Carta de precalificación:</strong> ${
                attachments.length > 0 ? "Adjunta en este correo." : escapeHtml(attachmentNote || "No adjunta.")
              }</p>
              ${attachmentNote ? `<p style="margin: 0 0 12px; color: #7a4a00;">${escapeHtml(attachmentNote)}</p>` : ""}
              <p style="margin: 0 0 20px;"><strong>Enlace de respaldo:</strong> ${
                cartaUrl
                  ? `<a href="${escapeHtml(cartaUrl)}">${escapeHtml(cartaUrl)}</a>`
                  : escapeHtml(uploadNote || "No disponible")
              }</p>
            ` : `
              <p style="margin: 0 0 20px;"><strong>Carta de precalificación:</strong> No provista</p>
            `}

            <h3 style="margin: 20px 0 12px;">Preparación financiera</h3>
            <p style="margin: 0 0 20px;"><strong>Fondos para pronto y cierre:</strong> ${escapeHtml(fondosCierre || "No especificado")}</p>

            <h3 style="margin: 20px 0 12px;">Información adicional</h3>
            <p style="margin: 0 0 12px;"><strong>Trabaja con otro corredor/realtor:</strong> ${escapeHtml(trabajaConCorredor || "No especificado")}</p>
            ${trabajaConCorredor === "Sí" ? `
              <p style="margin: 0 0 12px;"><strong>Nombre del corredor/realtor:</strong> ${escapeHtml(nombreCorredor || "No especificado")}</p>
              <p style="margin: 0 0 12px;"><strong>Teléfono del corredor/realtor:</strong> ${escapeHtml(telefonoCorredor || "No especificado")}</p>
            ` : ""}
            ${comentarios ? `
              <p style="margin: 0 0 10px; font-weight: 700;">Comentarios adicionales:</p>
              <p style="margin: 0; color: #4d4d4d; white-space: pre-line;">${escapeHtml(comentarios)}</p>
            ` : ""}
          </div>

          <div style="background: #f8f8f8; padding: 20px 24px; border-top: 1px solid #e8e8e8;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              Este es un lead automático desde borikipr.com/contact/perfil-comprador
            </p>
          </div>
        </div>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: `Erickson Real Estate <${fromEmail}>`,
      to: [toEmail],
      replyTo: email || undefined,
      subject: `Perfil del Cliente Comprador: ${nombre}`,
      html,
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
