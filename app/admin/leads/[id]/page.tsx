import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import {
  AlertTriangle,
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
import { getAdminSessionUser } from "@/lib/admin/auth";
import {
  LEAD_RELATIONSHIP_LABELS,
  LEAD_STATUS_LABELS,
  getLead360Detail,
  type Lead360Interaction,
  type Lead360ManagementEvent,
  type Lead360Note,
} from "@/lib/admin/queries/lead-360";
import {
  addLeadNoteAction,
  createLeadRelationshipAction,
  keepLeadsSeparateAction,
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
    return <>Relación registrada: {LEAD_RELATIONSHIP_LABELS[type as keyof typeof LEAD_RELATIONSHIP_LABELS] ?? type}</>;
  }
  if (event.type === "duplicate_reviewed") return <>Revisión de identidad: mantener separadas</>;
  if (event.type === "contacted") return <>Contacto registrado</>;
  return <>Actividad administrativa</>;
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
  searchParams: Promise<{ ok?: string | string[] }>;
}) {
  const username = await getAdminSessionUser();
  if (!username) redirect("/admin/login");

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const detail = await getLead360Detail(id);
  if (!detail) notFound();

  const query = await searchParams;
  const successMessage = Array.isArray(query.ok) ? query.ok[0] : query.ok;
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

      {detail.sharedContacts.length > 0 && (
        <section className="rounded-[2rem] border border-amber-300 bg-amber-50 p-5 md:p-6" aria-labelledby="shared-contact-heading">
          <div className="flex gap-4">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-amber-950" id="shared-contact-heading">Contacto compartido con otra persona</h2>
              <p className="mt-1 text-sm leading-6 text-amber-900">Coincidir en correo o teléfono no confirma una identidad duplicada. Revisa el contexto antes de relacionar o mantener separadas las personas.</p>
              <div className="mt-4 grid gap-3">
                {detail.sharedContacts.map((contact) => (
                  <div className="rounded-2xl border border-amber-200 bg-white p-4" key={contact.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <Link className="font-semibold text-[#11518b] hover:underline" href={`/admin/leads/${contact.id}`}>{contact.name}</Link>
                        <p className="mt-1 text-xs text-[#6b7280]">
                          Coincide por {[contact.emailMatch && "correo", contact.phoneMatch && "teléfono"].filter(Boolean).join(" y ")}.
                        </p>
                        {contact.reviewDecision === "keep_separate" && <p className="mt-2 text-xs font-semibold text-emerald-700">Revisión registrada: mantener separadas</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <form action={keepLeadsSeparateAction}>
                          <input name="lead_id" type="hidden" value={detail.identity.id} />
                          <input name="compared_lead_id" type="hidden" value={contact.id} />
                          <input name="operation_key" type="hidden" value={randomUUID()} />
                          <button className="btn-secondary px-4 py-2 text-xs" type="submit">Mantener separadas</button>
                        </form>
                        <button className="cursor-not-allowed rounded-full border border-[#d9d9d9] bg-[#f8f8f8] px-4 py-2 text-xs font-semibold text-[#6b7280]" disabled title="La fusión segura se implementará en una fase posterior" type="button">Confirmar que es la misma persona</button>
                      </div>
                    </div>
                  </div>
                ))}
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
                  <li className="rounded-2xl bg-[#f8f8f8] p-4" key={relationship.id}>
                    <Link className="font-semibold text-[#11518b] hover:underline" href={`/admin/leads/${relationship.relatedLeadId}`}>{relationship.relatedLeadName}</Link>
                    <p className="mt-1 text-xs text-[#6b7280]">{LEAD_RELATIONSHIP_LABELS[relationship.type]}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-[#6b7280]">Todavía no hay relaciones confirmadas.</p>}

            {detail.sharedContacts.length > 0 && (
              <form action={createLeadRelationshipAction} className="mt-5 border-t border-[#eeeeee] pt-5">
                <input name="lead_id" type="hidden" value={detail.identity.id} />
                <input name="operation_key" type="hidden" value={randomUUID()} />
                <label className="text-sm font-semibold" htmlFor="related_lead_id">Persona</label>
                <select className="input-field mt-2 w-full" id="related_lead_id" name="related_lead_id" required>
                  {detail.sharedContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
                </select>
                <label className="mt-4 block text-sm font-semibold" htmlFor="relationship_type">Relación</label>
                <select className="input-field mt-2 w-full" id="relationship_type" name="relationship_type" required>
                  {Object.entries(LEAD_RELATIONSHIP_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <button className="btn-secondary mt-3 w-full" type="submit">Relacionar personas</button>
              </form>
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
