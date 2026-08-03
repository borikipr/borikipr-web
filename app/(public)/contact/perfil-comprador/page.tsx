import Header from "@/components/Header";
import Link from "next/link";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";
import { DEFAULT_LOCALE, ENGLISH_LOCALE, type AppLocale } from "@/lib/i18n/locales";
import { buildLocalizedMetadata } from "@/lib/i18n/seo";
import { getEquivalentRoute } from "@/lib/i18n/routing";
import { getPublicFormText } from "@/lib/i18n/public-form-copy";

const pageTitle = "Perfil del Cliente Comprador";
const pageDescription =
  "Selecciona una propiedad disponible antes de completar tu perfil de comprador.";
const pagePath = "/contact/perfil-comprador";

export const metadata = buildLocalizedMetadata({ locale: DEFAULT_LOCALE, spanishPath: pagePath, title: pageTitle, description: pageDescription });

export function renderPerfilCompradorPage(locale: AppLocale) {
  const t = (value: string) => getPublicFormText(locale, value);
  const breadcrumbSchema = breadcrumbJsonLd([
    { name: locale === ENGLISH_LOCALE ? "Home" : "Inicio", url: getEquivalentRoute("/", locale) ?? "/" },
    { name: locale === ENGLISH_LOCALE ? "Contact" : "Contacto", url: getEquivalentRoute("/contact", locale) ?? "/contact" },
    { name: t(pageTitle), url: getEquivalentRoute(pagePath, locale) ?? pagePath },
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
          <div className="max-w-3xl surface-card p-6 md:p-10">
            <p className="eyebrow">{t("Perfil del cliente comprador")}</p>
            <h1 className="heading-display mt-4">
              {t("Selecciona una propiedad")}
            </h1>
            <p className="body-lg mt-8 max-w-2xl">
              {t("Para completar tu perfil de comprador, primero selecciona una propiedad disponible.")}
            </p>
            <div className="mt-8">
              <Link href={getEquivalentRoute("/listados", locale) ?? "/listados"} className="btn-primary">
                {t("Ver propiedades disponibles")}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

export default function PerfilCompradorPage() {
  return renderPerfilCompradorPage(DEFAULT_LOCALE);
}
