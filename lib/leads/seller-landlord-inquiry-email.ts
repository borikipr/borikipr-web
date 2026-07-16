import type { PersistedSellerLandlordInquiry } from "./postgres-seller-landlord-inquiry";

export function buildSellerLandlordInternalEmail(
  inquiry: PersistedSellerLandlordInquiry
) {
  return {
    subject: "Nueva solicitud de vendedor o arrendador",
    html: `
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
            <p style="margin: 0 0 12px;"><strong>Nombre:</strong> ${escapeHtml(inquiry.nameSnapshot)}</p>
            <p style="margin: 0 0 12px;"><strong>Email:</strong> <a href="mailto:${escapeHtml(inquiry.emailSnapshot)}">${escapeHtml(inquiry.emailSnapshot)}</a></p>
            <p style="margin: 0 0 12px;"><strong>Teléfono:</strong> ${escapeHtml(inquiry.phoneSnapshot)}</p>
            <p style="margin: 0 0 12px;"><strong>Tipo de propiedad:</strong> ${escapeHtml(inquiry.propertyType || "No especificado")}</p>
            <p style="margin: 0 0 12px;"><strong>Ubicación (Municipio):</strong> ${escapeHtml(inquiry.location || "No especificado")}</p>
            <p style="margin: 0 0 20px;"><strong>Interés principal:</strong> ${escapeHtml(inquiry.primaryReason || "No especificado")}</p>

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
