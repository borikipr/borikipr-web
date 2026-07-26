import type { Metadata } from "next";
import Header from "@/components/Header";
import FormularioComprador from "@/components/FormularioComprador";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  absoluteUrl,
  breadcrumbJsonLd,
  jsonLdScript,
} from "@/lib/seo";

const pageTitle = "Formulario para Compradores y Arrendatarios";
const pageDescription =
  "Solicita orientación para comprar o alquilar tu propiedad ideal en Puerto Rico";
const pagePath = "/contact/compradores-arrendatarios";

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

export default function CompradoresArrendatariosPage() {
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
            <p className="eyebrow">COMPRADORES Y ARRENDATARIOS</p>
            <h1 className="heading-display mt-4">
              Únete al registro de compradores y arrendatarios activos
            </h1>
            <p className="body-lg mt-8 max-w-2xl">
              Al registrarte, pasarás a formar parte de mi registro de compradores y arrendatarios activos, lo que me permitirá identificar mejor tus necesidades y compartir contigo propiedades y oportunidades acordes con tu perfil. Además, podrás conocer opciones que podrían ser de tu interés antes de que sean ampliamente promovidas en el mercado.
            </p>
          </div>
        </section>

        <section className="section-shell pb-24">
          <div className="max-w-2xl">
            <div className="surface-card p-8 md:p-12">
              <FormularioComprador />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
