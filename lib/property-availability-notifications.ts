import { normalizeEmail } from "@/lib/leads/normalization";
import { absoluteUrl } from "@/lib/seo";

export const PROPERTY_AVAILABILITY_EMAIL_TYPE =
  "priority_registration_availability";
export const PROPERTY_AVAILABILITY_SUBMISSION_TYPE =
  "property_priority_registration";

export type AvailabilityProperty = {
  id: string;
  slug: string;
  title: string;
};

export type AvailabilityRegistration = {
  id: string;
  leadId: string | null;
  name: string;
  email: string;
};

export function buildPropertyAvailabilityDedupeKey(
  propertyId: string,
  registrationId: string
) {
  return `property_availability:${propertyId}:${registrationId}:v1`;
}

export function isEligibleAvailabilityEmail(email: string) {
  return normalizeEmail(email) !== null;
}

export function buildPropertyAvailabilityEmail({
  property,
  registration,
}: {
  property: AvailabilityProperty;
  registration: AvailabilityRegistration;
}) {
  const propertyUrl = absoluteUrl(`/listados/${property.slug}`);
  const buyerProfileUrl = absoluteUrl(
    `/listados/${property.slug}/perfil-comprador`
  );

  return {
    subject: "La propiedad que te interesó ya está disponible",
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; color: #111; line-height: 1.6; padding: 24px;">
        <div style="max-width: 640px; margin: 0 auto; border: 1px solid #e8e8e8; border-radius: 18px; overflow: hidden;">
          <div style="background: #11518b; padding: 20px 24px;">
            <h2 style="margin: 0; color: #d4af37; font-size: 22px;">La propiedad ya está disponible</h2>
          </div>
          <div style="padding: 24px;">
            <p style="margin: 0 0 12px;">Hola ${escapeHtml(registration.name)},</p>
            <p style="margin: 0 0 12px;">
              La propiedad que te interesó ya está disponible. Como completaste el registro prioritario, estás recibiendo esta información antes que el público general.
            </p>
            <p style="margin: 0 0 12px;"><strong>Propiedad:</strong> ${escapeHtml(property.title)}</p>
            <p style="margin: 0 0 18px;">
              <strong>Ver la propiedad</strong><br />
              <a href="${escapeHtml(propertyUrl)}" style="color: #11518b;">${escapeHtml(propertyUrl)}</a>
            </p>
            <div style="border-top: 1px solid #e8e8e8; border-bottom: 1px solid #e8e8e8; margin: 22px 0; padding: 18px 0;">
              <p style="margin: 0 0 10px;"><strong>Completar perfil de comprador</strong></p>
              <p style="margin: 0;">
                <a href="${escapeHtml(buyerProfileUrl)}" style="color: #11518b; font-weight: 700;">${escapeHtml(buyerProfileUrl)}</a>
              </p>
            </div>
            <p style="margin: 0 0 18px;">
              Si deseas coordinar una visita, te recomendamos completar primero tu perfil de comprador. Esto permitirá a Ivonne conocer mejor tu interés y ayudarte de una manera más ágil durante el proceso.
            </p>
            <p style="margin: 0;">
              Gracias por tu interés,<br />
              Ivonne Erickson<br />
              Erickson Real Estate
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
