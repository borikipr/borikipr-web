import { redirect } from "next/navigation";
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
  return <AdminPageShell>
    <AdminPageHeader breadcrumbs={[{href:"/admin",label:"Admin"},{href:"/admin/signatures",label:"Firmas"},{label:"Nuevo documento"}]} eyebrow="Firmas · Nuevo documento" title="1. Sube el documento" description="Elige el PDF y completa los datos básicos. Añadirás destinatarios y campos en los pasos siguientes; nada se enviará todavía." />
    <SignatureStepProgress current={1} />
    <NewSignatureDraftForm documentTypes={SIGNATURE_DOCUMENT_TYPES} leads={options.leads} groups={options.groups} />
  </AdminPageShell>;
}
