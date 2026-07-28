import { Resend } from "resend";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const rateLimit = await checkRateLimit({
      key: `contact:${getClientIp(req)}`,
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse();
    }

    const body = await req.json();

    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const telefono = String(body?.telefono || "").trim();
    const message = String(body?.message || "").trim();
    const lang = String(body?.lang || "es").trim();

    if (!name || !email || !message) {
      return Response.json(
        { ok: false, error: "Faltan campos requeridos." },
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

    const subject =
      lang === "en"
        ? "New message from borikipr.com"
        : "Nuevo mensaje desde borikipr.com";

    const text = [
      "Nuevo lead desde borikipr.com",
      "",
      `Nombre: ${name}`,
      `Email: ${email}`,
      `Teléfono: ${telefono || "No provisto"}`,
      "",
      "Mensaje:",
      message,
    ].join("\n");

    const html = `<meta charset="utf-8" />
      <div style="font-family: Arial, Helvetica, sans-serif; color: #111; line-height: 1.6; padding: 24px;">
        <div style="max-width: 640px; margin: 0 auto; border: 1px solid #e8e8e8; border-radius: 18px; overflow: hidden;">
          <div style="background: #0d1b2a; padding: 20px 24px;">
            <h2 style="margin: 0; color: #d4af37; font-size: 22px;">
              Erickson Real Estate
            </h2>
            <p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">
              Nuevo mensaje desde borikipr.com
            </p>
          </div>

          <div style="padding: 24px;">
            <p style="margin: 0 0 12px;"><strong>Nombre:</strong> ${escapeHtml(name)}</p>
            <p style="margin: 0 0 12px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p style="margin: 0 0 20px;"><strong>Teléfono:</strong> ${escapeHtml(
              telefono || "No provisto"
            )}</p>

            <div style="border-top: 1px solid #ececec; padding-top: 20px;">
              <p style="margin: 0 0 10px; font-weight: 700;">Mensaje:</p>
              <p style="margin: 0; color: #4d4d4d; white-space: pre-line;">${escapeHtml(
                message
              )}</p>
            </div>
          </div>
        </div>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: `Ivonne Erickson <${fromEmail}>`,
      to: [toEmail],
      subject,
      text,
      html,
      replyTo: email,
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
    console.error("API CONTACT ERROR:", error);
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
