export type SignatureParticipantDraftInput = Readonly<{
  name: string;
  email: string;
  role: string;
  routingOrder: number | null;
}>;

export class SignatureParticipantAdminValidationError extends Error {
  constructor(public readonly userMessage: string) {
    super("signature_participant_admin_validation_failed");
  }
}

export function parseSignatureParticipantDraft(input: {
  name: string;
  email: string;
  role: string;
  routingOrder: string;
}): SignatureParticipantDraftInput {
  const name = input.name.normalize("NFC").trim();
  if (!name || name.length > 160) throw new SignatureParticipantAdminValidationError("Escribe el nombre del participante.");
  const email = input.email.normalize("NFC").trim().toLowerCase();
  if (email.length > 320 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new SignatureParticipantAdminValidationError("Escribe un correo válido.");
  }
  const role = input.role.normalize("NFC").trim();
  if (!role || role.length > 80 || /[\u0000-\u001f\u007f]/.test(role)) {
    throw new SignatureParticipantAdminValidationError("Selecciona o escribe el rol del participante.");
  }
  let routingOrder: number | null = null;
  if (input.routingOrder.trim()) {
    routingOrder = Number(input.routingOrder);
    if (!Number.isInteger(routingOrder) || routingOrder < 1 || routingOrder > 8) {
      throw new SignatureParticipantAdminValidationError("El orden debe ser un número válido del 1 al 8.");
    }
  }
  return { name, email, role, routingOrder };
}
