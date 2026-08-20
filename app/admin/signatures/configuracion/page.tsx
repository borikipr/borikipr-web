import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader,AdminPageShell } from "@/components/admin/AdminPageShell";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { BROKER_SETTINGS_CONFIRMATION,createSignatureProductRepository } from "@/lib/signatures/productization";
import { isInternalCanarySigningEnabled,isPublicSigningEnabled } from "@/lib/signatures/public-config";
import { saveBrokerSettingsAction } from "./actions";

export default async function SignatureSettingsPage(){
  if(!(await getAdminSessionUser())) redirect("/admin/login");
  const data=await createSignatureProductRepository(createPostgresSignatureDatabase(sql)).settings();
  return <AdminPageShell><AdminPageHeader breadcrumbs={[{href:"/admin",label:"Admin"},{href:"/admin/signatures",label:"Firmas"},{label:"Configuración"}]} eyebrow="Firmas" title="Configuración de Firmas" description="Preferencias operacionales del flujo diario. La seguridad técnica permanece activa en segundo plano."/>
    <nav className="flex flex-wrap gap-2"><a className="btn-secondary" href="#general">General</a><a className="btn-secondary" href="#corredora">Corredora</a><a className="btn-secondary" href="#privacidad">Privacidad y conservación</a><a className="btn-secondary" href="#avanzado">Avanzado</a></nav>
    <section className="surface-card p-5" id="general"><h2 className="text-lg font-semibold">General</h2><dl className="admin-meta-grid mt-4 grid gap-4 sm:grid-cols-2"><div><dt>Canary interno</dt><dd>{isInternalCanarySigningEnabled()?"Activo":"Desactivado"}</dd></div><div><dt>Firma pública</dt><dd>{isPublicSigningEnabled()?"Activa":"Desactivada"}</dd></div></dl><p className="mt-3 text-sm text-slate-600">READY no equivale a ENABLED. La activación sigue siendo una acción operacional separada.</p></section>
    <section className="surface-card p-5" id="corredora"><h2 className="text-lg font-semibold">Corredora · firma final</h2><p className="mt-1 text-sm text-slate-600">Cuando un documento requiere firma de la corredora, Borikí la añade automáticamente al último grupo. El Admin que prepara o envía no ocupa su lugar.</p>{data.settings?.broker_admin_user_id?<p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Configurada: {data.settings.broker_name_snapshot}</p>:<p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">Todavía no hay una corredora configurada.</p>}
      <form action={saveBrokerSettingsAction} className="mt-5 grid gap-4 max-w-xl"><label className="text-sm font-semibold">Cuenta Admin de Ivonne<select className="mt-1 w-full rounded-lg border px-3 py-3 font-normal" name="brokerAdminUserId" required defaultValue={data.settings?.broker_admin_user_id??""}><option value="">Selecciona</option>{data.admins.filter((admin)=>admin.email).map((admin)=><option key={admin.id} value={admin.id}>{admin.name}</option>)}</select></label><label className="text-sm font-semibold">Escribe <code>{BROKER_SETTINGS_CONFIRMATION}</code><input className="mt-1 w-full rounded-lg border px-3 py-3 font-normal" name="confirmationPhrase" required/></label><button className="btn-primary justify-self-start" type="submit">Guardar corredora final</button></form>
    </section>
    <section className="surface-card p-5" id="privacidad"><h2 className="text-lg font-semibold">Privacidad y conservación</h2><p className="mt-2 text-sm text-slate-600">Consentimientos, divulgaciones, retención y legal holds continúan versionados e inmutables.</p><Link className="mt-3 inline-flex font-semibold text-[#11518b] hover:underline" href="/admin/signatures/gobernanza">Abrir controles avanzados</Link></section>
    <details className="surface-card p-5" id="avanzado"><summary className="cursor-pointer font-semibold">Avanzado</summary><p className="mt-3 text-sm text-slate-600">Readiness, recuperación, autorizaciones y evidencia técnica. No forman parte de la preparación diaria.</p><Link className="mt-3 inline-flex font-semibold text-[#11518b] hover:underline" href="/admin/signatures/gobernanza">Abrir Gobernanza avanzada</Link></details>
  </AdminPageShell>;
}
