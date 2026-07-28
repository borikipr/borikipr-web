import Header from "@/components/Header";
import FormularioPerfilComprador from "@/components/FormularioPerfilComprador";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPropiedadBySlug } from "@/lib/queries/propiedades";
import { formatPropertyLocation } from "@/lib/puerto-rico-sectores";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  return {
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    },
    alternates: {
      canonical: `/listados/${slug}`,
    },
  };
}

function formatoPrecio(precio: string | number, tipoNegocio: "venta" | "renta") {
  const numericPrice = Number(precio);

  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    return "";
  }

  const formatted = `$${numericPrice.toLocaleString("en-US")}`;
  return tipoNegocio === "renta" ? `${formatted}/mes` : formatted;
}

export default async function PerfilCompradorPropiedadPage({ params }: PageProps) {
  const { slug } = await params;
  const propiedad = await getPropiedadBySlug(slug);

  if (!propiedad) {
    notFound();
  }

  const disponible = propiedad.estado === "disponible";
  const precio = formatoPrecio(propiedad.precio, propiedad.tipo_negocio);
  const ubicacion = formatPropertyLocation(
    propiedad.municipio,
    propiedad.sector_comunidad
  );

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

          <div className="mt-8 max-w-3xl space-y-8">
            <article className="surface-card p-6 md:p-8">
              <p className="eyebrow">Perfil del cliente comprador</p>
              <h1 className="mt-3 text-3xl font-bold leading-tight text-[#11518B]">
                {propiedad.titulo}
              </h1>
              <p className="mt-3 text-[#4d4d4d]">{ubicacion}</p>
              {precio && (
                <p className="mt-3 text-2xl font-bold text-[#000000]">{precio}</p>
              )}
            </article>

            <section className="surface-card p-6 md:p-10">
              {disponible ? (
                <>
                  <div className="mb-8">
                    <h2 className="text-3xl font-bold text-[#000000]">
                      Completa tu perfil para continuar el proceso de compra
                    </h2>
                    <p className="mt-4 text-[#4d4d4d]">
                      Para poder brindarte más detalles y coordinar una posible visita, te invitamos a completar este breve formulario. La información que compartas nos ayudará a conocerte mejor como comprador y ofrecerte una orientación más personalizada durante el proceso.
                    </p>
                  </div>

                  <FormularioPerfilComprador
                    propertyId={propiedad.id}
                    propertySlug={propiedad.slug}
                    propertyTitle={propiedad.titulo}
                    propertyStatus={propiedad.estado}
                    tipoNegocio={propiedad.tipo_negocio}
                    municipio={propiedad.municipio}
                    sectorComunidad={propiedad.sector_comunidad}
                    requiresSolarContractAcceptance={Boolean(propiedad.placas_en_lease)}
                  />
                </>
              ) : (
                <div className="py-10 text-center">
                  <p className="eyebrow">Formulario no disponible</p>
                  <h2 className="mt-3 text-3xl font-bold text-[#000000]">
                    Esta propiedad no está disponible actualmente
                  </h2>
                  <p className="mx-auto mt-4 max-w-xl text-[#4d4d4d]">
                    El perfil del cliente comprador está disponible únicamente para propiedades con estado disponible.
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
