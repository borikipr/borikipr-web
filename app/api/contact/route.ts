import { Resend } from "resend";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
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
      `Nombre: ${name}`,
      `Email: ${email}`,
      "",
      "Mensaje:",
      message,
    ].join("\n");

    const { data, error } = await resend.emails.send({
      from: `Ivonne Erickson <${fromEmail}>`,
      to: [toEmail],
      subject,
      text,
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