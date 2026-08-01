import type { TranslationAdminField } from "@/lib/i18n/translations/admin-service";

export type TranslationAdminPresentation = {
  isMissing: boolean;
  status: string;
  origin: string;
  review: string;
  protection: string;
  freshness: string;
  activeJobTerm: string;
  job: string;
  automation: string;
};

export function getTranslationAdminPresentation(
  field: TranslationAdminField
): TranslationAdminPresentation {
  const isMissing = field.translationId === null || field.status === "missing";

  if (isMissing) {
    return {
      isMissing: true,
      status: "Sin traducción",
      origin: "No aplica",
      review: "No revisada",
      protection: "No protegida",
      freshness: "No aplica",
      activeJobTerm: "Trabajo activo",
      job: "Ninguno",
      automation: "No autorizada",
    };
  }

  const status = field.status === "pending"
    ? "Pendiente"
    : field.status === "processing"
      ? "Procesando"
      : field.status === "ready"
        ? "Lista"
        : field.status === "stale"
          ? "Desactualizada"
          : field.status === "failed"
            ? "Falló"
            : "Sin traducción";
  const job = field.activeJobStatus === "queued"
    ? "En espera"
    : field.activeJobStatus === "processing"
      ? "Procesando"
      : field.lastJobStatus === "failed"
        ? "Falló"
        : field.lastJobStatus === "cancelled"
          ? "Cancelado"
          : field.lastJobStatus === "succeeded"
            ? "Completado"
            : "Sin trabajo activo";

  return {
    isMissing: false,
    status,
    origin: field.origin === "manual" ? "Editada manualmente" : "Generada automáticamente",
    review: field.reviewStatus === "reviewed" ? "Revisada" : "No revisada",
    protection: field.protectedFromAutomation ? "Protegida" : "No protegida",
    freshness: field.isFresh ? "Al día" : "Desactualizada porque cambió el español",
    activeJobTerm: "Trabajo",
    job,
    automation: field.regenerationAuthorizedAt
      ? "Regeneración automática autorizada"
      : "No autorizada",
  };
}
