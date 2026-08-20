import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import SignatureStepProgress from "@/components/admin/signatures/SignatureStepProgress";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createSignatureAdminRepository } from "@/lib/signatures/admin-repository";
import { SIGNATURE_DOCUMENT_TYPES } from "@/lib/signatures/document-classification";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import NewSignatureDraftForm from "./NewSignatureDraftForm";

export default async function NewSignatureDraftPage() {
  if (!(await getAdminSessionUser())) redirect("/admin/login");
  const repository=createSignatureAdminRepository(createPostgresSignatureDatabase(sql));
  const options=await repository.linkageOptions();
  const minimumExpirationDate = new Date().toISOString().slice(0, 10);
  return <AdminPageShell>
    <AdminPageHeader breadcrumbs={[{href:"/admin",label:"Admin"},{href:"/admin/signatures",label:"Firmas"},{label:"Nuevo documento"}]} eyebrow="Firmas · Nuevo documento" title="1. Sube el documento" description="Elige el PDF y completa los datos básicos. Añadirás destinatarios y campos en los pasos siguientes; nada se enviará todavía." />
    <SignatureStepProgress current={1} />
    <section className="grid gap-3 sm:grid-cols-2" aria-label="Cómo comenzar"><Link className="surface-card border-2 border-transparent p-5 transition hover:border-[#11518b]" href="/admin/signatures/plantillas"><span className="text-sm font-semibold text-[#11518b]">Opción rápida</span><h2 className="mt-1 text-lg font-semibold">Usar plantilla</h2><p className="mt-1 text-sm text-slate-600">Reutiliza PDF, roles, campos y ruta ya preparados.</p></Link><div className="surface-card border-2 border-[#11518b] p-5"><span className="text-sm font-semibold text-[#11518b]">Estás aquí</span><h2 className="mt-1 text-lg font-semibold">Subir PDF</h2><p className="mt-1 text-sm text-slate-600">Comienza una solicitud nueva desde un documento.</p></div></section>
    <NewSignatureDraftForm documentTypes={SIGNATURE_DOCUMENT_TYPES} leads={options.leads} groups={options.groups} minimumExpirationDate={minimumExpirationDate} />
  </AdminPageShell>;
}
