import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import {
  LEAD_GROUP_ROLE_LABELS,
  LEAD_GROUP_STATUS_LABELS,
  getLeadGroupsForLead,
  type LeadGroupRole,
} from "@/lib/admin/queries/lead-groups";
import {
  AlertTriangle,
  ArchiveX,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  House,
  Mail,
  MessageSquareText,
  Phone,
  UsersRound,
} from "lucide-react";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { DocumentAccessButtons } from "@/components/admin/DocumentAccessButtons";
import { getAdminSessionUser } from "@/lib/admin/auth";
import {
  LEAD_DOCUMENT_STATE_LABELS,
  formatDocumentSize,
  type Lead360Document,
} from "@/lib/admin/queries/lead-documents";
import {
  getLeadMergeHistory,
  getMergedLeadDestination,
  searchRelatedPeople,
} from "@/lib/admin/queries/lead-identity-management";
import {
  LEAD_RELATIONSHIP_LABELS,
  LEAD_STATUS_LABELS,
  getLead360Detail,
  type Lead360Interaction,
  type Lead360ManagementEvent,
  type Lead360Note,
} from "@/lib/admin/queries/lead-360";
import { createLeadGroupAction } from "../../lead-groups/actions";
import {
  addLeadNoteAction,
  createLeadRelationshipAction,
  keepLeadsSeparateAction,
  updateLeadRelationshipAction,
  updateLeadFollowUpAction,
  updateLeadStatusAction,
} from "./actions";

const DETAIL_LABELS: Record<string, string> = {
  purchase_type: "Tipo de compra",
  purchase_other: "Otro método",
  prequalified_status: "Precalificación",
  search_range: "Rango de búsqueda",
  property_size: "Tamaño de propiedad",
  wants_visit: "Interés en visita",
  additional_info: "Información adicional",
  purchase_method: "Método de compra",
  purchase_method_other: "Otro método",
  financial_institution: "Institución financiera",
  closing_funds: "Fondos para gastos de cierre",
  solar_contract_acceptance: "Disposición sobre contrato solar",
  comments: "Comentarios",
  document_type: "Tipo de documento",
  document_original_name: "Documento",
  document_content_type: "Formato del documento",
  document_size_bytes: "Tamaño del documento",
  document_status: "Estado del documento",
  primary_interest: "Interés principal",
  purchase_qualification: "Calificación de compra",
  budget: "Presupuesto",
  municipalities: "Municipios",
  property_types: "Tipos de propiedad",
  bedrooms: "Habitaciones",
  bathrooms: "Baños",
  location: "Ubicación",
  primary_reason: "Motivo principal",
  property_type: "Tipo de propiedad",
  working_with_broker: "Trabaja con corredor",
  broker_name: "Nombre del corredor",
  broker_phone: "Teléfono del corredor",
  visit_availability: "Disponibilidad para visita",
  showing_at: "Fecha del evento",
  showing_event_key: "Evento",
  prequalification_document_status: "Carta de precalificación",
  proof_of_funds_status: "Evidencia de fondos",
};

const PLACEHOLDER_VALUES = new Set([
  "no document",
  "no especificado",
  "no aplica",
  "none",
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function dateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function visibleValue(value: unknown) {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return !PLACEHOLDER_VALUES.has(value.trim().toLowerCase());
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function displayValue(key: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (key === "document_size_bytes" && typeof value === "number") {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }
  if (key === "showing_at" && typeof value === "string") return formatDate(value);
  if (typeof value === "object" && value) {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => visibleValue(nested))
      .map(([nestedKey, nested]) => `${nestedKey}: ${displayValue(nestedKey, nested)}`)
      .join(" · ");
  }
  return String(value);
}

function InteractionDetails({ interaction }: { interaction: Lead360Interaction }) {
  const details = Object.entries(interaction.details).filter(([, value]) => visibleValue(value));
  if (details.length === 0) return null;

  return (
    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
      {details.map(([key, value]) => (
        <div className="rounded-2xl bg-[#f8f8f8] px-4 py-3" key={key}>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
            {DETAIL_LABELS[key] ?? key.replaceAll("_", " ")}
          </dt>
          <dd className="mt-1 break-words text-sm text-[#1f2937]">{displayValue(key, value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ManagementEventSummary({ event }: { event: Lead360ManagementEvent }) {
  if (event.type === "status_changed") {
    return <>Estado cambiado a {LEAD_STATUS_LABELS[String(event.data.newStatus) as keyof typeof LEAD_STATUS_LABELS] ?? String(event.data.newStatus)}</>;
  }
  if (event.type === "follow_up_changed") {
    const nextAt = event.data.newAt;
    return <>{nextAt ? `Seguimiento programado para ${formatDate(String(nextAt))}` : "Seguimiento eliminado"}</>;
  }
  if (event.type === "note_added") return <>Nota interna añadida</>;
  if (event.type === "relationship_created") {
    const type = String(event.data.relationshipType);
    const action = event.data.action === "updated" ? "actualizada" : "registrada";
    return <>Relación {action}: {LEAD_RELATIONSHIP_LABELS[type as keyof typeof LEAD_RELATIONSHIP_LABELS] ?? type}</>;
  }
  if (event.type === "duplicate_reviewed") return <>Revisión de identidad: mantener separadas</>;
  if (event.type === "contacted") return <>Contacto registrado</>;
  if (event.type === "document_accessed") {
    const category = String(event.data.documentCategory ?? "");
    const label = category === "prequalification_letter"
      ? "Documento de precalificación"
      : category === "proof_of_funds"
        ? "Evidencia de fondos"
        : "Documento";
    return <>{label} consultado</>;
  }
  if (event.type === "leads_merged") return <>Identidades fusionadas de forma segura</>;
  return <>Actividad administrativa</>;
}

function DocumentCard({ document, leadId }: { document: Lead360Document; leadId: string }) {
  const baseHref = `/admin/leads/${leadId}/documents/${document.source}/${document.submissionId}`;
  const stateTone = {
    available: "bg-emerald-50 text-emerald-800 border-emerald-200",
    pending: "bg-amber-50 text-amber-900 border-amber-200",
    failed: "bg-red-50 text-red-800 border-red-200",
    metadata_incomplete: "bg-slate-100 text-slate-700 border-slate-200",
  }[document.state];

  return (
    <article className="rounded-3xl border border-[#e8e8e8] p-4 md:p-5">
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words font-semibold text-[#000000]">{document.categoryLabel}</h3>
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${stateTone}`}>
              {LEAD_DOCUMENT_STATE_LABELS[document.state]}
            </span>
          </div>
          <p className="mt-2 break-all text-sm font-medium text-[#334155]">
            {document.originalName ?? "Nombre de archivo no disponible"}
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Fuente</dt><dd className="mt-1">{document.sourceLabel}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Propiedad</dt><dd className="mt-1 break-words">{document.propertyTitle ?? "Sin propiedad asociada"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Enviado</dt><dd className="mt-1">{formatDate(document.submittedAt)}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Formato y tamaño</dt><dd className="mt-1 break-words">{document.contentType ?? "Tipo no disponible"} · {formatDocumentSize(document.sizeBytes)}</dd></div>
          </dl>
        </div>
        <div className="min-w-0 lg:max-w-64">
          {document.state === "available" ? (
            <DocumentAccessButtons
              downloadHref={`${baseHref}?mode=download`}
              previewHref={document.previewable ? `${baseHref}?mode=preview` : null}
            />
          ) : (
            <p className="flex items-start gap-2 rounded-2xl bg-[#f8f8f8] p-3 text-sm text-[#4d4d4d]">
              <ArchiveX aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {document.state === "pending" && "La carga todavía no ha terminado."}
              {document.state === "failed" && "El archivo no quedó disponible en R2."}
              {document.state === "metadata_incomplete" && "No hay datos suficientes para ofrecer acceso seguro."}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

type TimelineItem =
  | { id: string; at: string; kind: "interaction"; interaction: Lead360Interaction }
  | { id: string; at: string; kind: "note"; note: Lead360Note }
  | { id: string; at: string; kind: "management"; event: Lead360ManagementEvent };

export default async function AdminLead360Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    ok?: string | string[];
    related_q?: string | string[];
    merged?: string | string[];
    merged_alias?: string | string[];
    merge_result?: string | string[];
    relationship_result?: string | string[];
    group_result?: string | string[];
  }>;
}) {
  const username = await getAdminSessionUser();
  if (!username) redirect("/admin/login");

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const query = await searchParams;
  const destination = await getMergedLeadDestination(id);
  if (destination?.original_merged && destination.survivor_id !== id) {
    redirect(`/admin/leads/${destination.survivor_id}?merged_alias=1`);
  }
  const rawRelatedSearch = Array.isArray(query.related_q) ? query.related_q[0] : query.related_q;
  const relatedSearch = (rawRelatedSearch ?? "").trim().slice(0, 200);
  const [detail, relatedPeople, mergeHistory, leadGroups] = await Promise.all([
    getLead360Detail(id),
    searchRelatedPeople(id, relatedSearch),
    getLeadMergeHistory(id),
    getLeadGroupsForLead(id),
  ]);
  if (!detail) notFound();

  const okMessage = Array.isArray(query.ok) ? query.ok[0] : query.ok;
  const mergeSucceeded = (Array.isArray(query.merged) ? query.merged[0] : query.merged) === "1";
  const mergedAlias = (Array.isArray(query.merged_alias) ? query.merged_alias[0] : query.merged_alias) === "1";
  const mergeResult = Array.isArray(query.merge_result) ? query.merge_result[0] : query.merge_result;
  const relationshipResult = Array.isArray(query.relationship_result) ? query.relationship_result[0] : query.relationship_result;
  const groupResult = Array.isArray(query.group_result) ? query.group_result[0] : query.group_result;
  const successMessage = mergeSucceeded ? "Los registros se fusionaron correctamente." : okMessage;
  const relationshipsByLeadId = new Map(
    detail.relationships.map((relationship) => [relationship.relatedLeadId, relationship])
  );
  const timeline: TimelineItem[] = [
    ...detail.interactions.map((interaction) => ({
      id: `interaction-${interaction.id}`,
      at: interaction.createdAt,
      kind: "interaction" as const,
      interaction,
    })),
    ...detail.notes.map((note) => ({
      id: `note-${note.id}`,
      at: note.createdAt,
      kind: "note" as const,
      note,
    })),
    ...detail.managementEvents.map((event) => ({
      id: `management-${event.id}`,
      at: event.createdAt,
      kind: "management" as const,
      event,
    })),
  ].sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());

  return (
    <AdminPageShell>
      <AdminPageHeader
        breadcrumbs={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/leads", label: "Leads" },
          { label: detail.identity.name },
        ]}
        description="Vista completa de identidad, interacciones, propiedades y seguimiento. Los contactos compartidos requieren revisión humana."
        eyebrow="Lead 360"
        title={detail.identity.name}
        actions={<><Link className="btn-primary" href="/admin/leads/seguimientos">Seguimientos</Link><Link className="btn-secondary" href="/admin/leads">Volver al directorio</Link></>}
      />

      {successMessage && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-900" role="status">
          <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />
          {successMessage}
        </div>
      )}

      {mergedAlias && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-semibold text-blue-950" role="status">
          <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />
          Este registro fue fusionado con {detail.identity.name}.
        </div>
      )}

      {mergeResult === "unconfirmed" && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-semibold leading-6 text-amber-950" role="alert">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          No se pudo confirmar el resultado automáticamente. Revisa ambos registros antes de repetir la operación.
        </div>
      )}

      {relationshipResult === "rolled_back" && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold leading-6 text-red-900" role="alert">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          No se pudo crear la relación. Ningún cambio fue aplicado.
        </div>
      )}

      {relationshipResult === "exists" && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-semibold text-blue-950" role="status">
          <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />
          Estas personas ya están relacionadas.
        </div>
      )}

      {relationshipResult === "unconfirmed" && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-semibold leading-6 text-amber-950" role="alert">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          No se pudo confirmar el resultado automáticamente. Revisa ambas personas antes de intentarlo nuevamente.
        </div>
      )}

      {relationshipResult === "invalid" && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold leading-6 text-red-900" role="alert">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          No se pudo procesar la relación solicitada.
        </div>
      )}

      {groupResult === "rolled_back" && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold leading-6 text-red-900" role="alert">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          No se pudo crear el caso compartido. Ningún cambio fue aplicado.
        </div>
      )}

      {groupResult === "invalid" && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-semibold leading-6 text-amber-950" role="alert">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          Revisa las personas, funciones y contacto principal antes de crear el caso.
        </div>
      )}

      {leadGroups.length > 0 && (
        <section className="rounded-[2rem] border border-blue-200 bg-blue-50 p-5 md:p-6" aria-labelledby="lead-groups-heading">
          <div className="flex items-center gap-3"><UsersRound className="h-6 w-6 text-[#11518b]" /><h2 className="text-lg font-semibold text-blue-950" id="lead-groups-heading">Casos compartidos</h2></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">{leadGroups.map((group) => <Link className="rounded-2xl border border-blue-200 bg-white p-4 transition hover:border-[#11518b]" href={`/admin/leads/casos/${group.groupId}`} key={group.groupId}><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7280]">Pertenece al caso compartido</p><p className="mt-2 break-words font-semibold text-[#11518b]">{group.title}</p><p className="mt-1 text-xs text-[#6b7280]">{LEAD_GROUP_ROLE_LABELS[group.role]}{group.isPrimaryContact ? " · contacto principal" : ""} · {LEAD_GROUP_STATUS_LABELS[group.status]}</p><span className="mt-3 inline-flex text-sm font-semibold text-[#11518b]">Abrir caso</span></Link>)}</div>
        </section>
      )}

      {detail.sharedContacts.length > 0 && (
        <section className="rounded-[2rem] border border-amber-300 bg-amber-50 p-5 md:p-6" aria-labelledby="shared-contact-heading">
          <div className="flex gap-4">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-amber-950" id="shared-contact-heading">Contacto compartido con otra persona</h2>
              <p className="mt-1 text-sm leading-6 text-amber-900">Coincidir en correo o teléfono no confirma una identidad duplicada. Revisa el contexto antes de relacionar o mantener separadas las personas.</p>
              <div className="mt-4 grid gap-3">
                {detail.sharedContacts.map((contact) => {
                  const confirmedRelationship = relationshipsByLeadId.get(contact.id);
                  return (
                  <div className="rounded-2xl border border-amber-200 bg-white p-4" key={contact.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <Link className="font-semibold text-[#11518b] hover:underline" href={`/admin/leads/${contact.id}`}>{contact.name}</Link>
                        <p className="mt-1 text-xs text-[#6b7280]">
                          Coincide por {[contact.emailMatch && "correo", contact.phoneMatch && "teléfono"].filter(Boolean).join(" y ")}.
                        </p>
                        {confirmedRelationship ? (
                          <p className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                            Relación confirmada: {LEAD_RELATIONSHIP_LABELS[confirmedRelationship.type]}
                          </p>
                        ) : (
                          <p className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Posible duplicado sin resolver</p>
                        )}
                        {contact.reviewDecision === "keep_separate" && <p className="mt-2 text-xs font-semibold text-emerald-700">Revisión registrada: mantener separadas</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!confirmedRelationship && (
                          <form action={keepLeadsSeparateAction}>
                            <input name="lead_id" type="hidden" value={detail.identity.id} />
                            <input name="compared_lead_id" type="hidden" value={contact.id} />
                            <input name="operation_key" type="hidden" value={randomUUID()} />
                            <button className="btn-secondary px-4 py-2 text-xs" type="submit">Mantener separadas</button>
                          </form>
                        )}
                        <Link className="rounded-full border border-[#11518b] px-4 py-2 text-xs font-semibold text-[#11518b] hover:bg-[#11518b] hover:text-white" href={`/admin/leads/${detail.identity.id}/fusionar/${contact.id}`}>{confirmedRelationship ? "Revisar identidad por separado" : "Confirmar que es la misma persona"}</Link>
                      </div>
                    </div>
                    {confirmedRelationship && <p className="mt-3 text-xs leading-5 text-[#6b7280]">La relación confirmada y una identidad duplicada son conceptos distintos. No se recomienda fusionar únicamente por compartir contacto.</p>}
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.75fr)]">
        <div className="min-w-0 space-y-6">
          <section className="surface-card p-5 md:p-6" aria-labelledby="identity-heading">
            <div className="flex items-center gap-3">
              <UsersRound aria-hidden="true" className="h-5 w-5 text-[#11518b]" />
              <h2 className="text-xl font-semibold text-[#000000]" id="identity-heading">Identidad canónica</h2>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7280]">Nombre</dt><dd className="mt-1 break-words font-semibold">{detail.identity.name}</dd></div>
              <div><dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7280]"><Mail className="h-3.5 w-3.5" />Correo</dt><dd className="mt-1 break-all text-sm">{detail.identity.email ?? "—"}</dd></div>
              <div><dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7280]"><Phone className="h-3.5 w-3.5" />Teléfono</dt><dd className="mt-1 text-sm">{detail.identity.phone ?? "—"}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7280]">Creado</dt><dd className="mt-1 text-sm">{formatDate(detail.identity.createdAt)}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7280]">Última actividad</dt><dd className="mt-1 text-sm">{formatDate(detail.identity.lastActivityAt)}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7280]">Estado</dt><dd className="mt-1"><span className="inline-flex rounded-full bg-[#11518b]/10 px-3 py-1 text-xs font-semibold text-[#11518b]">{LEAD_STATUS_LABELS[detail.identity.status]}</span></dd></div>
            </dl>
          </section>

          <section className="surface-card p-5 md:p-6" aria-labelledby="interactions-heading">
            <div className="flex items-center gap-3"><FileText aria-hidden="true" className="h-5 w-5 text-[#11518b]" /><h2 className="text-xl font-semibold" id="interactions-heading">Interacciones y propiedades</h2></div>
            <div className="mt-5 grid gap-4">
              {detail.interactions.map((interaction) => (
                <article className="rounded-3xl border border-[#e8e8e8] p-5" key={`${interaction.sourceType}-${interaction.id}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <span className="inline-flex rounded-full bg-[#11518b]/10 px-3 py-1 text-xs font-semibold text-[#11518b]">{interaction.sourceLabel}</span>
                      {interaction.propertyTitle && <h3 className="mt-3 font-semibold text-[#000000]">{interaction.propertyTitle}</h3>}
                      {interaction.propertySlug && <Link className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[#11518b] hover:underline" href={`/listados/${interaction.propertySlug}`} target="_blank"><House className="h-4 w-4" />Ver propiedad</Link>}
                    </div>
                    <time className="text-sm text-[#6b7280]" dateTime={interaction.createdAt}>{formatDate(interaction.createdAt)}</time>
                  </div>
                  <InteractionDetails interaction={interaction} />
                </article>
              ))}
            </div>
          </section>

          <section className="surface-card p-5 md:p-6" aria-labelledby="documents-heading">
            <div className="flex items-center gap-3"><FileText aria-hidden="true" className="h-5 w-5 text-[#11518b]" /><h2 className="text-xl font-semibold" id="documents-heading">Documentos</h2></div>
            <p className="mt-2 text-sm leading-6 text-[#4d4d4d]">Archivos privados vinculados a las interacciones de esta persona. Los enlaces se validan nuevamente al abrirlos.</p>
            {detail.documents.length > 0 ? (
              <div className="mt-5 grid gap-4">{detail.documents.map((document) => <DocumentCard document={document} key={`${document.source}-${document.submissionId}`} leadId={detail.identity.id} />)}</div>
            ) : (
              <div className="mt-5 rounded-2xl bg-[#f8f8f8] p-4 text-sm text-[#6b7280]">No hay documentos persistidos para este lead.</div>
            )}
          </section>

          {mergeHistory.length > 0 && (
            <section className="surface-card p-5 md:p-6" aria-labelledby="merge-history-heading">
              <div className="flex items-center gap-3"><UsersRound aria-hidden="true" className="h-5 w-5 text-[#11518b]" /><h2 className="text-xl font-semibold" id="merge-history-heading">Historial de fusiones</h2></div>
              <p className="mt-2 text-sm leading-6 text-[#4d4d4d]">Las identidades secundarias permanecen archivadas y sus valores anteriores se conservan para auditoría.</p>
              <div className="mt-5 grid min-w-0 gap-4">
                {mergeHistory.map((merge) => (
                  <article className="min-w-0 rounded-2xl border border-[#e8e8e8] p-4" key={merge.id}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="break-words font-semibold">{merge.secondaryName}</h3>
                        {merge.secondaryEmail && <p className="mt-1 break-all text-sm text-[#4d4d4d]">{merge.secondaryEmail}</p>}
                        {merge.secondaryPhone && <p className="mt-1 break-words text-sm text-[#4d4d4d]">{merge.secondaryPhone}</p>}
                      </div>
                      <time className="shrink-0 text-xs text-[#6b7280]" dateTime={merge.createdAt}>{formatDate(merge.createdAt)}</time>
                    </div>
                    <p className="mt-3 text-xs text-[#6b7280]">{Object.values(merge.affectedCounts).reduce((total, count) => total + count, 0)} referencias auditadas durante la fusión.</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="surface-card p-5 md:p-6" aria-labelledby="timeline-heading">
            <div className="flex items-center gap-3"><Clock3 aria-hidden="true" className="h-5 w-5 text-[#11518b]" /><h2 className="text-xl font-semibold" id="timeline-heading">Cronología</h2></div>
            <ol className="mt-5 border-l border-[#d9d9d9] pl-5">
              {timeline.map((item) => (
                <li className="relative pb-6 last:pb-0" key={item.id}>
                  <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#d4af37] ring-4 ring-white" />
                  <time className="text-xs text-[#6b7280]" dateTime={item.at}>{formatDate(item.at)}</time>
                  <p className="mt-1 text-sm font-semibold text-[#1f2937]">
                    {item.kind === "interaction" && item.interaction.sourceLabel}
                    {item.kind === "note" && "Nota interna"}
                    {item.kind === "management" && <ManagementEventSummary event={item.event} />}
                  </p>
                  {item.kind === "note" && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#4d4d4d]">{item.note.body}</p>}
                  {item.kind === "interaction" && item.interaction.propertyTitle && <p className="mt-1 text-sm text-[#4d4d4d]">{item.interaction.propertyTitle}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <section className="surface-card p-5" aria-labelledby="crm-heading">
            <h2 className="text-lg font-semibold" id="crm-heading">Controles CRM</h2>
            <form action={updateLeadStatusAction} className="mt-4">
              <input name="lead_id" type="hidden" value={detail.identity.id} />
              <input name="operation_key" type="hidden" value={randomUUID()} />
              <label className="text-sm font-semibold" htmlFor="status">Estado</label>
              <select className="input-field mt-2 w-full" defaultValue={detail.identity.status} id="status" name="status">
                {Object.entries(LEAD_STATUS_LABELS).filter(([value]) => value !== "merged").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button className="btn-primary mt-3 w-full" type="submit">Guardar estado</button>
            </form>

            <form action={updateLeadFollowUpAction} className="mt-6 border-t border-[#eeeeee] pt-5">
              <input name="lead_id" type="hidden" value={detail.identity.id} />
              <input name="operation_key" type="hidden" value={randomUUID()} />
              <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="next_follow_up_at"><CalendarClock className="h-4 w-4 text-[#11518b]" />Próximo seguimiento</label>
              <input className="input-field mt-2 w-full" defaultValue={dateTimeLocal(detail.identity.nextFollowUpAt)} id="next_follow_up_at" name="next_follow_up_at" type="datetime-local" />
              <button className="btn-secondary mt-3 w-full" type="submit">Guardar seguimiento</button>
            </form>
          </section>

          <section className="surface-card p-5" aria-labelledby="notes-heading">
            <div className="flex items-center gap-2"><MessageSquareText aria-hidden="true" className="h-5 w-5 text-[#11518b]" /><h2 className="text-lg font-semibold" id="notes-heading">Notas internas</h2></div>
            <form action={addLeadNoteAction} className="mt-4">
              <input name="lead_id" type="hidden" value={detail.identity.id} />
              <input name="operation_key" type="hidden" value={randomUUID()} />
              <label className="sr-only" htmlFor="body">Nueva nota</label>
              <textarea className="input-field min-h-28 w-full" id="body" maxLength={5000} name="body" placeholder="Añadir contexto para seguimiento…" required />
              <button className="btn-primary mt-3 w-full" type="submit">Guardar nota</button>
            </form>
            {detail.notes.length > 0 && <p className="mt-4 text-xs text-[#6b7280]">{detail.notes.length} nota{detail.notes.length === 1 ? "" : "s"} registrada{detail.notes.length === 1 ? "" : "s"}</p>}
          </section>

          <section className="surface-card p-5" aria-labelledby="relationships-heading">
            <div className="flex items-center gap-2"><UsersRound aria-hidden="true" className="h-5 w-5 text-[#11518b]" /><h2 className="text-lg font-semibold" id="relationships-heading">Personas relacionadas</h2></div>
            {detail.relationships.length > 0 ? (
              <ul className="mt-4 grid gap-3">
                {detail.relationships.map((relationship) => (
                  <li className="min-w-0 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" key={relationship.id}>
                    <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Relación confirmada</span>
                    <Link className="mt-3 block break-words font-semibold text-[#11518b] hover:underline" href={`/admin/leads/${relationship.relatedLeadId}`}>{relationship.relatedLeadName}</Link>
                    <p className="mt-1 text-sm font-semibold text-emerald-900">{LEAD_RELATIONSHIP_LABELS[relationship.type]}</p>
                    <form action={updateLeadRelationshipAction} className="mt-4 border-t border-emerald-200 pt-4">
                      <input name="lead_id" type="hidden" value={detail.identity.id} />
                      <input name="related_lead_id" type="hidden" value={relationship.relatedLeadId} />
                      <input name="relationship_id" type="hidden" value={relationship.id} />
                      <input name="operation_key" type="hidden" value={randomUUID()} />
                      <label className="text-xs font-semibold text-emerald-950" htmlFor={`existing-relationship-${relationship.id}`}>Cambiar tipo explícitamente</label>
                      <select className="input-field mt-2 w-full" defaultValue={relationship.type} id={`existing-relationship-${relationship.id}`} name="relationship_type" required>
                        {Object.entries(LEAD_RELATIONSHIP_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <button className="btn-secondary mt-3 w-full" type="submit">Actualizar relación</button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-[#6b7280]">Todavía no hay relaciones confirmadas.</p>}

            <div className="mt-5 border-t border-[#eeeeee] pt-5">
              <form action={`/admin/leads/${detail.identity.id}`} method="get">
                <label className="text-sm font-semibold" htmlFor="related_q">Buscar cualquier persona</label>
                <p className="mt-1 text-xs leading-5 text-[#6b7280]">Busca por nombre, correo o teléfono. No es necesario que compartan datos de contacto.</p>
                <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row">
                  <input className="input-field min-w-0 flex-1" defaultValue={relatedSearch} id="related_q" minLength={2} name="related_q" placeholder="Nombre, correo o teléfono" required />
                  <button className="btn-secondary shrink-0" type="submit">Buscar</button>
                </div>
              </form>

              {relatedSearch.length >= 2 && relatedPeople.length === 0 && (
                <p className="mt-4 rounded-2xl bg-[#f8f8f8] p-4 text-sm text-[#6b7280]">No se encontraron personas activas con esa búsqueda.</p>
              )}

              {relatedPeople.length > 0 && (
                <div className="mt-4 grid min-w-0 gap-3">
                  {relatedPeople.map((person) => (
                    <form action={createLeadRelationshipAction} className="min-w-0 rounded-2xl border border-[#e8e8e8] p-4" key={person.id}>
                      <input name="lead_id" type="hidden" value={detail.identity.id} />
                      <input name="related_lead_id" type="hidden" value={person.id} />
                      <input name="operation_key" type="hidden" value={randomUUID()} />
                      <Link className="break-words font-semibold text-[#11518b] hover:underline" href={`/admin/leads/${person.id}`}>{person.name}</Link>
                      <p className="mt-1 break-all text-xs text-[#6b7280]">{person.email ?? "Sin correo"}</p>
                      <p className="mt-1 break-words text-xs text-[#6b7280]">{person.phone ?? "Sin teléfono"}</p>
                      {(person.emailExactMatch || person.phoneExactMatch) && <p className="mt-2 text-xs font-semibold text-amber-800">Contacto normalizado coincidente</p>}
                      <label className="mt-3 block text-sm font-semibold" htmlFor={`relationship-${person.id}`}>Relación</label>
                      <select className="input-field mt-2 w-full" id={`relationship-${person.id}`} name="relationship_type" required>
                        {Object.entries(LEAD_RELATIONSHIP_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <div className="mt-3 grid min-w-0 gap-2">
                        <button className="btn-secondary w-full" type="submit">Relacionar personas</button>
                        <Link className="inline-flex min-h-11 items-center justify-center rounded-full px-4 text-center text-sm font-semibold text-[#11518b] hover:bg-[#11518b]/5" href={`/admin/leads/${detail.identity.id}/fusionar/${person.id}`}>Revisar posible duplicado</Link>
                      </div>
                    </form>
                  ))}
                </div>
              )}
            </div>

            {detail.relationships.length > 0 && (
              <div className="mt-6 border-t border-[#eeeeee] pt-5">
                <h3 className="text-base font-semibold">Crear caso compartido</h3>
                <p className="mt-1 text-xs leading-5 text-[#6b7280]">Agrupa trabajo operacional sin fusionar identidades. La creación siempre requiere una decisión administrativa.</p>
                <form action={createLeadGroupAction} className="mt-4 grid min-w-0 gap-4">
                  <input name="source_lead_id" type="hidden" value={detail.identity.id} />
                  <input name="operation_key" type="hidden" value={randomUUID()} />
                  <label><span className="text-sm font-semibold">Título del caso</span><input className="input-field mt-2 w-full" defaultValue={detail.interactions.find((interaction) => interaction.propertyTitle)?.propertyTitle ? `Compra — ${detail.interactions.find((interaction) => interaction.propertyTitle)?.propertyTitle}` : `Caso compartido — ${detail.identity.name}`} maxLength={200} name="title" required /></label>
                  <label><span className="text-sm font-semibold">Propiedad principal</span><select className="input-field mt-2 w-full" name="primary_property_id"><option value="">Sin propiedad principal</option>{[...new Map(detail.interactions.filter((interaction) => interaction.propertyId && interaction.propertyTitle).map((interaction) => [interaction.propertyId, { id: interaction.propertyId as string, title: interaction.propertyTitle as string }])).values()].map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
                  <div className="grid gap-4 sm:grid-cols-2"><label><span className="text-sm font-semibold">Estado inicial</span><select className="input-field mt-2 w-full" defaultValue="new" name="status"><option value="new">Nuevo</option><option value="active">Activo</option><option value="on_hold">En pausa</option><option value="closed">Cerrado</option></select></label><label><span className="text-sm font-semibold">Próximo seguimiento (opcional)</span><input className="input-field mt-2 w-full" name="next_follow_up_at" type="datetime-local" /></label></div>
                  {[{ leadId: detail.identity.id, name: detail.identity.name, defaultRole: "buyer" as LeadGroupRole }, ...detail.relationships.map((relationship) => ({
                    leadId: relationship.relatedLeadId,
                    name: relationship.relatedLeadName,
                    defaultRole: ({ family: "family_contact", primary_buyer: "buyer", co_buyer: "co_buyer", prequalified_person: "prequalified_buyer", representative_contact: "representative_contact", other: "other" } as const)[relationship.type],
                  }))].map((person, index) => (
                    <div className="rounded-2xl border border-[#e8e8e8] p-4" key={person.leadId}>
                      <label className="flex items-start gap-3"><input defaultChecked className="mt-1" name="member_id" type="checkbox" value={person.leadId} /><span className="min-w-0 break-words text-sm font-semibold">{person.name}</span></label>
                      <select className="input-field mt-3 w-full" defaultValue={person.defaultRole} name={`role_${person.leadId}`}>{Object.entries(LEAD_GROUP_ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                      <label className="mt-3 flex items-center gap-2 text-xs font-semibold"><input defaultChecked={index === 0} name="primary_contact_lead_id" type="radio" value={person.leadId} />Contacto principal</label>
                    </div>
                  ))}
                  <button className="btn-primary w-full" type="submit">Crear caso compartido</button>
                </form>
              </div>
            )}
          </section>

          <section className="surface-card p-5" aria-labelledby="email-heading">
            <div className="flex items-center gap-2"><Mail aria-hidden="true" className="h-5 w-5 text-[#11518b]" /><h2 className="text-lg font-semibold" id="email-heading">Estado de emails</h2></div>
            {detail.emailSummary.length > 0 ? (
              <dl className="mt-4 grid gap-3">
                {detail.emailSummary.map((summary) => (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f8f8f8] p-4" key={summary.status}>
                    <div><dt className="text-sm font-semibold capitalize">{summary.status}</dt><dd className="mt-1 text-xs text-[#6b7280]">{summary.lastSentAt ? `Último envío ${formatDate(summary.lastSentAt)}` : `Actualizado ${formatDate(summary.lastUpdatedAt)}`}</dd></div>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">{summary.count}</span>
                  </div>
                ))}
              </dl>
            ) : <p className="mt-3 text-sm text-[#6b7280]">No hay filas de cola vinculadas a esta identidad.</p>}
          </section>
        </aside>
      </div>
    </AdminPageShell>
  );
}
