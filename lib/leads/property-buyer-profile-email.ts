import { formatPropertyLocation } from "@/lib/puerto-rico-sectores";
import { absoluteUrl } from "@/lib/seo";
import type { BuyerProfileDocumentStatus } from "./property-buyer-profile";
import type { PersistedPropertyBuyerProfile } from "./postgres-property-buyer-profile";

const SOLAR_LABELS: Record<string, string> = {
  yes: "Sí",
  no: "No",
};

export type PropertyBuyerProfileEmailInput = Pick<
  PersistedPropertyBuyerProfile,
  | "nameSnapshot"
  | "emailSnapshot"
  | "phoneSnapshot"
  | "purchaseMethod"
  | "purchaseMethodOther"
  | "financialInstitution"
  | "closingFunds"
  | "solarContractAcceptance"
  | "comments"
  | "documentOriginalName"
  | "property"
>;

export function buildPropertyBuyerProfileInternalEmail({
  profile,
  documentStatus,
  correctedResend = false,
}: {
  profile: PropertyBuyerProfileEmailInput;
  documentStatus: BuyerProfileDocumentStatus;
  correctedResend?: boolean;
}) {
  const property = profile.property;
  const propertyLocation = formatPropertyLocation(
    property.municipio,
    property.sectorComunidad
  );
  const propertyUrl = absoluteUrl(
    `/listados/${property.slug}/perfil-comprador`
  );
  const financingDetails = [
    profile.purchaseMethod === "Financiamiento" &&
    profile.financialInstitution
      ? detailRow("Institución financiera", profile.financialInstitution)
      : "",
    profile.purchaseMethod === "Otro" && profile.purchaseMethodOther
      ? detailRow("Método/programa especificado", profile.purchaseMethodOther)
      : "",
  ].join("");
  const solarDetails =
    property.hasSolarLease && profile.solarContractAcceptance
      ? detailRow(
          "Disposición para asumir contrato o leasing de placas solares",
          SOLAR_LABELS[profile.solarContractAcceptance] ||
            profile.solarContractAcceptance
        )
      : "";
  const documentDetails = buildDocumentDetails(profile, documentStatus);
  const financialSection = profile.closingFunds
    ? section(
        "Preparación financiera",
        detailRow("Fondos para pronto y cierre", profile.closingFunds)
      )
    : "";
  const commentsSection = profile.comments
    ? section(
        "Información adicional",
        `<p style="margin: 0 0 10px; font-weight: 700;">Comentarios adicionales:</p>
         <p style="margin: 0; color: #4d4d4d; white-space: pre-line;">${escapeHtml(profile.comments)}</p>`
      )
    : "";
  const optionalEmail = profile.emailSnapshot
    ? detailRow("Email", profile.emailSnapshot, true)
    : "";

  return {
    subject: correctedResend
      ? `Reenvío corregido — Perfil del Cliente Comprador — ${profile.nameSnapshot}`
      : `Perfil del Cliente Comprador - ${property.title}: ${profile.nameSnapshot}`,
    html: `<!doctype html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Perfil del Cliente Comprador</title>
      </head>
      <body style="margin: 0; padding: 0;">
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
            ${section(
              "Propiedad",
              `${detailRow("Título", property.title)}
               ${detailRow("Ubicación", propertyLocation)}
               <p style="margin: 0 0 20px;"><strong>Enlace:</strong> <a href="${escapeHtml(propertyUrl)}">${escapeHtml(propertyUrl)}</a></p>`,
              true
            )}

            ${section(
              "Información de contacto",
              `${detailRow("Nombre", profile.nameSnapshot)}
               ${detailRow("Teléfono", profile.phoneSnapshot)}
               ${optionalEmail}`,
              true
            )}

            ${section(
              "Método de compra",
              `${detailRow("Método", profile.purchaseMethod)}
               ${financingDetails}
               ${solarDetails}
               ${documentDetails}`
            )}

            ${financialSection}
            ${commentsSection}
          </div>

          <div style="background: #f8f8f8; padding: 20px 24px; border-top: 1px solid #e8e8e8;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              Este es un lead automático desde borikipr.com/listados/${escapeHtml(property.slug)}/perfil-comprador
            </p>
          </div>
        </div>
      </div>
      </body>
      </html>`,
  };
}

function buildDocumentDetails(
  profile: PropertyBuyerProfileEmailInput,
  status: BuyerProfileDocumentStatus
) {
  if (
    !["Financiamiento", "Cash"].includes(profile.purchaseMethod) ||
    status === "none" ||
    !profile.documentOriginalName
  ) {
    return "";
  }

  const label =
    profile.purchaseMethod === "Cash"
      ? "Evidencia de fondos"
      : "Carta de precalificación";
  const statusText =
    status === "uploaded"
      ? "Se adjunta a este correo."
      : status === "failed"
        ? "No se pudo adjuntar; requiere revisión."
        : "Pendiente de procesamiento.";

  return `<p style="margin: 0 0 12px;"><strong>${label}:</strong> ${escapeHtml(profile.documentOriginalName)}</p>
          <p style="margin: 0 0 12px;"><strong>Estado del documento:</strong> ${statusText}</p>`;
}

function section(title: string, content: string, first = false) {
  if (!content.trim()) return "";
  return `<h3 style="margin: ${first ? "0" : "20px"} 0 12px;">${title}</h3>
          ${content}`;
}

function detailRow(label: string, value: string, last = false) {
  return `<p style="margin: 0 0 ${last ? "20px" : "12px"};"><strong>${label}:</strong> ${escapeHtml(value)}</p>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
