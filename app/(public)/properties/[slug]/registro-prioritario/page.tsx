import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import AnalyticsEventOnView from "@/components/AnalyticsEventOnView";
import RegistroPrioritarioForm from "@/components/RegistroPrioritarioForm";
import { getPropiedadBySlug } from "@/lib/queries/propiedades";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  absoluteUrl,
  breadcrumbJsonLd,
  jsonLdScript,
} from "@/lib/seo";
import { formatPropertyLocation } from "@/lib/puerto-rico-sectores";
import { DEFAULT_LOCALE, ENGLISH_LOCALE, type AppLocale } from "@/lib/i18n/locales";
import { getEquivalentRoute } from "@/lib/i18n/routing";
import { getPublicFormText } from "@/lib/i18n/public-form-copy";
import { overlayPropertyTranslations } from "@/lib/i18n/translations/public-overlay";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const pageDescription =
  "Completa este formulario para recibir información de esta propiedad tan pronto esté disponible y ser de las primeras personas en coordinar una visita.";

export async function generateLocalizedPriorityRegistrationMetadata(params: PageProps["params"], locale: AppLocale): Promise<Metadata> {
  const { slug } = await params;
  const source = await getPropiedadBySlug(slug);
  const propiedad = source && locale === ENGLISH_LOCALE
    ? (await overlayPropertyTranslations({ properties: [source], locale }))[0]
    : source;
  const t = (value: string) => getPublicFormText(locale, value);

  if (!propiedad) {
    return {
      title: t("Registro prioritario"),
      description: t(pageDescription),
      robots: {
        index: false,
        follow: true,
        googleBot: {
          index: false,
          follow: true,
        },
      },
    };
  }

  const title = `${t("Registro prioritario")} - ${propiedad.titulo}`;
  const path = getEquivalentRoute(`/properties/${propiedad.slug}/registro-prioritario`, locale) ?? `/properties/${propiedad.slug}/registro-prioritario`;
  const propertyPath = getEquivalentRoute(`/listados/${propiedad.slug}`, locale) ?? `/listados/${propiedad.slug}`;

  return {
    title,
    description: t(pageDescription),
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    },
    alternates: {
      canonical: propertyPath,
    },
    openGraph: {
      title,
      description: t(pageDescription),
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
      description: t(pageDescription),
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return generateLocalizedPriorityRegistrationMetadata(params, DEFAULT_LOCALE);
}

export async function renderRegistroPrioritarioPage({ params, locale }: PageProps & { locale: AppLocale }) {
  const { slug } = await params;
  const source = await getPropiedadBySlug(slug);

  if (!source) {
    notFound();
  }
  const propiedad = locale === ENGLISH_LOCALE
    ? (await overlayPropertyTranslations({ properties: [source], locale }))[0]
    : source;
  const t = (value: string) => getPublicFormText(locale, value);

  const propertyPath = getEquivalentRoute(`/listados/${propiedad.slug}`, locale) ?? `/listados/${propiedad.slug}`;
  const pagePath = getEquivalentRoute(`/properties/${propiedad.slug}/registro-prioritario`, locale) ?? `/properties/${propiedad.slug}/registro-prioritario`;
  const breadcrumbSchema = breadcrumbJsonLd([
    { name: locale === ENGLISH_LOCALE ? "Home" : "Inicio", url: getEquivalentRoute("/", locale) ?? "/" },
    { name: locale === ENGLISH_LOCALE ? "Listings" : "Listados", url: getEquivalentRoute("/listados", locale) ?? "/listados" },
    { name: propiedad.titulo, url: propertyPath },
    { name: t("Registro prioritario"), url: pagePath },
  ]);
  const isComingSoon = propiedad.estado === "coming_soon";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema)}
      />
      <AnalyticsEventOnView
        eventName="priority_registration_view"
        params={{
          property_slug: propiedad.slug,
          status: propiedad.estado,
          municipio: propiedad.municipio,
          sector_comunidad: propiedad.sector_comunidad,
        }}
      />
      <Header />
      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-12">
          <Link
            href={propertyPath}
            className="inline-flex text-sm font-semibold text-[#11518b] transition hover:text-[#0d406d]"
          >
            {t("Volver a la propiedad")}
          </Link>

          <div className="mt-8 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <aside className="lg:sticky lg:top-[112px]">
              <div className="rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
                <p className="eyebrow">{t("PRÓXIMAMENTE EN EL MERCADO")}</p>
                <h1 className="mt-3 text-3xl font-bold leading-tight text-[#11518B]">
                  {propiedad.titulo}
                </h1>
                <p className="mt-3 text-[#4d4d4d]">
                  {formatPropertyLocation(
                    propiedad.municipio,
                    propiedad.sector_comunidad
                  )}
                </p>
              </div>
            </aside>

            <section className="surface-card p-6 md:p-10">
              {isComingSoon ? (
                <>
                  <div className="mb-8">
                    <p className="eyebrow">{t("REGISTRO PRIORITARIO")}</p>
                    <h2 className="mt-3 text-3xl font-bold text-[#11518B]">
                      {t("Propiedad en Venta")}
                    </h2>
                    <div className="mt-4 space-y-2 text-[#4d4d4d]">
                      <p className="font-semibold text-[#000000]">
                        {t("¡Gracias por tu interés!")}
                      </p>
                      <p>{t("Esta propiedad estará disponible próximamente.")}</p>
                      <p>
                        {t("Completa este formulario para recibir la información primero.")}
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
                  <p className="eyebrow">{t("Registro no disponible")}</p>
                  <h2 className="mt-3 text-3xl font-bold text-[#11518B]">
                    {t("Esta propiedad no tiene registro prioritario activo")}
                  </h2>
                  <p className="mx-auto mt-4 max-w-xl text-[#4d4d4d]">
                    {t("El registro prioritario se activa únicamente para propiedades marcadas como próximamente disponibles.")}
                  </p>
                  <div className="mt-8">
                    <Link href={propertyPath} className="btn-primary">
                      {t("Ver detalles de la propiedad")}
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

export default function RegistroPrioritarioPage(props: PageProps) {
  return renderRegistroPrioritarioPage({ ...props, locale: DEFAULT_LOCALE });
}
