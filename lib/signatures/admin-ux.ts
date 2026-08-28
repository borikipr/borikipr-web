export const SIGNATURE_STATUS_LABELS: Readonly<Record<string, string>> = Object.freeze({
  draft: "Borrador",
  sent: "Enviado",
  viewed: "Visto",
  partially_signed: "Firmado parcialmente",
  completed: "Completado",
  voided: "Cancelado",
  expired: "Expirado",
  archived: "Archivado",
});

export function signatureStatusLabel(status: string) {
  return SIGNATURE_STATUS_LABELS[status] ?? "Estado desconocido";
}

export function signatureStatusTone(status: string) {
  if (status === "completed") return "bg-green-100 text-green-800";
  if (status === "sent" || status === "viewed" || status === "partially_signed") return "bg-blue-100 text-blue-800";
  if (status === "draft") return "bg-amber-100 text-amber-900";
  return "bg-slate-200 text-slate-700";
}

export type SignatureOperationalParticipant = Readonly<{
  name: string;
  role: string;
  routingOrder: number | null;
  status: string;
  isBrokerFinalSigner?: boolean;
}>;

export function signatureDeliveryLabel(status: string | null | undefined) {
  if (!status) return "Sin invitaciones";
  const labels: Readonly<Record<string,string>> = { pending: "En preparación", processing: "Enviando", delivered: "Entregada", failed: "Falló la entrega" };
  return labels[status] ?? "Entrega registrada";
}

export function signatureRequiresAttention(input: {
  status: string;
  deliveryStatus?: string | null;
  expiresAt?: string | Date | null;
  correctionPending?: boolean;
}) {
  if (input.deliveryStatus === "failed" || input.correctionPending) return true;
  if (input.status === "expired") return true;
  return Boolean(input.expiresAt && new Date(input.expiresAt).getTime() <= Date.now() &&
    ["sent", "viewed", "partially_signed"].includes(input.status));
}

export function signatureOperationalStatus(input: {
  status: string;
  participants?: readonly SignatureOperationalParticipant[];
  deliveryStatus?: string | null;
  expiresAt?: string | Date | null;
}) {
  const participants = input.participants ?? [];
  const completed = participants.filter((participant) => participant.status === "completed").length;
  if (input.deliveryStatus === "failed") return "La invitación requiere atención";
  if (input.status === "draft") return "Preparando documento";
  if (input.status === "completed") return "Firmas completadas";
  if (input.status === "voided") return "Solicitud cancelada";
  if (input.status === "archived") return "Solicitud archivada";
  if (input.status === "expired") return "Expiró antes de completarse";
  const waiting = participants.filter((participant) => !["completed", "revoked", "expired", "declined"].includes(participant.status));
  if (waiting.length) {
    const order = Math.min(...waiting.map((participant) => participant.routingOrder ?? 1));
    const current = waiting.filter((participant) => (participant.routingOrder ?? 1) === order);
    const label = current.length === 1 ? (current[0].isBrokerFinalSigner ? "la corredora" : current[0].role || current[0].name) : current.map((item) => item.role || item.name).join(" y ");
    return `Esperando la firma de ${label}`;
  }
  if (participants.length) return `${completed} de ${participants.length} firmas completadas`;
  return signatureStatusLabel(input.status);
}

export const SIGNATURE_EVENT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  document_created: "Documento creado",
  version_created: "PDF preparado",
  participant_added: "Destinatario añadido",
  participant_updated: "Destinatario actualizado",
  participant_removed: "Destinatario eliminado",
  field_added: "Campo añadido",
  field_updated: "Campo actualizado",
  field_removed: "Campo eliminado",
  document_sent: "Solicitud enviada",
  invitation_issued: "Invitación preparada",
  invitation_delivered: "Invitación enviada",
  invitation_viewed: "Invitación vista",
  consent_accepted: "Consentimiento aceptado",
  participant_completed: "Firma completada por un destinatario",
  document_completed: "Documento completado",
  document_voided: "Solicitud cancelada",
  document_expired: "Solicitud expirada",
});

export function signatureEventLabel(eventType: string) {
  return SIGNATURE_EVENT_LABELS[eventType] ?? "Actividad registrada";
}
