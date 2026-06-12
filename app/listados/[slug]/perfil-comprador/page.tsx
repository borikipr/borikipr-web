import Header from "@/components/Header";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPropiedadBySlug } from "@/lib/queries/propiedades";
import { isR2Configured } from "@/lib/r2";
import PerfilCompradorPropiedadForm from "@/components/PerfilCompradorPropiedadForm";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function formatoPrecio(precio: string | number) {
  return `$${Number(precio).toLocaleString("en-US")}`;
}

function formatoFechaShowing(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-PR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

export default async function PerfilCompradorPage({ params }: PageProps) {
  const { slug } = await params;
  const propiedad = await getPropiedadBySlug(slug);

  if (!propiedad) {
    notFound();
  }

  const imagenPrincipal =
    Array.isArray(propiedad.imagenes) && propiedad.imagenes.length > 0
      ? propiedad.imagenes[0]
      : "/og-image.jpg";
  const showingActivo =
    Boolean(propiedad.formulario_showing_activo) && Boolean(propiedad.fecha_showing);
  const fechaShowing = formatoFechaShowing(propiedad.fecha_showing);
  const notasCompradores =
    typeof propiedad.configuracion_formulario?.notas_compradores === "string"
      ? propiedad.configuracion_formulario.notas_compradores
      : "";

  return (
    <>
      <Header />
      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-12">
          <Link
            href={`/listados/${propiedad.slug}`}
            className="inline-flex text-sm font-semibold text-[#11518b] transition hover:text-[#0d406d]"
          >
            Volver a la propiedad
          </Link>

          <div className="mt-8 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <aside className="lg:sticky lg:top-[112px]">
              <div className="overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white shadow-sm">
                <div className="relative aspect-[4/3] bg-[#f5f5f5]">
                  <Image
                    src={imagenPrincipal}
                    alt={propiedad.titulo}
                    fill
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover"
                  />
                </div>
                <div className="space-y-4 p-6">
                  <p className="eyebrow">Perfil de comprador</p>
                  <h1 className="text-3xl font-bold leading-tight text-[#000000]">
                    {propiedad.titulo}
                  </h1>
                  <div className="grid gap-3 text-sm text-[#4d4d4d] sm:grid-cols-2">
                    <p>
                      <span className="font-semibold text-[#000000]">Municipio:</span>{" "}
                      {propiedad.municipio}
                    </p>
                    <p>
                      <span className="font-semibold text-[#000000]">Precio:</span>{" "}
                      {formatoPrecio(propiedad.precio)}
                    </p>
                  </div>
                  {fechaShowing && (
                    <div className="rounded-xl border border-[#d4af37] bg-[#fff9e6] p-4">
                      <p className="text-sm font-semibold text-[#000000]">
                        Showing/Open house
                      </p>
                      <p className="mt-1 text-sm text-[#4d4d4d]">{fechaShowing}</p>
                    </div>
                  )}
                  {notasCompradores && (
                    <div className="rounded-xl border border-[#e8e8e8] bg-[#f8f8f8] p-4 text-sm text-[#4d4d4d]">
                      {notasCompradores}
                    </div>
                  )}
                </div>
              </div>
            </aside>

            <section className="surface-card p-6 md:p-10">
              {showingActivo ? (
                <>
                  <div className="mb-8">
                    <p className="eyebrow">Confirmacion de asistencia</p>
                    <h2 className="mt-3 text-3xl font-bold text-[#000000]">
                      Completa tu perfil de comprador
                    </h2>
                    <p className="mt-4 text-[#4d4d4d]">
                      Esta informacion ayuda a Ivonne a confirmar compradores preparados para el showing.
                    </p>
                  </div>

                  <PerfilCompradorPropiedadForm
                    propiedadId={propiedad.id}
                    requierePrecalificacion={Boolean(propiedad.requiere_precalificacion)}
                    preguntaPersonalizada={propiedad.pregunta_personalizada}
                    r2Configured={isR2Configured()}
                  />
                </>
              ) : (
                <div className="py-10 text-center">
                  <p className="eyebrow">Formulario no disponible</p>
                  <h2 className="mt-3 text-3xl font-bold text-[#000000]">
                    Aun no hay un showing activo para esta propiedad
                  </h2>
                  <p className="mx-auto mt-4 max-w-xl text-[#4d4d4d]">
                    Cuando Ivonne confirme fecha y hora, el perfil de comprador estara disponible aqui.
                  </p>
                  <div className="mt-8">
                    <Link href={`/listados/${propiedad.slug}`} className="btn-primary">
                      Ver detalles de la propiedad
                    </Link>
                  </div>
                </div>
              )}
            </section>
          </div>
        </section>
      </main>
    </>
  );
}
