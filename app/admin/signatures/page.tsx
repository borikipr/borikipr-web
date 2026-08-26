import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AdminPageHeader,
  AdminPageShell,
} from "@/components/admin/AdminPageShell";
import { EmptyState, FilterBar } from "@/components/admin/AdminUI";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createSignatureAdminRepository } from "@/lib/signatures/admin-repository";
import {
  signatureDeliveryLabel,
  signatureRequiresAttention,
  signatureStatusLabel,
  signatureStatusTone,
  SIGNATURE_STATUS_LABELS,
} from "@/lib/signatures/admin-ux";
import { formatPuertoRicoDate } from "@/lib/puerto-rico-time";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { SIGNATURE_DOCUMENT_TYPES } from "@/lib/signatures/document-classification";
import { signatureActionPolicy } from "@/lib/signatures/action-policy";

const VIEWS = [
  { id: "active", label: "Recientes" },
  { id: "drafts", label: "Borradores" },
  { id: "waiting", label: "Esperando firmas" },
  { id: "attention", label: "Requiere atención" },
  { id: "completed", label: "Completados" },
  { id: "cancelled", label: "Cancelados" },
  { id: "archived", label: "Archivados" },
  { id: "all", label: "Todos" },
] as const;

export default async function SignatureDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    documentType?: string;
    view?: string;
  }>;
}) {
  if (!(await getAdminSessionUser())) redirect("/admin/login");
  const params = await searchParams;
  const view = VIEWS.some((item) => item.id === params.view)
    ? params.view!
    : "active";
  const repository = createSignatureAdminRepository(
    createPostgresSignatureDatabase(sql),
  );
  const rows = await repository.list({ ...params, view });

  return (
    <AdminPageShell>
      <AdminPageHeader
        breadcrumbs={[{ href: "/admin", label: "Admin" }, { label: "Firmas" }]}
        eyebrow="Firmas"
        title="Solicitudes de firma"
        description="Prepara documentos, añade destinatarios, coloca campos y revisa antes de enviar. La configuración avanzada solo aparece cuando hace falta."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link className="btn-secondary" href="/admin/signatures/plantillas">
              Plantillas
            </Link>
            <Link
              className="btn-secondary"
              href="/admin/signatures/configuracion"
            >
              Configuración
            </Link>
            <Link className="btn-primary" href="/admin/signatures/nuevo">
              Nuevo documento
            </Link>
          </div>
        }
      />

      <FilterBar className="signature-directory-toolbar md:grid-cols-4">
        <nav
          aria-label="Vistas de solicitudes"
          className="signature-lifecycle-tabs md:col-span-4"
        >
          {VIEWS.map((item) => (
            <Link
              key={item.id}
              href={`/admin/signatures?view=${item.id}`}
              aria-current={view === item.id ? "page" : undefined}
              className={view === item.id ? "is-active" : ""}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <details className="signature-lifecycle-mobile-menu md:col-span-4">
          <summary>
            <span>Vista</span>
            <strong>{VIEWS.find((item) => item.id === view)?.label}</strong>
          </summary>
          <nav aria-label="Cambiar vista de solicitudes">
            {VIEWS.map((item) => (
              <Link
                key={item.id}
                href={`/admin/signatures?view=${item.id}`}
                aria-current={view === item.id ? "page" : undefined}
                className={view === item.id ? "is-active" : ""}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </details>
        <form className="contents" method="get">
          <input name="view" type="hidden" value={view} />
          <label className="md:col-span-2">
            <span className="text-sm font-semibold">Buscar</span>
            <input
              className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3"
              name="search"
              defaultValue={params.search}
              placeholder="Documento o destinatario"
            />
          </label>
          <label>
            <span className="text-sm font-semibold">Estado</span>
            <select
              className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3"
              name="status"
              defaultValue={params.status ?? "all"}
            >
              <option value="all">Todos</option>
              {Object.entries(SIGNATURE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-sm font-semibold">Tipo</span>
            <select
              className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3"
              name="documentType"
              defaultValue={params.documentType ?? "all"}
            >
              <option value="all">Todos</option>
              {SIGNATURE_DOCUMENT_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn-secondary self-end md:justify-self-start"
            type="submit"
          >
            Aplicar filtros
          </button>
        </form>
      </FilterBar>

      <section aria-label="Lista de solicitudes" className="grid gap-4">
        {rows.length === 0 ? (
          <EmptyState
            title={
              view === "archived"
                ? "No hay solicitudes archivadas"
                : view === "attention"
                  ? "Nada requiere atención"
                  : "Todavía no hay solicitudes en esta vista"
            }
            description={
              view === "attention"
                ? "Las solicitudes que esperan normalmente no aparecen aquí."
                : "Comienza con un PDF y añade quién debe firmar."
            }
            action={
              view === "active" ? (
                <Link className="btn-primary" href="/admin/signatures/nuevo">
                  Nuevo documento
                </Link>
              ) : undefined
            }
          />
        ) : (
          rows.map((row) => {
            const attention = signatureRequiresAttention({
              status: row.status,
              deliveryStatus: row.last_delivery_status,
              expiresAt: row.expires_at,
            });
            const operationallyHidden = Boolean(row.operationally_hidden_at && !row.operationally_restored_at);
            const actions = signatureActionPolicy({
              status: row.status,
              operationallyHidden,
              sourceAvailable: true,
              deletionEligible: false,
            });
            return (
              <article className="signature-document-row" key={row.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="min-w-0 break-words text-lg font-semibold">
                      {row.title}
                    </h2>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${signatureStatusTone(row.status)}`}
                    >
                      {signatureStatusLabel(row.status)}
                    </span>
                    {attention ? (
                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
                        Requiere atención
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    {row.status === "partially_signed" ||
                    row.status === "sent" ||
                    row.status === "viewed"
                      ? row.current_signer_label
                        ? `Esperando la firma de ${row.current_signer_label}`
                        : `${Number(row.completed_participant_count)} de ${Number(row.participant_count)} firmas completadas`
                      : `${Number(row.completed_participant_count)} de ${Number(row.participant_count)} firmas completadas`}
                  </p>
                  <dl className="admin-meta-grid mt-3 grid gap-x-5 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt>Progreso</dt>
                      <dd>
                        {Number(row.completed_participant_count)} de{" "}
                        {Number(row.participant_count)} destinatarios
                      </dd>
                    </div>
                    <div>
                      <dt>Última actividad</dt>
                      <dd>
                        {formatPuertoRicoDate(row.updated_at)}
                      </dd>
                    </div>
                    <div>
                      <dt>Expiración</dt>
                      <dd>
                        {row.expires_at
                          ? formatPuertoRicoDate(row.expires_at)
                          : "Sin fecha"}
                      </dd>
                    </div>
                    <div>
                      <dt>Entrega</dt>
                      <dd>
                        {signatureDeliveryLabel(row.last_delivery_status)}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="grid gap-2 justify-self-start md:justify-self-end">
                  {row.status === "completed" && <div className="flex flex-wrap gap-2">
                    <Link className="btn-primary" href={`/admin/signatures/${row.id}/final`}>Descargar documento firmado</Link>
                    <Link className="btn-secondary" href={`/admin/signatures/${row.id}/certificate`}>Descargar certificado</Link>
                  </div>}
                  <details className="signature-actions md:justify-self-end">
                    <summary className="btn-secondary">Acciones</summary>
                    <div className="signature-actions-menu md:absolute md:right-0 md:z-20">
                      <Link href={`/admin/signatures/${row.id}`}>{row.status === "draft" ? "Editar" : "Ver"}</Link>
                      {actions.includes("resend") && <Link href={`/admin/signatures/${row.id}#destinatarios`}>Reenviar invitación</Link>}
                      {actions.includes("remind") && <Link href={`/admin/signatures/${row.id}#destinatarios`}>Recordar</Link>}
                      {actions.includes("correct") && <Link href={`/admin/signatures/${row.id}#acciones`}>Corregir</Link>}
                      {actions.includes("cancel") && <Link href={`/admin/signatures/${row.id}#acciones`}>Cancelar solicitud</Link>}
                      {actions.includes("duplicate") && <Link href={`/admin/signatures/${row.id}#acciones`}>Duplicar</Link>}
                      {actions.includes("archive") && <Link href={`/admin/signatures/${row.id}#acciones`}>Archivar</Link>}
                      {actions.includes("restore") && <Link href={`/admin/signatures/${row.id}#acciones`}>Restaurar</Link>}
                      {actions.includes("history") && <Link href={`/admin/signatures/${row.id}#historial`}>Ver historial</Link>}
                    </div>
                  </details>
                </div>
              </article>
            );
          })
        )}
      </section>
    </AdminPageShell>
  );
}
