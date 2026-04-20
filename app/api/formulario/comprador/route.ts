import { Resend } from "resend";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const nombre = String(body?.nombre || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const telefono = String(body?.telefono || "").trim();
    const presupuesto = String(body?.presupuesto || "").trim();
    const metodoCompra = String(body?.metodoCompra || "").trim();
    const preAprobado = String(body?.preAprobado || "").trim();
    const municipios = String(body?.municipios || "").trim();
    const tipoPropiedad = Array.isArray(body?.tipoPropiedad)
      ? body.tipoPropiedad.join(", ")
      : String(body?.tipoPropiedad || "").trim();
    const habitaciones = String(body?.habitaciones || "").trim();
    const banos = String(body?.banos || "").trim();
    const comentarios = String(body?.comentarios || "").trim();

    // Validación
    if (!nombre || !telefono) {
      return Response.json(
        { ok: false, error: "Nombre y teléfono son requeridos." },
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

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; color: #111; line-height: 1.6; padding: 24px;">
        <div style="max-width: 640px; margin: 0 auto; border: 1px solid #e8e8e8; border-radius: 18px; overflow: hidden;">
          <div style="background: #11518b; padding: 20px 24px;">
            <h2 style="margin: 0; color: #d4af37; font-size: 22px;">
              Nuevo Lead - Comprador
            </h2>
            <p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">
              Solicitud de orientación para comprar
            </p>
          </div>

          <div style="padding: 24px;">
            <p style="margin: 0 0 12px;"><strong>Nombre:</strong> ${escapeHtml(nombre)}</p>
            <p style="margin: 0 0 12px;"><strong>Email:</strong> ${escapeHtml(email || "No provisto")}</p>
            <p style="margin: 0 0 12px;"><strong>Teléfono:</strong> ${escapeHtml(telefono)}</p>
            <p style="margin: 0 0 12px;"><strong>Presupuesto:</strong> ${escapeHtml(presupuesto || "No especificado")}</p>
            <p style="margin: 0 0 12px;"><strong>Método de compra:</strong> ${escapeHtml(metodoCompra || "No especificado")}</p>
            <p style="margin: 0 0 12px;"><strong>Pre-aprobado:</strong> ${escapeHtml(preAprobado || "No especificado")}</p>
            <p style="margin: 0 0 12px;"><strong>Municipios de interés:</strong> ${escapeHtml(municipios || "No especificado")}</p>
            <p style="margin: 0 0 12px;"><strong>Tipo de propiedad:</strong> ${escapeHtml(tipoPropiedad || "No especificado")}</p>
            <p style="margin: 0 0 12px;"><strong>Habitaciones:</strong> ${escapeHtml(habitaciones || "No especificado")}</p>
            <p style="margin: 0 0 20px;"><strong>Baños:</strong> ${escapeHtml(banos || "No especificado")}</p>

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
      replyTo: email || undefined,
      subject: `Nuevo Lead - Comprador: ${nombre}`,
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
    console.error("API COMPRADOR ERROR:", error);
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
