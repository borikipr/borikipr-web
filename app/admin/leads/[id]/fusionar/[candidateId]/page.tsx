import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { LeadMergeConfirmation } from "@/components/admin/LeadMergeConfirmation";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { CANONICAL_LEAD_SOURCE_LABELS } from "@/lib/admin/queries/canonical-leads";
import { getLeadMergeComparison } from "@/lib/admin/queries/lead-identity-management";
import { LEAD_RELATIONSHIP_LABELS, LEAD_STATUS_LABELS, type Lead360Detail } from "@/lib/admin/queries/lead-360";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-PR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Puerto_Rico",
  }).format(new Date(value));
}

function ComparisonCard({ detail }: { detail: Lead360Detail }) {
  const sourceCounts = Object.entries(
    detail.interactions.reduce<Record<string, number>>((counts, interaction) => {
      counts[interaction.sourceType] = (counts[interaction.sourceType] ?? 0) + 1;
      return counts;
    }, {})
  );
  const properties = Array.from(new Map(
    detail.interactions
      .filter((interaction) => interaction.propertyTitle)
      .map((interaction) => [
        `${interaction.propertySlug ?? ""}:${interaction.propertyTitle}`,
        interaction.propertyTitle!,
      ])
  ).values());

  return (
    <article className="surface-card min-w-0 p-5 md:p-6">
      <h2 className="break-words text-xl font-semibold">{detail.identity.name}</h2>
      <dl className="mt-5 grid min-w-0 gap-4 text-sm sm:grid-cols-2">
        <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Correo</dt><dd className="mt-1 break-all">{detail.identity.email ?? "Sin correo"}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Teléfono</dt><dd className="mt-1 break-words">{detail.identity.phone ?? "Sin teléfono"}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Creado</dt><dd className="mt-1">{formatDate(detail.identity.createdAt)}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Última actividad</dt><dd className="mt-1">{formatDate(detail.identity.lastActivityAt)}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Estado</dt><dd className="mt-1">{LEAD_STATUS_LABELS[detail.identity.status]}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Próximo seguimiento</dt><dd className="mt-1">{formatDate(detail.identity.nextFollowUpAt)}</dd></div>
      </dl>

      <div className="mt-5 grid min-w-0 gap-4 border-t border-[#eeeeee] pt-5 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">Interacciones por fuente</h3>
          {sourceCounts.length > 0 ? (
            <ul className="mt-2 grid gap-1 text-sm text-[#4d4d4d]">
              {sourceCounts.map(([source, count]) => (
                <li className="flex justify-between gap-3" key={source}>
                  <span>{CANONICAL_LEAD_SOURCE_LABELS[source as keyof typeof CANONICAL_LEAD_SOURCE_LABELS]}</span>
                  <span className="font-semibold">{count}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-[#6b7280]">Sin interacciones.</p>}
        </div>
        <div>
          <h3 className="text-sm font-semibold">Totales relacionados</h3>
          <ul className="mt-2 grid gap-1 text-sm text-[#4d4d4d]">
            <li className="flex justify-between gap-3"><span>Notas</span><strong>{detail.notes.length}</strong></li>
            <li className="flex justify-between gap-3"><span>Documentos</span><strong>{detail.documents.length}</strong></li>
            <li className="flex justify-between gap-3"><span>Relaciones</span><strong>{detail.relationships.length}</strong></li>
            <li className="flex justify-between gap-3"><span>Eventos administrativos</span><strong>{detail.managementEvents.length}</strong></li>
          </ul>
        </div>
      </div>

      <div className="mt-5 border-t border-[#eeeeee] pt-5">
        <h3 className="text-sm font-semibold">Propiedades relacionadas</h3>
        {properties.length > 0 ? (
          <ul className="mt-2 grid gap-1 text-sm text-[#4d4d4d]">
            {properties.map((property) => <li className="break-words" key={property}>{property}</li>)}
          </ul>
        ) : <p className="mt-2 text-sm text-[#6b7280]">Sin propiedad relacionada.</p>}
      </div>

      <div className="mt-5 border-t border-[#eeeeee] pt-5">
        <h3 className="text-sm font-semibold">Relaciones existentes</h3>
        {detail.relationships.length > 0 ? (
          <ul className="mt-2 grid gap-2 text-sm">
            {detail.relationships.map((relationship) => (
              <li className="min-w-0 rounded-xl bg-[#f8f8f8] p-3" key={relationship.id}>
                <span className="break-words font-semibold">{relationship.relatedLeadName}</span>
                <span className="ml-2 text-[#6b7280]">{LEAD_RELATIONSHIP_LABELS[relationship.type]}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-[#6b7280]">Sin relaciones registradas.</p>}
      </div>
    </article>
  );
}

export default async function LeadMergeReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; candidateId: string }>;
  searchParams: Promise<{ merge_error?: string | string[] }>;
}) {
  const username = await getAdminSessionUser();
  if (!username) redirect("/admin/login");
  const { id, candidateId } = await params;
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(candidateId) || id === candidateId) notFound();
  const comparison = await getLeadMergeComparison(id, candidateId);
  if (!comparison) notFound();
  const query = await searchParams;
  const mergeError = Array.isArray(query.merge_error) ? query.merge_error[0] : query.merge_error;

  const { identifiers } = comparison;
  const totalInteractions = comparison.left.detail.interactions.length + comparison.right.detail.interactions.length;
  const totalNotes = comparison.left.detail.notes.length + comparison.right.detail.notes.length;
  const totalDocuments = comparison.left.detail.documents.length + comparison.right.detail.documents.length;
  const totalRelationships = comparison.left.detail.relationships.length + comparison.right.detail.relationships.length;

  return (
    <AdminPageShell>
      <AdminPageHeader
        actions={<Link className="btn-secondary" href={`/admin/leads/${id}`}><ArrowLeft className="h-4 w-4" />Volver</Link>}
        breadcrumbs={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/leads", label: "Leads" },
          { href: `/admin/leads/${id}`, label: comparison.left.detail.identity.name },
          { label: "Revisión de fusión" },
        ]}
        description="Compara ambas identidades, elige cuál permanecerá activa y confirma la operación en dos pasos."
        eyebrow="Identidad avanzada"
        title="Revisar posible duplicado"
      />

      {mergeError === "rolled_back" && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold leading-6 text-red-900" role="alert">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          No se pudo completar la fusión. Ningún cambio fue aplicado. Revisa el estado de ambos registros antes de intentarlo nuevamente.
        </div>
      )}

      <section className="rounded-[2rem] border border-amber-300 bg-amber-50 p-5 md:p-6">
        <div className="flex gap-4">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
          <div className="min-w-0">
            <h2 className="font-semibold text-amber-950">Esta operación no es una eliminación simple</h2>
            <p className="mt-1 text-sm leading-6 text-amber-900">
              Una identidad permanecerá como principal. La otra quedará archivada como fusionada y todas las dependencias compatibles se moverán dentro de una sola transacción.
            </p>
          </div>
        </div>
      </section>

      <section className="surface-card p-5 md:p-6" aria-labelledby="identifier-comparison-heading">
        <h2 className="text-xl font-semibold" id="identifier-comparison-heading">Coincidencias y diferencias</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {(identifiers.emailMatches || identifiers.phoneMatches) && (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />Coincide: {[identifiers.emailMatches && "correo", identifiers.phoneMatches && "teléfono"].filter(Boolean).join(" y ")}</span>
          )}
          {(identifiers.emailDiffers || identifiers.phoneDiffers) && (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900"><AlertTriangle className="h-4 w-4" />Difiere: {[identifiers.emailDiffers && "correo", identifiers.phoneDiffers && "teléfono"].filter(Boolean).join(" y ")}</span>
          )}
          {!identifiers.emailMatches && !identifiers.phoneMatches && !identifiers.emailDiffers && !identifiers.phoneDiffers && (
            <span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">No hay identificadores suficientes para comparar.</span>
          )}
        </div>
        {comparison.existingDecision && <p className="mt-3 text-sm text-[#4d4d4d]">Decisión previa: <strong>{comparison.existingDecision === "keep_separate" ? "Mantener separadas" : "Misma persona"}</strong></p>}
      </section>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <ComparisonCard detail={comparison.left.detail} />
        <ComparisonCard detail={comparison.right.detail} />
      </div>

      <section className="surface-card p-5 md:p-6" aria-labelledby="affected-summary-heading">
        <h2 className="text-xl font-semibold" id="affected-summary-heading">Resumen antes de fusionar</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-[#f8f8f8] p-4"><dt className="text-sm text-[#6b7280]">Interacciones</dt><dd className="mt-1 text-2xl font-semibold">{totalInteractions}</dd></div>
          <div className="rounded-2xl bg-[#f8f8f8] p-4"><dt className="text-sm text-[#6b7280]">Notas</dt><dd className="mt-1 text-2xl font-semibold">{totalNotes}</dd></div>
          <div className="rounded-2xl bg-[#f8f8f8] p-4"><dt className="text-sm text-[#6b7280]">Documentos</dt><dd className="mt-1 text-2xl font-semibold">{totalDocuments}</dd></div>
          <div className="rounded-2xl bg-[#f8f8f8] p-4"><dt className="text-sm text-[#6b7280]">Relaciones</dt><dd className="mt-1 text-2xl font-semibold">{totalRelationships}</dd></div>
        </dl>
      </section>

      <section className="surface-card p-5 md:p-6" aria-labelledby="merge-confirmation-heading">
        <h2 className="text-xl font-semibold" id="merge-confirmation-heading">Confirmación final</h2>
        <p className="mt-2 text-sm leading-6 text-[#4d4d4d]">El correo, teléfono y nombre de la identidad principal no se sobrescribirán. Los valores alternos quedarán preservados en el historial de fusión.</p>
        <div className="mt-5">
          <LeadMergeConfirmation
            left={{ id: comparison.left.detail.identity.id, name: comparison.left.detail.identity.name }}
            operationKey={randomUUID()}
            right={{ id: comparison.right.detail.identity.id, name: comparison.right.detail.identity.name }}
          />
        </div>
      </section>
    </AdminPageShell>
  );
}
