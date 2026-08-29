import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AdminPageHeader,
  AdminPageShell,
} from "@/components/admin/AdminPageShell";
import { EmptyState } from "@/components/admin/AdminUI";
import { getAdminAccessContext } from "@/lib/admin/access-context";
import { sql } from "@/lib/db";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { createSignatureProductRepository } from "@/lib/signatures/productization";
import { signatureRoutingModeLabel } from "@/lib/signatures/routing-ux";

export default async function SignatureTemplatesPage() {
  const access = await getAdminAccessContext();
  if (!access) redirect("/admin/login");
  const canManage = access.isAdminBaseline || access.moduleAccess.get("signatures") === "manage";
  const templates = await createSignatureProductRepository(
    createPostgresSignatureDatabase(sql),
  ).templates();
  return (
    <AdminPageShell>
      <AdminPageHeader
        breadcrumbs={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/signatures", label: "Firmas" },
          { label: "Plantillas" },
        ]}
        eyebrow="Firmas"
        title="Plantillas"
        description="Documentos, roles, campos y ruta reutilizables. Nunca guardan firmas, valores, tokens ni sesiones."
        actions={
          <Link className="btn-secondary" href="/admin/signatures">
            Volver a documentos
          </Link>
        }
      />
      {!templates.length ? (
        <EmptyState
          title="Aún no hay plantillas"
          description="Abre un borrador preparado y elige Guardar como plantilla. Los destinatarios reales se solicitan cada vez."
          action={canManage ?
            <Link className="btn-primary" href="/admin/signatures/nuevo">
              Subir PDF
            </Link> : undefined}
        />
      ) : (
        <section className="signature-template-grid">
          {templates.map((template) => (
            <article className="signature-template-card" key={template.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="min-w-0 break-words font-semibold">
                  {template.name}
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">
                  {template.locale}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {template.description ??
                  "Plantilla reutilizable de Erickson Real Estate."}
              </p>
              <dl className="admin-meta-grid mt-4 grid grid-cols-2 gap-3">
                <div>
                  <dt>Roles</dt>
                  <dd>{template.roles.length}</dd>
                </div>
                <div>
                  <dt>Campos</dt>
                  <dd>{template.fields.length}</dd>
                </div>
                <div className="col-span-2">
                  <dt>Ruta</dt>
                  <dd>{signatureRoutingModeLabel(template.routingMode)}</dd>
                </div>
                {template.requiresBrokerSignature ? (
                  <div className="col-span-2">
                    <dt>Firma final</dt>
                    <dd>Corredor(a) asignado al crear · Firma final</dd>
                  </div>
                ) : null}
              </dl>
              {canManage ? <Link
                className="btn-primary mt-5 w-full sm:w-auto"
                href={`/admin/signatures/plantillas/${template.id}/usar`}
              >
                Usar plantilla
              </Link> : null}
            </article>
          ))}
        </section>
      )}
    </AdminPageShell>
  );
}
