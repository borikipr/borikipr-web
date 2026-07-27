import Header from "@/components/Header";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPropiedadBySlug } from "@/lib/queries/propiedades";
import { isPrivateR2Configured } from "@/lib/r2";
import PerfilCompradorPropiedadForm from "@/components/PerfilCompradorPropiedadForm";
import { formatPropertyLocation } from "@/lib/puerto-rico-sectores";
import { validatePrivateShowingRoute } from "@/lib/leads/private-showing-access";

export const metadata: Metadata = {
  title: "Registro de visita",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  referrer: "no-referrer",
};

type PageProps = {
  params: Promise<{ slug: string; privateToken: string }>;
};

export default async function PrivateShowingRegistrationPage({
  params,
}: PageProps) {
  const { slug, privateToken } = await params;
  const authorized = await validatePrivateShowingRoute(slug, privateToken);
  if (!authorized) notFound();

  const property = await getPropiedadBySlug(slug);
  if (!property) notFound();

  const mainImage =
    Array.isArray(property.imagenes) && property.imagenes.length > 0
      ? property.imagenes[0]
      : "/og-image.jpg";

  return (
    <>
      <Header />
      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-12">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <aside className="lg:sticky lg:top-[112px]">
              <div className="overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white shadow-sm">
                <div className="relative aspect-[4/3] bg-[#f5f5f5]">
                  <Image
                    src={mainImage}
                    alt={property.titulo}
                    fill
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover"
                  />
                </div>
                <div className="space-y-4 p-6">
                  <p className="eyebrow">Visita privada</p>
                  <h1 className="text-3xl font-bold leading-tight text-black">
                    {property.titulo}
                  </h1>
                  <div className="grid gap-3 text-sm text-[#4d4d4d] sm:grid-cols-2">
                    <p>
                      <span className="font-semibold text-black">Municipio:</span>{" "}
                      {formatPropertyLocation(
                        property.municipio,
                        property.sector_comunidad
                      )}
                    </p>
                    <p>
                      <span className="font-semibold text-black">Precio:</span>{" "}
                      {formatPrice(property.precio)}
                    </p>
                  </div>
                </div>
              </div>
            </aside>

            <section className="surface-card min-w-0 p-6 md:p-10">
              <div className="mb-8">
                <p className="eyebrow">Registro de visita</p>
                <h2 className="mt-3 text-3xl font-bold text-black">
                  Registro de visita a la propiedad
                </h2>
                <p className="mt-4 text-[#4d4d4d]">
                  Completa esta información como parte del registro de tu visita
                  a esta propiedad.
                </p>
              </div>
              <PerfilCompradorPropiedadForm
                workflow="private_showing"
                propiedadId={property.id}
                propiedadSlug={property.slug}
                privateToken={privateToken}
                r2Configured={isPrivateR2Configured()}
              />
            </section>
          </div>
        </section>
      </main>
    </>
  );
}

function formatPrice(value: string | number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0
    ? `$${numeric.toLocaleString("en-US")}`
    : "Precio próximamente";
}
