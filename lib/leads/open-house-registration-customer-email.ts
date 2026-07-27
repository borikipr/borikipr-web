import type { PersistedOpenHouseRegistration } from "./postgres-open-house-registration";

export function buildOpenHouseCustomerEmail(
  registration: PersistedOpenHouseRegistration
) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://borikipr.com";
  const propertyUrl = `${base}/listados/${registration.property.slug}`;
  const showingDate = new Intl.DateTimeFormat("es-PR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Puerto_Rico",
  }).format(registration.showingAt);

  return {
    subject: `Confirmación de registro - ${registration.property.title}`,
    html: `<meta charset="utf-8" /><div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.6;padding:24px">
      <div style="max-width:680px;margin:0 auto;border:1px solid #e8e8e8;border-radius:18px;overflow:hidden">
        <div style="background:#11518b;padding:20px 24px">
          <h2 style="margin:0;color:#d4af37;font-size:22px">Confirmación de registro</h2>
          <p style="margin:6px 0 0;color:rgba(255,255,255,.85);font-size:14px">Erickson Real Estate</p>
        </div>
        <div style="padding:24px">
          <p style="margin:0 0 16px">Recibimos tu confirmación de asistencia al Open House.</p>
          <p style="margin:0 0 12px"><strong>Propiedad:</strong> ${escapeHtml(registration.property.title)}</p>
          <p style="margin:0 0 12px"><strong>Fecha:</strong> ${escapeHtml(showingDate)}</p>
          <p style="margin:0 0 20px"><a href="${escapeHtml(propertyUrl)}">Ver la propiedad</a></p>
          <p style="margin:0">Erickson Real Estate se comunicará contigo si necesita información adicional.</p>
        </div>
        <div style="background:#f8f8f8;padding:20px 24px;border-top:1px solid #e8e8e8">
          <p style="margin:0;font-size:12px;color:#666">Erickson Real Estate · Puerto Rico</p>
        </div>
      </div>
    </div>`,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
