import type { PersistedSellerLandlordInquiry } from "./postgres-seller-landlord-inquiry";

export function buildSellerLandlordInternalEmail(
  inquiry: PersistedSellerLandlordInquiry
) {
  return {
    subject: "Nueva solicitud de vendedor o arrendador",
    html: `<meta charset="utf-8" />
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
            ${detailRow("Nombre", inquiry.nameSnapshot)}
            ${detailRow("Email", inquiry.emailSnapshot)}
            ${detailRow("Teléfono", inquiry.phoneSnapshot)}
            ${detailRow("Tipo de propiedad", inquiry.propertyType)}
            ${detailRow("Ubicación (Municipio)", inquiry.location)}
            ${detailRow("Interés principal", inquiry.primaryReason, "20px")}

            ${inquiry.comments ? `
            <div style="border-top: 1px solid #ececec; padding-top: 20px;">
              <p style="margin: 0 0 10px; font-weight: 700;">Comentarios adicionales:</p>
              <p style="margin: 0; color: #4d4d4d; white-space: pre-line;">${escapeHtml(inquiry.comments)}</p>
            </div>
            ` : ""}
          </div>

          <div style="background: #f8f8f8; padding: 20px 24px; border-top: 1px solid #e8e8e8;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              Este es un lead automático desde borikipr.com/contact/vendedor-arrendador
            </p>
          </div>
        </div>
      </div>
    `,
  };
}

function detailRow(label: string, value: string | null | undefined, bottom = "12px") {
  if (!value?.trim()) return "";
  return `<p style="margin: 0 0 ${bottom};"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
