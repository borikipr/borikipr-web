import { formatPropertyLocation } from "@/lib/puerto-rico-sectores";
import { absoluteUrl } from "@/lib/seo";
import {
  documentStatusLabel,
  type BuyerProfileDocumentStatus,
} from "./property-buyer-profile";
import type { PersistedPropertyBuyerProfile } from "./postgres-property-buyer-profile";

const SOLAR_LABELS: Record<string, string> = {
  yes: "SÃ­",
  no: "No",
};

export function buildPropertyBuyerProfileInternalEmail({
  profile,
  documentStatus,
}: {
  profile: PersistedPropertyBuyerProfile;
  documentStatus: BuyerProfileDocumentStatus;
}) {
  const property = profile.property;
  const propertyLocation = formatPropertyLocation(
    property.municipio,
    property.sectorComunidad
  );
  const propertyUrl = absoluteUrl(
    `/listados/${property.slug}/perfil-comprador`
  );
  const solarAnswer = profile.solarContractAcceptance
    ? SOLAR_LABELS[profile.solarContractAcceptance] || "No especificado"
    : "No aplica";
  const documentLabel =
    profile.purchaseMethod === "Cash"
      ? "Evidencia de fondos"
      : "Carta de precalificaciÃ³n";

  return {
    subject: `Perfil del Cliente Comprador - ${property.title}: ${profile.nameSnapshot}`,
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; color: #111; line-height: 1.6; padding: 24px;">
        <div style="max-width: 680px; margin: 0 auto; border: 1px solid #e8e8e8; border-radius: 18px; overflow: hidden;">
          <div style="background: #11518b; padding: 20px 24px;">
            <h2 style="margin: 0; color: #d4af37; font-size: 22px;">
              Perfil del Cliente Comprador
            </h2>
            <p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">
              Formulario compartido por Ivonne Erickson para continuar el proceso de orientaciÃ³n y coordinar posibles visitas.
            </p>
          </div>

          <div style="padding: 24px;">
            <h3 style="margin: 0 0 12px;">Propiedad</h3>
            <p style="margin: 0 0 12px;"><strong>TÃ­tulo:</strong> ${escapeHtml(property.title)}</p>
            <p style="margin: 0 0 12px;"><strong>UbicaciÃ³n:</strong> ${escapeHtml(propertyLocation)}</p>
            <p style="margin: 0 0 20px;"><strong>Enlace:</strong> <a href="${escapeHtml(propertyUrl)}">${escapeHtml(propertyUrl)}</a></p>

            <h3 style="margin: 0 0 12px;">InformaciÃ³n de contacto</h3>
            <p style="margin: 0 0 12px;"><strong>Nombre:</strong> ${escapeHtml(profile.nameSnapshot)}</p>
            <p style="margin: 0 0 12px;"><strong>TelÃ©fono:</strong> ${escapeHtml(profile.phoneSnapshot)}</p>
            <p style="margin: 0 0 20px;"><strong>Email:</strong> ${escapeHtml(profile.emailSnapshot || "No provisto")}</p>

            <h3 style="margin: 20px 0 12px;">MÃ©todo de compra</h3>
            <p style="margin: 0 0 12px;"><strong>MÃ©todo:</strong> ${escapeHtml(profile.purchaseMethod)}</p>
            <p style="margin: 0 0 12px;"><strong>MÃ©todo/programa especificado:</strong> ${escapeHtml(profile.purchaseMethodOther || "No especificado")}</p>
            <p style="margin: 0 0 12px;"><strong>InstituciÃ³n financiera:</strong> ${escapeHtml(profile.financialInstitution || "No especificado")}</p>
            ${property.hasSolarLease ? `
              <p style="margin: 0 0 12px;"><strong>DisposiciÃ³n para asumir contrato o leasing de placas solares:</strong> ${escapeHtml(solarAnswer)}</p>
            ` : ""}
            <p style="margin: 0 0 20px;"><strong>${escapeHtml(documentLabel)}:</strong> ${escapeHtml(documentStatusLabel(documentStatus))}</p>

            <h3 style="margin: 20px 0 12px;">PreparaciÃ³n financiera</h3>
            <p style="margin: 0 0 20px;"><strong>Fondos para pronto y cierre:</strong> ${escapeHtml(profile.closingFunds || "No especificado")}</p>

            <h3 style="margin: 20px 0 12px;">InformaciÃ³n adicional</h3>
            ${profile.comments ? `
              <p style="margin: 0 0 10px; font-weight: 700;">Comentarios adicionales:</p>
              <p style="margin: 0; color: #4d4d4d; white-space: pre-line;">${escapeHtml(profile.comments)}</p>
            ` : ""}
          </div>

          <div style="background: #f8f8f8; padding: 20px 24px; border-top: 1px solid #e8e8e8;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              Este es un lead automÃ¡tico desde borikipr.com/listados/${escapeHtml(property.slug)}/perfil-comprador
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
