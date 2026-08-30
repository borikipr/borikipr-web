import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/auth";
import { getAdminPropiedadById } from "@/lib/admin/queries";
import { sql } from "@/lib/db";
import { createTranslationAdminService } from "@/lib/i18n/translations/admin-service";
import { createPostgresTranslationDatabase } from "@/lib/i18n/translations/repository";
import TranslationAdminPanel from "@/components/admin/TranslationAdminPanel";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import EditarPropiedadForm from "./EditarPropiedadForm";
import { getListingResponsibleCurrent, listEligibleListingResponsibleProfessionals } from "@/lib/admin/listing-responsibility";

export default async function EditarPropiedadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAdminSession();

  if (!user) {
    redirect("/admin/login");
  }

  const { id } = await params;
  const propiedad = await getAdminPropiedadById(id);

  if (!propiedad) {
    redirect("/admin/propiedades");
  }
  const [translationFields, eligibleProfessionals, currentResponsible] = await Promise.all([
    createTranslationAdminService(
    createPostgresTranslationDatabase(sql)
    ).getEntityTranslations({ entityType: "property", ownerId: id }),
    listEligibleListingResponsibleProfessionals(sql),
    getListingResponsibleCurrent(sql, propiedad.listing_responsible_user_id || null),
  ]);

  return (
    <AdminPageShell>
      <div className="property-editor-page">
        <AdminPageHeader
          breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/propiedades", label: "Propiedades" }, { label: propiedad.titulo }]}
          eyebrow="Inventario · Editar"
          title={propiedad.titulo}
          description="Actualiza la información comercial, la publicación y la galería de esta propiedad."
          actions={<div className="flex flex-wrap gap-2">
            <Link
              href={`/listados/${propiedad.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              <ExternalLink aria-hidden="true" size={16} /> Ver en sitio
            </Link>

            <Link href="/admin/propiedades" className="btn-secondary">
              <ArrowLeft aria-hidden="true" size={16} /> Volver
            </Link>
          </div>}
        />

        <EditarPropiedadForm propiedad={propiedad} eligibleProfessionals={eligibleProfessionals} currentResponsible={currentResponsible} />
        <TranslationAdminPanel fields={translationFields} showHistory={false} />
      </div>
    </AdminPageShell>
  );
}
