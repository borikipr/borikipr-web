import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye, ImageIcon, MapPin, Quote, Star } from "lucide-react";
import AdminAlert from "@/components/admin/AdminAlert";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { EmptyState, SummaryCard } from "@/components/admin/AdminUI";
import StatusBadge from "@/components/admin/StatusBadge";
import { getAdminAccessContext } from "@/lib/admin/access-context";
import { getAdminTestimonios } from "@/lib/admin/testimonios-queries";
import TestimonioRowActions from "./TestimonioRowActions";
import TestimonioTipoFilter from "./TestimonioTipoFilter";

export default async function AdminTestimoniosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; id?: string; tipo?: string }>;
}) {
  const access = await getAdminAccessContext();
  if (!access) {
    redirect("/admin/login");
  }
  const canManage = access.isAdminBaseline || access.moduleAccess.get("testimonials") === "manage";

  const params = await searchParams;
  const testimonios = await getAdminTestimonios(params.tipo);
  const publicados = testimonios.filter((item) => item.activo).length;
  const destacados = testimonios.filter((item) => item.destacado).length;
  const conImagen = testimonios.filter((item) => item.foto_url).length;

  return (
    <AdminPageShell>
      <div className="space-y-5">
        <AdminPageHeader
          breadcrumbs={[
            { href: "/admin", label: "Admin" },
            { label: "Testimonios" },
          ]}
          eyebrow="Admin · Testimonios"
          title="Testimonios"
          description="Gestiona las opiniones publicadas y su presentación en el website."
          actions={
            <>
              <TestimonioTipoFilter currentTipo={params.tipo} />
              {canManage ? <Link href="/admin/testimonios/nuevo" className="btn-primary">
                Nuevo testimonio
              </Link> : null}
            </>
          }
        />

        {params.ok && (
          <AdminAlert variant="success">
            {params.ok === "created" && "Testimonio creado correctamente."}
            {params.ok === "updated" && "Cambios guardados correctamente."}
            {params.ok === "deleted" && "Testimonio eliminado correctamente."}
          </AdminAlert>
        )}

        <section className="testimonial-summary-grid" aria-label="Resumen de testimonios">
          <SummaryCard label="Total" value={testimonios.length} detail="Testimonios en este filtro" />
          <SummaryCard label="Publicados" value={publicados} detail="Visibles en el website" />
          <SummaryCard label="Destacados" value={destacados} detail="Con mayor prioridad" />
          <SummaryCard label="Con imagen" value={conImagen} detail="Listos para presentación" />
        </section>

        <div className="testimonial-directory-surface">
          {testimonios.length === 0 ? (
            <EmptyState title="No hay testimonios todavía" description={canManage ? "Añade el primer testimonio para comenzar a mostrar la experiencia de tus clientes." : "No hay testimonios disponibles para consultar."} action={canManage ? <Link href="/admin/testimonios/nuevo" className="btn-primary">Nuevo testimonio</Link> : undefined} />
          ) : (
            <div className="testimonial-directory-list">
              {testimonios.map((item) => (
                <article
                  key={item.id}
                  className={`testimonial-directory-row ${params.id === item.id ? "is-current" : ""}`}
                >
                  <div className="testimonial-directory-identity">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                      {item.foto_url ? (
                        <Image src={item.foto_url} alt={item.nombre} fill sizes="48px" className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[#11518b] text-sm font-bold text-white">{item.nombre.charAt(0)}</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-slate-950">{item.nombre}</h2>
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin aria-hidden="true" size={14} />{item.ubicacion || "Sin ubicación"}</p>
                    </div>
                  </div>

                  <div className="testimonial-directory-content">
                    <p className="line-clamp-2 text-sm leading-relaxed text-slate-700">{item.texto}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge variant={item.tipo === "comprador" ? "blue" : "gold"}>{item.tipo === "comprador" ? "Comprador" : "Vendedor"}</StatusBadge>
                      <StatusBadge variant={item.activo ? "green" : "gray"}>{item.activo ? "Publicado" : "Oculto"}</StatusBadge>
                      {item.destacado ? <StatusBadge variant="outline"><Star aria-hidden="true" size={12} className="mr-1 fill-current text-[#b68d13]" />Destacado</StatusBadge> : null}
                    </div>
                  </div>

                  <div className="testimonial-directory-meta">
                    <span><Quote aria-hidden="true" size={15} />Orden {item.orden}</span>
                    <span>{item.foto_url ? <ImageIcon aria-hidden="true" size={15} /> : <Eye aria-hidden="true" size={15} />}{item.foto_url ? "Con imagen" : "Sin imagen"}</span>
                  </div>

                  {canManage ? <div className="testimonial-directory-actions">
                    <Link href={`/admin/testimonios/${item.id}/editar`} className="btn-secondary">Editar</Link>
                    <TestimonioRowActions id={item.id} activoActual={item.activo} destacadoActual={item.destacado} />
                  </div> : null}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminPageShell>
  );
}
