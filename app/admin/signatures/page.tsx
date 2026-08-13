import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createSignatureAdminRepository } from "@/lib/signatures/admin-repository";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { SIGNATURE_DOCUMENT_TYPES } from "@/lib/signatures/document-classification";

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviado",
  viewed: "Visto",
  partially_signed: "Firmado parcialmente",
  completed: "Completado",
  voided: "Anulado",
  expired: "Expirado",
};

export default async function SignatureDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; documentType?: string }>;
}) {
  if (!(await getAdminSessionUser())) redirect("/admin/login");
  const params = await searchParams;
  const repository = createSignatureAdminRepository(createPostgresSignatureDatabase(sql));
  const rows = await repository.list(params);

  return (
    <AdminPageShell>
      <AdminPageHeader
        breadcrumbs={[{ href: "/admin", label: "Admin" }, { label: "Firmas" }]}
        eyebrow="Admin · Firmas"
        title="Solicitudes de firma"
        description="Área interna para preparar borradores del flujo de corretaje. Preparar no equivale a enviar; el envío conserva controles separados de gobernanza y activación."
        actions={<div className="flex flex-wrap gap-2"><Link className="btn-secondary" href="/admin/signatures/gobernanza">Gobernanza</Link><Link className="btn-primary" href="/admin/signatures/nuevo">Nuevo borrador</Link></div>}
      />

      <form className="surface-card grid gap-4 p-5 md:grid-cols-4" method="get">
        <label className="md:col-span-2">
          <span className="text-sm font-semibold">Buscar</span>
          <input className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3" name="search" defaultValue={params.search} placeholder="Título o participante" />
        </label>
        <label>
          <span className="text-sm font-semibold">Estado</span>
          <select className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3" name="status" defaultValue={params.status ?? "all"}>
            <option value="all">Todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span className="text-sm font-semibold">Tipo</span>
          <select className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3" name="documentType" defaultValue={params.documentType ?? "all"}>
            <option value="all">Todos</option>
            {SIGNATURE_DOCUMENT_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
          </select>
        </label>
        <button className="btn-secondary md:col-span-4 md:justify-self-start" type="submit">Aplicar filtros</button>
      </form>

      <section className="surface-card overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center">
            <h2 className="text-xl font-semibold">No hay borradores de firma</h2>
            <p className="mt-2 text-[#4d4d4d]">Carga un PDF compatible para comenzar una preparación interna.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead className="bg-[#0d1b2a] text-left text-sm text-white"><tr><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Participantes</th><th className="px-4 py-3">Entrega</th><th className="px-4 py-3">Páginas</th><th className="px-4 py-3">Actualizado</th><th className="px-4 py-3">Acción</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="border-b border-[#e5e5e5]" key={row.id}>
                    <td className="px-4 py-4"><p className="font-semibold">{row.title}</p><p className="mt-1 text-xs text-[#666]">{row.document_type}</p></td>
                    <td className="px-4 py-4">{STATUS_LABELS[row.status] ?? row.status}</td>
                    <td className="px-4 py-4">{Number(row.completed_participant_count)} / {Number(row.participant_count)}</td>
                    <td className="px-4 py-4">{row.last_delivery_status ?? "Sin entrega"}</td>
                    <td className="px-4 py-4">{row.page_count}</td>
                    <td className="px-4 py-4">{new Date(row.updated_at).toLocaleDateString("es-PR")}</td>
                    <td className="px-4 py-4"><Link className="font-semibold text-[#11518b] hover:underline" href={`/admin/signatures/${row.id}`}>Abrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminPageShell>
  );
}
