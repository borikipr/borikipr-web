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
