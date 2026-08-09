export type SignatureDeliveryLocale = "es-PR" | "en-US";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

export function renderSignatureInvitation(input: {
  locale: SignatureDeliveryLocale;
  documentTitle: string;
  participantRole: string;
  expiresAt: Date;
  signingUrl: string;
}) {
  const title = escapeHtml(input.documentTitle);
  const role = escapeHtml(input.participantRole);
  const url = escapeHtml(input.signingUrl);
  const expires = new Intl.DateTimeFormat(input.locale, {
    dateStyle: "long", timeStyle: "short", timeZone: "America/Puerto_Rico",
  }).format(input.expiresAt);
  if (input.locale === "en-US") {
    return {
      subject: `Signature requested: ${input.documentTitle}`,
      html: `<main><h1>Erickson Real Estate</h1><p>You have been invited to review and sign <strong>${title}</strong> as ${role}.</p><p><a href="${url}">Review document securely</a></p><p>This private link expires ${escapeHtml(expires)}. Do not forward it.</p><p>The email contains no contract content. If you did not expect this request, contact Erickson Real Estate through a known channel.</p></main>`,
    };
  }
  return {
    subject: `Documento para firma: ${input.documentTitle}`,
    html: `<main><h1>Erickson Real Estate</h1><p>Se te invita a revisar y firmar <strong>${title}</strong> con el rol ${role}.</p><p><a href="${url}">Revisar documento de forma segura</a></p><p>Este enlace privado vence el ${escapeHtml(expires)}. No lo compartas.</p><p>Este correo no contiene el contrato. Si no esperabas esta solicitud, comunícate con Erickson Real Estate mediante un canal conocido.</p></main>`,
  };
}

export function renderSignatureCompletionDelivery(input: {
  locale: SignatureDeliveryLocale;
  documentTitle: string;
  accessUrl: string;
  expiresAt: Date;
}) {
  const title = escapeHtml(input.documentTitle);
  const url = escapeHtml(input.accessUrl);
  const expires = new Intl.DateTimeFormat(input.locale, {
    dateStyle: "long", timeStyle: "short", timeZone: "America/Puerto_Rico",
  }).format(input.expiresAt);
  return input.locale === "en-US"
    ? { subject: `Completed document: ${input.documentTitle}`, html: `<main><h1>Erickson Real Estate</h1><p><strong>${title}</strong> is complete.</p><p><a href="${url}">Access completed files securely</a></p><p>The private link expires ${escapeHtml(expires)}.</p></main>` }
    : { subject: `Documento completado: ${input.documentTitle}`, html: `<main><h1>Erickson Real Estate</h1><p><strong>${title}</strong> está completado.</p><p><a href="${url}">Acceder a los archivos de forma segura</a></p><p>El enlace privado vence el ${escapeHtml(expires)}.</p></main>` };
}
