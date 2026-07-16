import type { OpenHouseDocumentStatus } from "./open-house-registration";
import type { PersistedOpenHouseRegistration } from "./postgres-open-house-registration";

export function buildOpenHouseInternalEmail({
  registration,
  documentStatus,
}: {
  registration: PersistedOpenHouseRegistration;
  documentStatus: OpenHouseDocumentStatus;
}) {
  const propertyUrl = buildPropertyUrl(registration.property.slug);
  const brokerDetails =
    registration.workingWithBroker === "Sí"
      ? `<p style="margin:0 0 12px"><strong>Corredor:</strong> ${escapeHtml(registration.brokerName || "No provisto")}</p>
         <p style="margin:0 0 12px"><strong>Teléfono del corredor:</strong> ${escapeHtml(registration.brokerPhone || "No provisto")}</p>`
      : "";
  const customAnswer = registration.customQuestion
    ? `<p style="margin:0 0 8px"><strong>${escapeHtml(registration.customQuestion)}</strong></p>
       <p style="margin:0 0 20px;white-space:pre-line">${escapeHtml(registration.customAnswer || "No provisto")}</p>`
    : "";

  return {
    subject: `Nuevo registro de Open House - ${registration.property.title}`,
    html: emailShell(
      "Nuevo registro de Open House / Showing",
      `<h3 style="margin:0 0 12px">Propiedad y evento</h3>
       <p style="margin:0 0 12px"><strong>Propiedad:</strong> ${escapeHtml(registration.property.title)}</p>
       <p style="margin:0 0 12px"><strong>Fecha:</strong> ${escapeHtml(formatPuertoRicoDate(registration.showingAt))}</p>
       <p style="margin:0 0 20px"><strong>Enlace:</strong> <a href="${escapeHtml(propertyUrl)}">${escapeHtml(propertyUrl)}</a></p>
       <h3 style="margin:0 0 12px">Contacto</h3>
       <p style="margin:0 0 12px"><strong>Nombre:</strong> ${escapeHtml(registration.name)}</p>
       <p style="margin:0 0 12px"><strong>Teléfono:</strong> ${escapeHtml(registration.phone)}</p>
       <p style="margin:0 0 20px"><strong>Email:</strong> ${escapeHtml(registration.email || "No provisto")}</p>
       <h3 style="margin:0 0 12px">Perfil</h3>
       <p style="margin:0 0 12px"><strong>Método de compra:</strong> ${escapeHtml(registration.purchaseMethod)}</p>
       <p style="margin:0 0 12px"><strong>Disponibilidad:</strong> ${escapeHtml(registration.attendanceAvailability)}</p>
       <p style="margin:0 0 12px"><strong>Fondos de cierre:</strong> ${escapeHtml(registration.closingFunds || "No especificado")}</p>
       <p style="margin:0 0 12px"><strong>Trabaja con corredor:</strong> ${escapeHtml(registration.workingWithBroker)}</p>
       ${brokerDetails}
       <p style="margin:0 0 20px"><strong>Documento:</strong> ${escapeHtml(documentStatusLabel(documentStatus))}</p>
       ${customAnswer}`
    ),
  };
}

function emailShell(title: string, body: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.6;padding:24px">
    <div style="max-width:680px;margin:0 auto;border:1px solid #e8e8e8;border-radius:18px;overflow:hidden">
      <div style="background:#11518b;padding:20px 24px">
        <h2 style="margin:0;color:#d4af37;font-size:22px">${escapeHtml(title)}</h2>
        <p style="margin:6px 0 0;color:rgba(255,255,255,.85);font-size:14px">Erickson Real Estate</p>
      </div>
      <div style="padding:24px">${body}</div>
      <div style="background:#f8f8f8;padding:20px 24px;border-top:1px solid #e8e8e8">
        <p style="margin:0;font-size:12px;color:#666">Erickson Real Estate · Puerto Rico</p>
      </div>
    </div>
  </div>`;
}

function buildPropertyUrl(slug: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://borikipr.com";
  return `${base}/listados/${slug}`;
}

function formatPuertoRicoDate(value: Date) {
  return new Intl.DateTimeFormat("es-PR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Puerto_Rico",
  }).format(value);
}

function documentStatusLabel(status: OpenHouseDocumentStatus) {
  if (status === "uploaded") return "Documento cargado";
  if (status === "failed") return "La carga del documento falló";
  if (status === "pending") return "Carga pendiente";
  return "Sin documento";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
