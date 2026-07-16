import type { PersistedBuyerTenantInquiry } from "./postgres-buyer-tenant-inquiry";

export function buildBuyerTenantInternalEmail(
  inquiry: PersistedBuyerTenantInquiry
) {
  const propertyTypes = inquiry.propertyTypes?.join(", ") || "No especificado";

  return {
    subject: "Nuevo registro de comprador o arrendatario",
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; color: #111; line-height: 1.6; padding: 24px;">
        <div style="max-width: 640px; margin: 0 auto; border: 1px solid #e8e8e8; border-radius: 18px; overflow: hidden;">
          <div style="background: #11518b; padding: 20px 24px;">
            <h2 style="margin: 0; color: #d4af37; font-size: 22px;">
              Nuevo registro de comprador o arrendatario
            </h2>
            <p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">
              Registro de comprador o arrendatario activo
            </p>
          </div>

          <div style="padding: 24px;">
            <p style="margin: 0 0 12px;"><strong>Nombre:</strong> ${escapeHtml(inquiry.nameSnapshot)}</p>
            <p style="margin: 0 0 12px;"><strong>Email:</strong> ${escapeHtml(inquiry.emailSnapshot || "No provisto")}</p>
            <p style="margin: 0 0 12px;"><strong>Teléfono:</strong> ${escapeHtml(inquiry.phoneSnapshot)}</p>
            <p style="margin: 0 0 12px;"><strong>Municipios de interés:</strong> ${escapeHtml(inquiry.municipalities || "No especificado")}</p>
            <p style="margin: 0 0 12px;"><strong>Interés principal:</strong> ${escapeHtml(inquiry.primaryInterest || "No especificado")}</p>
            ${inquiry.primaryInterest === "Comprar" ? `
              <p style="margin: 0 0 12px;"><strong>Cualificación para compra:</strong> ${escapeHtml(inquiry.purchaseQualification || "No especificado")}</p>
            ` : ""}
            <p style="margin: 0 0 12px;"><strong>Tipo de propiedad:</strong> ${escapeHtml(propertyTypes)}</p>
            <p style="margin: 0 0 12px;"><strong>Presupuesto de compra o alquiler:</strong> ${escapeHtml(inquiry.budget || "No especificado")}</p>
            <p style="margin: 0 0 12px;"><strong>Habitaciones:</strong> ${escapeHtml(inquiry.bedrooms || "No especificado")}</p>
            <p style="margin: 0 0 20px;"><strong>Baños:</strong> ${escapeHtml(inquiry.bathrooms || "No especificado")}</p>

            ${inquiry.comments ? `
            <div style="border-top: 1px solid #ececec; padding-top: 20px;">
              <p style="margin: 0 0 10px; font-weight: 700;">Comentarios adicionales:</p>
              <p style="margin: 0; color: #4d4d4d; white-space: pre-line;">${escapeHtml(inquiry.comments)}</p>
            </div>
            ` : ""}
          </div>

          <div style="background: #f8f8f8; padding: 20px 24px; border-top: 1px solid #e8e8e8;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              Este es un lead automático desde borikipr.com/contact/compradores-arrendatarios
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
