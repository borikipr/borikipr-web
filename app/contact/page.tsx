import type { Metadata } from "next";
import Header from "@/components/Header";
import Link from "next/link";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  absoluteUrl,
  breadcrumbJsonLd,
  jsonLdScript,
} from "@/lib/seo";

const pageTitle = "Contacto";
const pageDescription =
  "Comunícate con Erickson Real Estate para recibir orientación sobre comprar, alquilar, vender o invertir en Puerto Rico.";
const pagePath = "/contact";

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

function ContactOptionCard({
  eyebrow,
  title,
  description,
  href,
  label,
  variant = "primary",
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <article className="surface-card card-hover p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#d4af37]">
        {eyebrow}
      </p>

      <h2 className="mt-4 text-2xl font-semibold text-[#11518b]">
        {title}
      </h2>

      <p className="body-base mt-4">
        {description}
      </p>

      <div className="mt-8">
        <Link
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          className={variant === "primary" ? "btn-primary" : "btn-secondary"}
        >
          {label}
        </Link>
      </div>
    </article>
  );
}

export default function ContactPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbJsonLd([
            { name: "Inicio", url: "/" },
            { name: "Contacto", url: pagePath },
          ])
        )}
      />
      <Header />

      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-20">
          <div className="max-w-4xl">
            <p className="eyebrow">Contacto</p>

            <h1 className="heading-display mt-4 !text-[#11518B]">
              ¿Cómo puedo orientarte?
            </h1>

            <p className="body-lg mt-8 max-w-3xl">
              Elige la opción que mejor se ajuste a lo que necesitas. Así puedo orientarte con más claridad, estrategia y una experiencia alineada a tus objetivos en Puerto Rico.
            </p>
          </div>
        </section>

        <section className="section-shell pb-24">
          <div className="grid gap-6 xl:grid-cols-3">
            <ContactOptionCard
              eyebrow="COMPRADORES Y ARRENDATARIOS"
              title="Quiero comprar o alquilar"
              description="Regístrate para formar parte de mi base de compradores y arrendatarios activos. Así podré orientarte de manera más personalizada y compartir contigo oportunidades alineadas con tus necesidades."
              href="/contact/compradores-arrendatarios"
              label="Registrarme"
              variant="primary"
            />

            <ContactOptionCard
              eyebrow="Vendedores y arrendadores"
              title="Quiero vender o alquilar"
              description="Comparte la información de tu propiedad y recibirás orientación sobre los próximos pasos para venderla o alquilarla con una estrategia adaptada a tus objetivos."
              href="/contact/vendedor-arrendador"
              label="Solicitar orientación"
              variant="primary"
            />

            <ContactOptionCard
              eyebrow="Consulta general"
              title="Necesito orientación general"
              description="Si tienes dudas, necesitas orientación adicional o prefieres una conversación más directa, también puedes escribir por WhatsApp."
              href="https://wa.me/17876774900"
              label="Escribir por WhatsApp"
              variant="secondary"
            />
          </div>
        </section>

      </main>
    </>
  );
}
