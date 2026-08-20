import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader,AdminPageShell } from "@/components/admin/AdminPageShell";
import { EmptyState } from "@/components/admin/AdminUI";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { createSignatureProductRepository } from "@/lib/signatures/productization";

export default async function SignatureTemplatesPage(){
  if(!(await getAdminSessionUser())) redirect("/admin/login");
  const templates=await createSignatureProductRepository(createPostgresSignatureDatabase(sql)).templates();
  return <AdminPageShell><AdminPageHeader breadcrumbs={[{href:"/admin",label:"Admin"},{href:"/admin/signatures",label:"Firmas"},{label:"Plantillas"}]} eyebrow="Firmas" title="Plantillas" description="Documentos, roles, campos y ruta reutilizables. Nunca guardan firmas, valores, tokens ni sesiones." actions={<Link className="btn-secondary" href="/admin/signatures">Volver a documentos</Link>}/>
    {!templates.length?<EmptyState title="Aún no hay plantillas" description="Abre un borrador preparado y elige Guardar como plantilla. Los destinatarios reales se solicitan cada vez." action={<Link className="btn-primary" href="/admin/signatures/nuevo">Subir PDF</Link>}/>:<section className="grid gap-3">{templates.map((template)=><article className="surface-card grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" key={template.id}><div><h2 className="font-semibold">{template.name}</h2><p className="mt-1 text-sm text-slate-600">{template.description??`${template.roles.length} roles · ${template.fields.length} campos`}</p></div><Link className="btn-primary" href={`/admin/signatures/plantillas/${template.id}/usar`}>Usar plantilla</Link></article>)}</section>}
  </AdminPageShell>;
}
