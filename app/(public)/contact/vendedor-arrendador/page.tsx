import Header from "@/components/Header";
import FormularioVendedor from "@/components/FormularioVendedor";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";
import { DEFAULT_LOCALE, ENGLISH_LOCALE, type AppLocale } from "@/lib/i18n/locales";
import { buildLocalizedMetadata } from "@/lib/i18n/seo";
import { getEquivalentRoute } from "@/lib/i18n/routing";
import { getPublicFormText } from "@/lib/i18n/public-form-copy";

const pageTitle = "Formulario para Vendedores y Arrendadores";
const pageDescription =
  "Solicita orientación para vender o alquilar tu propiedad en Puerto Rico";
const pagePath = "/contact/vendedor-arrendador";

export const metadata = buildLocalizedMetadata({ locale: DEFAULT_LOCALE, spanishPath: pagePath, title: pageTitle, description: pageDescription });

export function renderVendedorArrendadorPage(locale: AppLocale) {
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
            <p className="eyebrow">{t("VENDEDORES Y ARRENDADORES")}</p>
            <h1 className="heading-display mt-4">
              {t("Vende o alquila tu propiedad")}
            </h1>
            <p className="body-lg mt-8 max-w-2xl">
              {t("Completa este formulario y recibirás orientación sobre los próximos pasos para vender o alquilar tu propiedad con estrategia.")}
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

export default function VendedorArrendadorPage() {
  return renderVendedorArrendadorPage(DEFAULT_LOCALE);
}
