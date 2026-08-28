import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/auth";
import { getAdminTestimonioById } from "@/lib/admin/testimonios-queries";
import { sql } from "@/lib/db";
import { createTranslationAdminService } from "@/lib/i18n/translations/admin-service";
import { createPostgresTranslationDatabase } from "@/lib/i18n/translations/repository";
import TranslationAdminPanel from "@/components/admin/TranslationAdminPanel";
import Link from "next/link";
import EditarTestimonioForm from "./EditarTestimonioForm";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import StatusBadge from "@/components/admin/StatusBadge";

export default async function EditarTestimonioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAdminSession();

  if (!user) {
    redirect("/admin/login");
  }

  const { id } = await params;
  const testimonio = await getAdminTestimonioById(id);

  if (!testimonio) {
    redirect("/admin/testimonios");
  }
  const translationFields = await createTranslationAdminService(
    createPostgresTranslationDatabase(sql)
  ).getEntityTranslations({ entityType: "testimonial", ownerId: id });

  return (
    <AdminPageShell>
      <div className="testimonial-editor-shell">
        <AdminPageHeader
          breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/testimonios", label: "Testimonios" }, { label: testimonio.nombre }]}
          eyebrow="Testimonios · Edición"
          title={testimonio.nombre}
          description="Actualiza el contenido, la imagen y la visibilidad sin perder el contexto editorial."
          actions={<><Link href="/testimonios" target="_blank" className="btn-secondary">Ver en sitio</Link><Link href="/admin/testimonios" className="btn-secondary">Volver</Link></>}
        >
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge variant={testimonio.activo ? "green" : "gray"}>{testimonio.activo ? "Publicado" : "Oculto"}</StatusBadge>
            {testimonio.destacado ? <StatusBadge variant="gold">Destacado</StatusBadge> : null}
          </div>
        </AdminPageHeader>
        <EditarTestimonioForm testimonio={testimonio} />
        <TranslationAdminPanel fields={translationFields} showHistory={false} />
      </div>
    </AdminPageShell>
  );
}
