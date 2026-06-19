import type { Metadata } from "next";
import Header from "@/components/Header";
import FormularioPerfilComprador from "@/components/FormularioPerfilComprador";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  absoluteUrl,
  breadcrumbJsonLd,
  jsonLdScript,
} from "@/lib/seo";

const pageTitle = "Perfil del Cliente Comprador";
const pageDescription =
  "Formulario para clientes compradores interesados en continuar el proceso de orientación con Ivonne Erickson.";
const pagePath = "/contact/perfil-comprador";

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

export default function PerfilCompradorPage() {
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
            <p className="eyebrow">Perfil del cliente comprador</p>
            <h1 className="heading-display mt-4">
              Completa tu perfil para continuar el proceso de compra
            </h1>
            <p className="body-lg mt-8 max-w-2xl">
              Para poder brindarte más detalles y coordinar una posible visita, te invitamos a completar este breve formulario. La información que compartas nos ayudará a conocerte mejor como comprador y ofrecerte una orientación más personalizada durante el proceso.
            </p>
          </div>
        </section>

        <section className="section-shell pb-24">
          <div className="max-w-3xl">
            <div className="surface-card p-6 md:p-10">
              <FormularioPerfilComprador />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
