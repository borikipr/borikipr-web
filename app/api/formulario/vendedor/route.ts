import { Resend } from "resend";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { handlePersistedSellerLandlordInquiry } from "@/lib/leads/seller-landlord-inquiry-handler";
import { isSellerLandlordPersistenceEnabled } from "@/lib/leads/seller-landlord-inquiry";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (isSellerLandlordPersistenceEnabled()) {
    return handlePersistedSellerLandlordInquiry(req);
  }

  try {
    const rateLimit = await checkRateLimit({
      key: `formulario-vendedor:${getClientIp(req)}`,
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse();
    }

    const body = await req.json();

    const nombre = String(body?.nombre || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const telefono = String(body?.telefono || "").trim();
    const tipoPropiedad = String(body?.tipoPropiedad || "").trim();
    const ubicacion = String(body?.ubicacion || "").trim();
    const razonVenta = String(body?.razonVenta || "").trim();
    const comentarios = String(body?.comentarios || "").trim();

    // Validación
    if (!nombre || !email || !telefono) {
      return Response.json(
        { ok: false, error: "Nombre, email y teléfono son requeridos." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json(
        { ok: false, error: "El email no es válido." },
        { status: 400 }
      );
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

    const html = `<meta charset="utf-8" />
      <div style="font-family: Arial, Helvetica, sans-serif; color: #111; line-height: 1.6; padding: 24px;">
        <div style="max-width: 640px; margin: 0 auto; border: 1px solid #e8e8e8; border-radius: 18px; overflow: hidden;">
          <div style="background: #11518b; padding: 20px 24px;">
            <h2 style="margin: 0; color: #d4af37; font-size: 22px;">
              Nueva solicitud de vendedor o arrendador
            </h2>
            <p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">
              Orientación para vender o alquilar una propiedad
            </p>
          </div>

          <div style="padding: 24px;">
            <p style="margin: 0 0 12px;"><strong>Nombre:</strong> ${escapeHtml(nombre)}</p>
            <p style="margin: 0 0 12px;"><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
            <p style="margin: 0 0 12px;"><strong>Teléfono:</strong> ${escapeHtml(telefono)}</p>
            ${tipoPropiedad ? `<p style="margin: 0 0 12px;"><strong>Tipo de propiedad:</strong> ${escapeHtml(tipoPropiedad)}</p>` : ""}
            ${ubicacion ? `<p style="margin: 0 0 12px;"><strong>Ubicación (Municipio):</strong> ${escapeHtml(ubicacion)}</p>` : ""}
            ${razonVenta ? `<p style="margin: 0 0 20px;"><strong>Interés principal:</strong> ${escapeHtml(razonVenta)}</p>` : ""}

            ${comentarios ? `
            <div style="border-top: 1px solid #ececec; padding-top: 20px;">
              <p style="margin: 0 0 10px; font-weight: 700;">Comentarios adicionales:</p>
              <p style="margin: 0; color: #4d4d4d; white-space: pre-line;">${escapeHtml(comentarios)}</p>
            </div>
            ` : ''}
          </div>

          <div style="background: #f8f8f8; padding: 20px 24px; border-top: 1px solid #e8e8e8;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              Este es un lead automático desde borikipr.com
            </p>
          </div>
        </div>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: `Erickson Real Estate <${fromEmail}>`,
      to: [toEmail],
      replyTo: email,
      subject: `Nueva solicitud de vendedor o arrendador`,
      html,
    });

    if (error) {
      console.error("RESEND ERROR:", error);
      return Response.json(
        { ok: false, error: "No se pudo enviar el mensaje." },
        { status: 500 }
      );
    }

    console.log("Email sent successfully:", data?.id);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("API VENDEDOR ERROR:", error);
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
