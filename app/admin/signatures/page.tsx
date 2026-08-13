import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createSignatureAdminRepository } from "@/lib/signatures/admin-repository";
import { signatureStatusLabel, signatureStatusTone, SIGNATURE_STATUS_LABELS } from "@/lib/signatures/admin-ux";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { SIGNATURE_DOCUMENT_TYPES } from "@/lib/signatures/document-classification";

const VIEWS = [{id:"active",label:"Activos"},{id:"completed",label:"Completados"},{id:"archived",label:"Archivados"},{id:"all",label:"Todos"}] as const;

export default async function SignatureDocumentsPage({ searchParams }: {
  searchParams: Promise<{ search?: string; status?: string; documentType?: string; view?: string }>;
}) {
  if (!(await getAdminSessionUser())) redirect("/admin/login");
  const params = await searchParams;
  const view=VIEWS.some((item)=>item.id===params.view) ? params.view! : "active";
  const repository = createSignatureAdminRepository(createPostgresSignatureDatabase(sql));
  const rows = await repository.list({...params,view});

  return (
    <AdminPageShell>
      <AdminPageHeader
        breadcrumbs={[{ href: "/admin", label: "Admin" }, { label: "Firmas" }]}
        eyebrow="Firmas"
        title="Solicitudes de firma"
        description="Prepara documentos, añade destinatarios, coloca campos y revisa antes de enviar. La configuración avanzada solo aparece cuando hace falta."
        actions={<div className="flex flex-wrap gap-2"><Link className="btn-secondary" href="/admin/signatures/gobernanza">Gobernanza</Link><Link className="btn-primary" href="/admin/signatures/nuevo">Nuevo documento</Link></div>}
      />

      <nav aria-label="Vistas de solicitudes" className="flex max-w-full flex-wrap gap-2 pb-1">
        {VIEWS.map((item)=><Link key={item.id} href={`/admin/signatures?view=${item.id}`} aria-current={view===item.id?"page":undefined}
          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${view===item.id?"border-[#0d1b2a] bg-[#0d1b2a] text-white":"border-slate-300 bg-white text-slate-700"}`}>{item.label}</Link>)}
      </nav>

      <form className="surface-card grid gap-4 p-5 md:grid-cols-4" method="get">
        <input name="view" type="hidden" value={view} />
        <label className="md:col-span-2"><span className="text-sm font-semibold">Buscar</span><input className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3" name="search" defaultValue={params.search} placeholder="Documento o destinatario" /></label>
        <label><span className="text-sm font-semibold">Estado</span><select className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3" name="status" defaultValue={params.status ?? "all"}><option value="all">Todos</option>{Object.entries(SIGNATURE_STATUS_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label><span className="text-sm font-semibold">Tipo</span><select className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3" name="documentType" defaultValue={params.documentType ?? "all"}><option value="all">Todos</option>{SIGNATURE_DOCUMENT_TYPES.map((type)=><option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
        <button className="btn-secondary md:col-span-4 md:justify-self-start" type="submit">Aplicar filtros</button>
      </form>

      <section aria-label="Lista de solicitudes" className="grid gap-4">
        {rows.length===0 ? <div className="surface-card p-10 text-center"><h2 className="text-xl font-semibold">{view==="archived"?"No hay solicitudes archivadas":"Todavía no hay solicitudes en esta vista"}</h2><p className="mt-2 text-[#4d4d4d]">Comienza con un PDF y añade quién debe firmar.</p>{view==="active"&&<Link className="btn-primary mt-5 inline-flex" href="/admin/signatures/nuevo">Nuevo documento</Link>}</div> : rows.map((row)=><article className="surface-card grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" key={row.id}>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="min-w-0 break-words text-lg font-semibold">{row.title}</h2><span className={`rounded-full px-3 py-1 text-xs font-bold ${signatureStatusTone(row.status)}`}>{signatureStatusLabel(row.status)}</span></div>
            <dl className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="font-semibold text-slate-800">Destinatarios</dt><dd>{Number(row.completed_participant_count)} de {Number(row.participant_count)} completados</dd></div><div><dt className="font-semibold text-slate-800">Última actividad</dt><dd>{new Date(row.updated_at).toLocaleDateString("es-PR")}</dd></div><div><dt className="font-semibold text-slate-800">Expiración</dt><dd>{row.expires_at?new Date(row.expires_at).toLocaleDateString("es-PR"):"Sin fecha"}</dd></div><div><dt className="font-semibold text-slate-800">Entrega</dt><dd>{row.last_delivery_status??"Sin invitaciones"}</dd></div></dl>
          </div>
          <details className="relative justify-self-start md:justify-self-end"><summary className="btn-secondary cursor-pointer list-none">Acciones</summary><div className="mt-2 grid min-w-48 gap-1 rounded-xl border bg-white p-2 shadow-lg md:absolute md:right-0 md:z-20"><Link className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-100" href={`/admin/signatures/${row.id}`}>{row.status==="draft"?"Editar":"Abrir"}</Link>{row.status==="completed"&&<><Link className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-100" href={`/admin/signatures/${row.id}/final`}>Descargar documento firmado</Link><Link className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-100" href={`/admin/signatures/${row.id}/certificate`}>Descargar certificado</Link></>}</div></details>
        </article>)}
      </section>
    </AdminPageShell>
  );
}
