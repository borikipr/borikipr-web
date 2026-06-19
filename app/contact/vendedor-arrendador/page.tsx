import type { Metadata } from "next";
import Header from "@/components/Header";
import FormularioVendedor from "@/components/FormularioVendedor";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  absoluteUrl,
  breadcrumbJsonLd,
  jsonLdScript,
} from "@/lib/seo";

const pageTitle = "Formulario para Vendedores y Arrendadores";
const pageDescription =
  "Solicita orientación para vender o alquilar tu propiedad en Puerto Rico";
const pagePath = "/contact/vendedor-arrendador";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: pagePath,
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: absoluteUrl(pagePath),
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function VendedorArrendadorPage() {
  const breadcrumbSchema = breadcrumbJsonLd([
    { name: "Inicio", url: "/" },
    { name: "Contacto", url: "/contact" },
    { name: pageTitle, url: pagePath },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema)}
      />
      <Header />
      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-20">
          <div className="max-w-3xl">
            <p className="eyebrow">VENDEDORES Y ARRENDADORES</p>
            <h1 className="heading-display mt-4">
              Vende o alquila tu propiedad
            </h1>
            <p className="body-lg mt-8 max-w-2xl">
              Completa este formulario y recibirás orientación sobre los próximos pasos para vender o alquilar tu propiedad con estrategia.
            </p>
          </div>
        </section>

        <section className="section-shell pb-24">
          <div className="max-w-2xl">
            <div className="surface-card p-8 md:p-12">
              <FormularioVendedor />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
