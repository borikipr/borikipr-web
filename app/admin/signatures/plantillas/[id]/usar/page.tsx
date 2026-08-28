import { notFound,redirect } from "next/navigation";
import { AdminPageHeader,AdminPageShell } from "@/components/admin/AdminPageShell";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { createSignatureProductRepository } from "@/lib/signatures/productization";
import { listSignatureBrokerCandidates } from "@/lib/signatures/broker-candidates";

export default async function UseSignatureTemplatePage({params}:{params:Promise<{id:string}>}){
  if(!(await getAdminSessionUser()))redirect("/admin/login");const {id}=await params;
  const database=createPostgresSignatureDatabase(sql);
  const template=await createSignatureProductRepository(database).template(id);if(!template)notFound();
  const brokerCandidates=template.requiresBrokerSignature?await listSignatureBrokerCandidates(database):[];
  return <AdminPageShell><AdminPageHeader breadcrumbs={[{href:"/admin",label:"Admin"},{href:"/admin/signatures",label:"Firmas"},{href:"/admin/signatures/plantillas",label:"Plantillas"},{label:template.name}]} eyebrow="Nueva solicitud" title={`Usar ${template.name}`} description="Confirma los destinatarios reales. La plantilla no reutiliza personas, firmas ni accesos anteriores."/>
    <form action={`/api/admin/signatures/templates/${template.id}/instantiate`} method="post" className="surface-card grid gap-5 p-5"><label className="text-sm font-semibold">Título de la solicitud<input className="mt-1 w-full rounded-lg border px-3 py-3 font-normal" name="title" defaultValue={template.name} required/></label><label className="text-sm font-semibold max-w-md">Expira (hora de Puerto Rico)<input className="mt-1 w-full rounded-lg border px-3 py-3 font-normal" name="expiresAt" type="datetime-local" required/></label>
      <section><h2 className="font-semibold">Destinatarios</h2><div className="mt-3 grid gap-3">{template.roles.filter((role)=>!role.isBrokerFinalSigner).map((role)=><div className="grid gap-3 rounded-xl border p-4 md:grid-cols-2" key={role.key}><p className="font-semibold md:col-span-2">{role.role} · Grupo {role.routingOrder??1}{role.optional?" · Opcional":""}</p><label className="text-sm font-semibold">Nombre<input className="mt-1 w-full rounded-lg border px-3 py-3 font-normal" name={`name:${role.key}`} required={!role.optional}/></label><label className="text-sm font-semibold">Correo<input className="mt-1 w-full rounded-lg border px-3 py-3 font-normal" name={`email:${role.key}`} type="email" required={!role.optional}/></label>{role.optional&&<p className="text-xs text-slate-500 md:col-span-2">Para omitir este rol, deja ambos campos vacíos.</p>}</div>)}</div>{template.requiresBrokerSignature&&(brokerCandidates.length===1?<p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><strong>Firmará al final:</strong> {brokerCandidates[0].name}</p>:brokerCandidates.length>1?<label className="mt-3 block text-sm font-semibold">Corredor(a) firmante<select className="mt-1 w-full rounded-lg border px-3 py-3 font-normal" name="brokerCandidateId" required><option value="">Selecciona un corredor(a)</option>{brokerCandidates.map((candidate)=><option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>:<p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">No hay un corredor autorizado disponible para este documento.</p>)}</section>
      <button className="btn-primary justify-self-start" type="submit">Crear solicitud desde plantilla</button></form>
  </AdminPageShell>;
}
