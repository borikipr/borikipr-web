import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import SignatureStepProgress from "@/components/admin/signatures/SignatureStepProgress";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createSignatureAdminRepository } from "@/lib/signatures/admin-repository";
import { SIGNATURE_DOCUMENT_TYPES } from "@/lib/signatures/document-classification";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { listSignatureBrokerCandidates } from "@/lib/signatures/broker-candidates";
import NewSignatureDraftForm from "./NewSignatureDraftForm";

export default async function NewSignatureDraftPage() {
  if (!(await getAdminSessionUser())) redirect("/admin/login");
  const repository=createSignatureAdminRepository(createPostgresSignatureDatabase(sql));
  const options=await repository.linkageOptions();
  const brokerCandidates=await listSignatureBrokerCandidates(createPostgresSignatureDatabase(sql));
  const minimumExpirationDate = new Date().toISOString().slice(0, 10);
  return <AdminPageShell>
    <div className="signature-new-document-page">
      <AdminPageHeader breadcrumbs={[{href:"/admin",label:"Admin"},{href:"/admin/signatures",label:"Firmas"},{label:"Nuevo documento"}]} eyebrow="Firmas · Nuevo documento" title="Sube el documento" description="Elige el PDF y completa los datos básicos. Nada se enviará hasta que revises la solicitud." />
      <SignatureStepProgress current={1} />
      <section className="signature-start-options" aria-label="Cómo comenzar"><Link className="signature-start-option" href="/admin/signatures/plantillas"><span>Opción rápida</span><strong>Usar plantilla</strong><small>Reutiliza PDF, roles, campos y ruta.</small></Link><div className="signature-start-option is-active"><span>Estás aquí</span><strong>Subir PDF</strong><small>Comienza desde un documento nuevo.</small></div></section>
      <NewSignatureDraftForm brokerCandidates={brokerCandidates} documentTypes={SIGNATURE_DOCUMENT_TYPES} leads={options.leads} groups={options.groups} minimumExpirationDate={minimumExpirationDate} />
    </div>
  </AdminPageShell>;
}
