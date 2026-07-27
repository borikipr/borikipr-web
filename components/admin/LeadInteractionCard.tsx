import Link from "next/link";
import { House } from "lucide-react";
import type { Lead360Interaction } from "@/lib/admin/queries/lead-360";

const LABELS: Record<string, string> = {
  purchase_type: "Tipo de compra", purchase_other: "Otro método", prequalified_status: "Precalificación",
  search_range: "Rango de búsqueda", property_size: "Tamaño de propiedad", wants_visit: "Interés en visita",
  additional_info: "Información adicional", purchase_method: "Método de compra", purchase_method_other: "Otro método",
  financial_institution: "Institución financiera", closing_funds: "Fondos para gastos de cierre",
  solar_contract_acceptance: "Disposición sobre contrato solar", comments: "Comentarios",
  document_type: "Tipo de documento", document_original_name: "Documento", document_content_type: "Formato del documento",
  document_size_bytes: "Tamaño del documento", document_status: "Estado del documento", primary_interest: "Interés principal",
  purchase_qualification: "Calificación de compra", budget: "Presupuesto", municipalities: "Municipios",
  property_types: "Tipos de propiedad", bedrooms: "Habitaciones", bathrooms: "Baños", location: "Ubicación",
  primary_reason: "Motivo principal", property_type: "Tipo de propiedad", working_with_broker: "Trabaja con corredor",
  broker_name: "Nombre del corredor", broker_phone: "Teléfono del corredor", visit_availability: "Disponibilidad para visita",
  showing_at: "Fecha del evento", showing_event_key: "Evento", prequalification_document_status: "Carta de precalificación",
  proof_of_funds_status: "Evidencia de fondos",
};
const PLACEHOLDERS = new Set(["no document", "no especificado", "no aplica", "none"]);

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PR", { timeZone: "America/Puerto_Rico", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function visible(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return !PLACEHOLDERS.has(value.trim().toLowerCase());
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}
function display(key: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (key === "solar_contract_acceptance" && value === "yes") return "Sí";
  if (key === "solar_contract_acceptance" && value === "no") return "No";
  if (Array.isArray(value)) return value.join(", ");
  if (key === "document_size_bytes" && typeof value === "number") return `${Math.max(1, Math.round(value / 1024))} KB`;
  if (key === "showing_at" && typeof value === "string") return formatDate(value);
  if (typeof value === "object" && value) return Object.entries(value as Record<string, unknown>).filter(([, nested]) => visible(nested)).map(([nestedKey, nested]) => `${nestedKey}: ${display(nestedKey, nested)}`).join(" · ");
  return String(value);
}

export function LeadInteractionCard({ interaction, submitterName }: { interaction: Lead360Interaction; submitterName?: string }) {
  const details = Object.entries(interaction.details).filter(([, value]) => visible(value));
  return <article className="min-w-0 rounded-3xl border border-[#e8e8e8] p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0"><span className="inline-flex rounded-full bg-[#11518b]/10 px-3 py-1 text-xs font-semibold text-[#11518b]">{interaction.sourceLabel}</span>
        {submitterName && <p className="mt-3 break-words text-sm"><span className="font-semibold">Completado por:</span> {submitterName}</p>}
        {interaction.propertyTitle && <h3 className="mt-3 break-words font-semibold">{interaction.propertyTitle}</h3>}
        {interaction.propertySlug && <Link className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[#11518b] hover:underline" href={`/listados/${interaction.propertySlug}`} target="_blank"><House className="h-4 w-4" />Ver propiedad</Link>}
      </div><time className="shrink-0 text-sm text-[#6b7280]" dateTime={interaction.createdAt}>{formatDate(interaction.createdAt)}</time>
    </div>
    {details.length > 0 && <dl className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">{details.map(([key, value]) => <div className="min-w-0 rounded-2xl bg-[#f8f8f8] px-4 py-3" key={key}><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7280]">{LABELS[key] ?? key.replaceAll("_", " ")}</dt><dd className="mt-1 break-words text-sm text-[#1f2937]">{display(key, value)}</dd></div>)}</dl>}
  </article>;
}
