import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/auth";
import { getAdminTestimonioById } from "@/lib/admin/testimonios-queries";
import { sql } from "@/lib/db";
import { createTranslationAdminService } from "@/lib/i18n/translations/admin-service";
import { createPostgresTranslationDatabase } from "@/lib/i18n/translations/repository";
import TranslationAdminPanel from "@/components/admin/TranslationAdminPanel";
import Link from "next/link";
import EditarTestimonioForm from "./EditarTestimonioForm";

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
    <main className="min-h-screen bg-[#f8f8f8] px-6 py-10">
      <div className="section-shell">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Admin · Editar testimonio</p>
            <h1 className="mt-3 text-3xl font-bold text-[#000000]">
              Editar testimonio
            </h1>
            <p className="body-base mt-3">
              Modifica los datos del testimonio.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/admin/testimonios" className="btn-secondary">
              Volver a testimonios
            </Link>
          </div>
        </div>

        <EditarTestimonioForm testimonio={testimonio} />
        <TranslationAdminPanel fields={translationFields} />
      </div>
    </main>
  );
}
