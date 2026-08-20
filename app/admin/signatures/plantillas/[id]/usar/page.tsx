import { notFound,redirect } from "next/navigation";
import { AdminPageHeader,AdminPageShell } from "@/components/admin/AdminPageShell";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { createSignatureProductRepository } from "@/lib/signatures/productization";

export default async function UseSignatureTemplatePage({params}:{params:Promise<{id:string}>}){
  if(!(await getAdminSessionUser()))redirect("/admin/login");const {id}=await params;
  const template=await createSignatureProductRepository(createPostgresSignatureDatabase(sql)).template(id);if(!template)notFound();
  const minimum=new Date();minimum.setUTCDate(minimum.getUTCDate()+1);const minimumDate=minimum.toISOString().slice(0,10);
  return <AdminPageShell><AdminPageHeader breadcrumbs={[{href:"/admin",label:"Admin"},{href:"/admin/signatures",label:"Firmas"},{href:"/admin/signatures/plantillas",label:"Plantillas"},{label:template.name}]} eyebrow="Nueva solicitud" title={`Usar ${template.name}`} description="Confirma los destinatarios reales. La plantilla no reutiliza personas, firmas ni accesos anteriores."/>
    <form action={`/api/admin/signatures/templates/${template.id}/instantiate`} method="post" className="surface-card grid gap-5 p-5"><label className="text-sm font-semibold">Título de la solicitud<input className="mt-1 w-full rounded-lg border px-3 py-3 font-normal" name="title" defaultValue={template.name} required/></label><label className="text-sm font-semibold max-w-md">Expira<input className="mt-1 w-full rounded-lg border px-3 py-3 font-normal" name="expiresOn" type="date" min={minimumDate} required/></label>
      <section><h2 className="font-semibold">Destinatarios</h2><div className="mt-3 grid gap-3">{template.roles.filter((role)=>!role.isBrokerFinalSigner).map((role)=><div className="grid gap-3 rounded-xl border p-4 md:grid-cols-2" key={role.key}><p className="font-semibold md:col-span-2">{role.role} · Grupo {role.routingOrder??1}{role.optional?" · Opcional":""}</p><label className="text-sm font-semibold">Nombre<input className="mt-1 w-full rounded-lg border px-3 py-3 font-normal" name={`name:${role.key}`} required={!role.optional}/></label><label className="text-sm font-semibold">Correo<input className="mt-1 w-full rounded-lg border px-3 py-3 font-normal" name={`email:${role.key}`} type="email" required={!role.optional}/></label>{role.optional&&<p className="text-xs text-slate-500 md:col-span-2">Para omitir este rol, deja ambos campos vacíos.</p>}</div>)}</div>{template.requiresBrokerSignature&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">Ivonne se añadirá automáticamente como Corredora · Firma final.</p>}</section>
      <button className="btn-primary justify-self-start" type="submit">Crear solicitud desde plantilla</button></form>
  </AdminPageShell>;
}
