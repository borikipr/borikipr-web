import { redirect } from "next/navigation";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createSignatureAdminRepository } from "@/lib/signatures/admin-repository";
import { SIGNATURE_DOCUMENT_TYPES } from "@/lib/signatures/document-classification";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import NewSignatureDraftForm from "./NewSignatureDraftForm";

export default async function NewSignatureDraftPage() {
  if (!(await getAdminSessionUser())) redirect("/admin/login");
  const repository = createSignatureAdminRepository(createPostgresSignatureDatabase(sql));
  const options = await repository.linkageOptions();
  return (
    <AdminPageShell>
      <AdminPageHeader breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/signatures", label: "Firmas" }, { label: "Nuevo" }]} eyebrow="Firmas · Borrador" title="Preparar documento" description="El PDF se valida antes de persistirse y permanece privado. No se enviará a firmantes en esta fase." />
      <NewSignatureDraftForm documentTypes={SIGNATURE_DOCUMENT_TYPES} leads={options.leads} groups={options.groups} />
    </AdminPageShell>
  );
}
