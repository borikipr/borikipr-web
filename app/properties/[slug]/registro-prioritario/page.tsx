import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import RegistroPrioritarioForm from "@/components/RegistroPrioritarioForm";
import { getPropiedadBySlug } from "@/lib/queries/propiedades";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  absoluteUrl,
  breadcrumbJsonLd,
  jsonLdScript,
} from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const pageDescription =
  "Completa este formulario para recibir información de esta propiedad tan pronto esté disponible y ser de las primeras personas en coordinar una visita.";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const propiedad = await getPropiedadBySlug(slug);

  if (!propiedad) {
    return {
      title: "Registro prioritario",
      description: pageDescription,
    };
  }

  const title = `Registro prioritario - ${propiedad.titulo}`;
  const path = `/properties/${propiedad.slug}/registro-prioritario`;

  return {
    title,
    description: pageDescription,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description: pageDescription,
      url: absoluteUrl(path),
      siteName: SITE_NAME,
      type: "website",
      images: [
        {
          url:
            Array.isArray(propiedad.imagenes) && propiedad.imagenes.length > 0
              ? propiedad.imagenes[0]
              : DEFAULT_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: propiedad.titulo,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: pageDescription,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

export default async function RegistroPrioritarioPage({ params }: PageProps) {
  const { slug } = await params;
  const propiedad = await getPropiedadBySlug(slug);

  if (!propiedad) {
    notFound();
  }

  const propertyPath = `/listados/${propiedad.slug}`;
  const pagePath = `/properties/${propiedad.slug}/registro-prioritario`;
  const breadcrumbSchema = breadcrumbJsonLd([
    { name: "Inicio", url: "/" },
    { name: "Listados", url: "/listados" },
    { name: propiedad.titulo, url: propertyPath },
    { name: "Registro prioritario", url: pagePath },
  ]);
  const isComingSoon = propiedad.estado === "coming_soon";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema)}
      />
      <Header />
      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-12">
          <Link
            href={propertyPath}
            className="inline-flex text-sm font-semibold text-[#11518b] transition hover:text-[#0d406d]"
          >
            Volver a la propiedad
          </Link>

          <div className="mt-8 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <aside className="lg:sticky lg:top-[112px]">
              <div className="rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
                <p className="eyebrow">PRÓXIMAMENTE EN EL MERCADO</p>
                <h1 className="mt-3 text-3xl font-bold leading-tight text-[#11518B]">
                  {propiedad.titulo}
                </h1>
                <p className="mt-3 text-[#4d4d4d]">
                  {propiedad.municipio}
                </p>
              </div>
            </aside>

            <section className="surface-card p-6 md:p-10">
              {isComingSoon ? (
                <>
                  <div className="mb-8">
                    <p className="eyebrow">REGISTRO PRIORITARIO</p>
                    <h2 className="mt-3 text-3xl font-bold text-[#11518B]">
                      Propiedad en Venta
                    </h2>
                    <div className="mt-4 space-y-2 text-[#4d4d4d]">
                      <p className="font-semibold text-[#000000]">
                        ¡Gracias por tu interés!
                      </p>
                      <p>Esta propiedad estará disponible próximamente.</p>
                      <p>
                        Completa este formulario para recibir la información antes que el público general y ser una de las primeras personas en coordinar una visita.
                      </p>
                    </div>
                  </div>

                  <RegistroPrioritarioForm
                    propertyId={propiedad.id}
                    propertySlug={propiedad.slug}
                    propertyTitle={propiedad.titulo}
                  />
                </>
              ) : (
                <div className="py-10 text-center">
                  <p className="eyebrow">Registro no disponible</p>
                  <h2 className="mt-3 text-3xl font-bold text-[#11518B]">
                    Esta propiedad no tiene registro prioritario activo
                  </h2>
                  <p className="mx-auto mt-4 max-w-xl text-[#4d4d4d]">
                    El registro prioritario se activa únicamente para propiedades
                    marcadas como próximamente disponibles.
                  </p>
                  <div className="mt-8">
                    <Link href={propertyPath} className="btn-primary">
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
