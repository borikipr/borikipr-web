import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, CheckCircle2, FileText, MessageSquareText, UsersRound } from "lucide-react";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { DocumentAccessButtons } from "@/components/admin/DocumentAccessButtons";
import { getAdminSessionUser } from "@/lib/admin/auth";
import {
  LEAD_GROUP_ROLE_LABELS,
  LEAD_GROUP_STATUS_LABELS,
  getLeadGroupDetail,
  searchLeadGroupCandidates,
} from "@/lib/admin/queries/lead-groups";
import { LEAD_DOCUMENT_STATE_LABELS, formatDocumentSize } from "@/lib/admin/queries/lead-documents";
import {
  addLeadGroupMemberAction,
  addLeadGroupNoteAction,
  removeLeadGroupMemberAction,
  updateLeadGroupAction,
} from "../actions";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-PR", { timeZone: "America/Puerto_Rico", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function dateTimeLocal(value: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Puerto_Rico", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export default async function LeadGroup360Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getAdminSessionUser();
  if (!user) redirect("/admin/login");
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const query = await searchParams;
  const memberSearch = (typeof query.member_q === "string" ? query.member_q : "").trim().slice(0, 200);
  const [group, candidates] = await Promise.all([
    getLeadGroupDetail(id),
    searchLeadGroupCandidates(id, memberSearch),
  ]);
  if (!group) notFound();
  const ok = typeof query.ok === "string" ? query.ok.slice(0, 160) : null;
  const result = typeof query.group_result === "string" ? query.group_result : null;

  const properties = new Map<string, { title: string; slug: string | null; owners: Set<string> }>();
  const timeline: Array<{ id: string; at: string; owner: string; label: string; detail?: string }> = [];
  for (const member of group.members) {
    const owner = member.detail.identity.name;
    for (const interaction of member.detail.interactions) {
      timeline.push({ id: `interaction-${member.leadId}-${interaction.id}`, at: interaction.createdAt, owner, label: interaction.sourceLabel, detail: interaction.propertyTitle ?? undefined });
      if (interaction.propertyTitle) {
        const key = interaction.propertySlug ?? interaction.propertyTitle;
        const property = properties.get(key) ?? { title: interaction.propertyTitle, slug: interaction.propertySlug, owners: new Set<string>() };
        property.owners.add(owner); properties.set(key, property);
      }
    }
    for (const note of member.detail.notes) timeline.push({ id: `lead-note-${member.leadId}-${note.id}`, at: note.createdAt, owner, label: "Nota individual" });
    for (const event of member.detail.managementEvents) timeline.push({ id: `lead-event-${member.leadId}-${event.id}`, at: event.createdAt, owner, label: "Actividad individual" });
  }
  for (const note of group.sharedNotes) timeline.push({ id: `group-note-${note.id}`, at: note.createdAt, owner: "Caso compartido", label: "Nota compartida" });
  for (const event of group.events) timeline.push({ id: `group-event-${event.id}`, at: event.createdAt, owner: "Caso compartido", label: event.type.replaceAll("_", " ") });
  timeline.sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());

  const documents = group.members.flatMap((member) => member.detail.documents.map((document) => ({ ...document, ownerId: member.leadId, ownerName: member.detail.identity.name })));
  const individualNotes = group.members.flatMap((member) => member.detail.notes.map((note) => ({ ...note, ownerName: member.detail.identity.name })));
  const queueCount = group.members.reduce((total, member) => total + member.detail.emailSummary.reduce((subtotal, item) => subtotal + item.count, 0), 0);
  const contactGroups = new Map<string, { label: string; kind: "Correo" | "Teléfono"; owners: Set<string> }>();
  for (const member of group.members) {
    const contacts = [
      { raw: member.detail.identity.email, normalized: member.detail.identity.email?.trim().toLowerCase(), kind: "Correo" as const },
      { raw: member.detail.identity.phone, normalized: member.detail.identity.phone?.replace(/\D/g, ""), kind: "Teléfono" as const },
    ];
    for (const contact of contacts) {
      if (!contact.raw || !contact.normalized) continue;
      const key = `${contact.kind}:${contact.normalized}`;
      const entry = contactGroups.get(key) ?? { label: contact.raw, kind: contact.kind, owners: new Set<string>() };
      entry.owners.add(member.detail.identity.name);
      contactGroups.set(key, entry);
    }
  }
  const sharedContacts = [...contactGroups.values()].filter((contact) => contact.owners.size > 1);

  return (
    <AdminPageShell>
      <AdminPageHeader
        actions={<><Link className="btn-primary" href="/admin/leads/seguimientos">Seguimientos</Link><Link className="btn-secondary" href="/admin/lead-groups">Volver a casos</Link></>}
        breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/lead-groups", label: "Casos" }, { label: group.title }]}
        description="Espacio operacional compartido. Cada persona conserva su identidad, historial y documentos individuales."
        eyebrow="Caso 360"
        title={group.title}
      />
      {ok && <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-900" role="status"><CheckCircle2 className="h-5 w-5" />{ok}</div>}
      {result === "rolled_back" && <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-900" role="alert">No se pudo completar la actualización. Ningún cambio fue aplicado.</div>}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.75fr)]">
        <div className="min-w-0 space-y-6">
          <section className="surface-card p-5 md:p-6"><div className="flex items-center gap-3"><UsersRound className="h-5 w-5 text-[#11518b]" /><h2 className="text-xl font-semibold">Resumen</h2></div><dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-xs font-semibold uppercase text-[#6b7280]">Estado</dt><dd className="mt-1 font-semibold">{LEAD_GROUP_STATUS_LABELS[group.status]}</dd></div><div><dt className="text-xs font-semibold uppercase text-[#6b7280]">Propiedad principal</dt><dd className="mt-1 font-semibold">{group.primaryProperty?.title ?? "Sin propiedad principal"}</dd></div><div><dt className="text-xs font-semibold uppercase text-[#6b7280]">Próximo seguimiento</dt><dd className="mt-1 font-semibold">{formatDate(group.nextFollowUpAt)}</dd></div><div><dt className="text-xs font-semibold uppercase text-[#6b7280]">Personas</dt><dd className="mt-1 font-semibold">{group.members.length}</dd></div><div><dt className="text-xs font-semibold uppercase text-[#6b7280]">Interacciones</dt><dd className="mt-1 font-semibold">{group.members.reduce((total, member) => total + member.detail.interactions.length, 0)}</dd></div><div><dt className="text-xs font-semibold uppercase text-[#6b7280]">Filas de email</dt><dd className="mt-1 font-semibold">{queueCount}</dd></div></dl></section>

          <section className="surface-card p-5 md:p-6"><h2 className="text-xl font-semibold">Contactos compartidos</h2><p className="mt-2 text-sm text-[#4d4d4d]">Coincidencias operacionales entre miembros; no implican identidad duplicada.</p><div className="mt-4 grid gap-3">{sharedContacts.map((contact) => <article className="min-w-0 rounded-2xl bg-amber-50 p-4" key={`${contact.kind}-${contact.label}`}><p className="text-xs font-semibold uppercase text-amber-900">{contact.kind}</p><p className="mt-1 break-all text-sm font-semibold">{contact.label}</p><p className="mt-1 break-words text-xs text-[#6b7280]">Compartido por {[...contact.owners].join(" y ")}</p></article>)}{sharedContacts.length === 0 && <p className="text-sm text-[#6b7280]">No se detectaron contactos compartidos entre los miembros.</p>}</div></section>

          <section className="surface-card p-5 md:p-6"><h2 className="text-xl font-semibold">Miembros</h2><div className="mt-5 grid gap-4 md:grid-cols-2">{group.members.map((member) => <article className="min-w-0 rounded-3xl border border-[#e8e8e8] p-5" key={member.leadId}><div className="flex flex-wrap gap-2">{member.isPrimaryContact && <span className="rounded-full bg-[#d4af37]/20 px-3 py-1 text-xs font-semibold">Contacto principal</span>}<span className="rounded-full bg-[#11518b]/10 px-3 py-1 text-xs font-semibold text-[#11518b]">{LEAD_GROUP_ROLE_LABELS[member.role]}</span></div><Link className="mt-3 block break-words text-lg font-semibold text-[#11518b] hover:underline" href={`/admin/leads/${member.leadId}`}>{member.detail.identity.name}</Link><p className="mt-2 break-all text-sm text-[#4d4d4d]">{member.detail.identity.email ?? "Sin correo"}</p><p className="mt-1 text-sm text-[#4d4d4d]">{member.detail.identity.phone ?? "Sin teléfono"}</p>{!member.isPrimaryContact && <form action={removeLeadGroupMemberAction} className="mt-4"><input name="group_id" type="hidden" value={group.id} /><input name="lead_id" type="hidden" value={member.leadId} /><input name="operation_key" type="hidden" value={randomUUID()} /><button className="btn-secondary w-full text-sm" type="submit">Remover del caso</button></form>}</article>)}</div></section>

          <section className="surface-card p-5 md:p-6"><h2 className="text-xl font-semibold">Propiedades relacionadas</h2><div className="mt-5 grid gap-3">{[...properties.entries()].map(([key, property]) => <article className="rounded-2xl bg-[#f8f8f8] p-4" key={key}><h3 className="font-semibold">{property.title}</h3><p className="mt-1 text-xs text-[#6b7280]">Personas: {[...property.owners].join(", ")}</p>{property.slug && <Link className="mt-2 inline-flex text-sm font-semibold text-[#11518b] hover:underline" href={`/listados/${property.slug}`} target="_blank">Ver propiedad</Link>}</article>)}{properties.size === 0 && <p className="text-sm text-[#6b7280]">No hay propiedades relacionadas.</p>}</div></section>

          <section className="surface-card p-5 md:p-6"><div className="flex items-center gap-3"><FileText className="h-5 w-5 text-[#11518b]" /><h2 className="text-xl font-semibold">Documentos</h2></div><div className="mt-5 grid gap-4">{documents.map((document) => { const href = `/admin/leads/${document.ownerId}/documents/${document.source}/${document.submissionId}`; return <article className="min-w-0 rounded-3xl border border-[#e8e8e8] p-5" key={`${document.ownerId}-${document.source}-${document.submissionId}`}><h3 className="break-words font-semibold">{document.categoryLabel}</h3><p className="mt-1 text-sm text-[#4d4d4d]">Dueño: <Link className="font-semibold text-[#11518b] hover:underline" href={`/admin/leads/${document.ownerId}`}>{document.ownerName}</Link></p><p className="mt-2 break-all text-sm">{document.originalName ?? "Nombre no disponible"}</p><p className="mt-1 text-xs text-[#6b7280]">{document.contentType ?? "Tipo no disponible"} · {formatDocumentSize(document.sizeBytes)} · {LEAD_DOCUMENT_STATE_LABELS[document.state]}</p>{document.state === "available" && <div className="mt-4"><DocumentAccessButtons downloadHref={href} previewHref={document.previewable ? `${href}?mode=preview` : null} /></div>}</article>; })}{documents.length === 0 && <p className="text-sm text-[#6b7280]">No hay documentos en este caso.</p>}</div></section>

          <section className="surface-card p-5 md:p-6"><h2 className="text-xl font-semibold">Cronología combinada</h2><ol className="mt-5 border-l border-[#d9d9d9] pl-5">{timeline.map((item) => <li className="relative pb-5 last:pb-0" key={item.id}><span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#d4af37] ring-4 ring-white" /><time className="text-xs text-[#6b7280]">{formatDate(item.at)}</time><p className="mt-1 text-sm font-semibold">{item.label}</p><p className="mt-1 text-xs text-[#6b7280]">{item.owner}{item.detail ? ` · ${item.detail}` : ""}</p></li>)}</ol></section>
        </div>

        <aside className="min-w-0 space-y-6">
          <section className="surface-card p-5"><h2 className="text-lg font-semibold">Controles del caso</h2><form action={updateLeadGroupAction} className="mt-4"><input name="group_id" type="hidden" value={group.id} /><input name="operation_key" type="hidden" value={randomUUID()} /><input name="intent" type="hidden" value="status" /><label className="text-sm font-semibold" htmlFor="group-status">Estado</label><select className="input-field mt-2 w-full" defaultValue={group.status} id="group-status" name="status">{Object.entries(LEAD_GROUP_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="btn-primary mt-3 w-full" type="submit">Guardar estado</button></form><form action={updateLeadGroupAction} className="mt-5 border-t border-[#eeeeee] pt-5"><input name="group_id" type="hidden" value={group.id} /><input name="operation_key" type="hidden" value={randomUUID()} /><input name="intent" type="hidden" value="follow_up" /><label className="flex items-center gap-2 text-sm font-semibold" htmlFor="group-follow-up"><CalendarClock className="h-4 w-4" />Próximo seguimiento</label><input className="input-field mt-2 w-full" defaultValue={dateTimeLocal(group.nextFollowUpAt)} id="group-follow-up" name="next_follow_up_at" type="datetime-local" /><button className="btn-secondary mt-3 w-full" type="submit">Guardar seguimiento</button></form></section>

          <section className="surface-card p-5"><div className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-[#11518b]" /><h2 className="text-lg font-semibold">Notas compartidas</h2></div><form action={addLeadGroupNoteAction} className="mt-4"><input name="group_id" type="hidden" value={group.id} /><input name="operation_key" type="hidden" value={randomUUID()} /><textarea className="input-field min-h-28 w-full" maxLength={5000} name="body" placeholder="Nota para todo el caso" required /><button className="btn-primary mt-3 w-full" type="submit">Guardar nota compartida</button></form><div className="mt-4 grid gap-3">{group.sharedNotes.map((note) => <article className="rounded-2xl bg-[#f8f8f8] p-4" key={note.id}><p className="whitespace-pre-wrap break-words text-sm">{note.body}</p><p className="mt-2 text-xs text-[#6b7280]">Caso compartido · {formatDate(note.createdAt)}</p></article>)}</div></section>

          <section className="surface-card p-5"><h2 className="text-lg font-semibold">Notas individuales</h2><div className="mt-4 grid gap-3">{individualNotes.map((note) => <article className="rounded-2xl border border-[#e8e8e8] p-4" key={`${note.ownerName}-${note.id}`}><p className="text-xs font-semibold text-[#11518b]">{note.ownerName}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{note.body}</p></article>)}{individualNotes.length === 0 && <p className="text-sm text-[#6b7280]">No hay notas individuales.</p>}</div></section>

          <section className="surface-card p-5"><h2 className="text-lg font-semibold">Añadir persona</h2><form action={`/admin/lead-groups/${group.id}`} className="mt-4" method="get"><input className="input-field w-full" defaultValue={memberSearch} minLength={2} name="member_q" placeholder="Nombre, correo o teléfono" required /><button className="btn-secondary mt-3 w-full" type="submit">Buscar</button></form><div className="mt-4 grid gap-3">{candidates.map((candidate) => <form action={addLeadGroupMemberAction} className="rounded-2xl border border-[#e8e8e8] p-4" key={candidate.id}><input name="group_id" type="hidden" value={group.id} /><input name="lead_id" type="hidden" value={candidate.id} /><input name="operation_key" type="hidden" value={randomUUID()} /><Link className="break-words font-semibold text-[#11518b] hover:underline" href={`/admin/leads/${candidate.id}`}>{candidate.name}</Link><select className="input-field mt-3 w-full" name="role">{Object.entries(LEAD_GROUP_ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="btn-primary mt-3 w-full" type="submit">Añadir al caso</button></form>)}</div></section>
        </aside>
      </div>
    </AdminPageShell>
  );
}
