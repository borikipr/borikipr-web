import Header from "@/components/Header";
import FormularioComprador from "@/components/FormularioComprador";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";
import { DEFAULT_LOCALE, ENGLISH_LOCALE, type AppLocale } from "@/lib/i18n/locales";
import { buildLocalizedMetadata } from "@/lib/i18n/seo";
import { getEquivalentRoute } from "@/lib/i18n/routing";
import { getPublicFormText } from "@/lib/i18n/public-form-copy";

const pageTitle = "Formulario para Compradores y Arrendatarios";
const pageDescription =
  "Solicita orientación para comprar o alquilar tu propiedad ideal en Puerto Rico";
const pagePath = "/contact/compradores-arrendatarios";

export const metadata = buildLocalizedMetadata({ locale: DEFAULT_LOCALE, spanishPath: pagePath, title: pageTitle, description: pageDescription });

export function renderCompradoresArrendatariosPage(locale: AppLocale) {
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
          <div className="max-w-3xl">
            <p className="eyebrow">{t("COMPRADORES Y ARRENDATARIOS")}</p>
            <h1 className="heading-display mt-4">
              {t("Únete al registro de compradores y arrendatarios activos")}
            </h1>
            <p className="body-lg mt-8 max-w-2xl">
              {t("Al registrarte, pasarás a formar parte de mi registro de compradores y arrendatarios activos, lo que me permitirá identificar mejor tus necesidades y compartir contigo propiedades y oportunidades acordes con tu perfil. Además, podrás conocer opciones que podrían ser de tu interés antes de que sean ampliamente promovidas en el mercado.")}
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

export default function CompradoresArrendatariosPage() {
  return renderCompradoresArrendatariosPage(DEFAULT_LOCALE);
}
