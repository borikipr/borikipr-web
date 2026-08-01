import type { Metadata } from "next";
import Header from "@/components/Header";
import AnalyticsLink from "@/components/AnalyticsLink";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { DEFAULT_LOCALE, type AppLocale } from "@/lib/i18n/locales";
import { buildStaticPageMetadata } from "@/lib/i18n/seo";
import { getEquivalentRoute } from "@/lib/i18n/routing";
import {
  breadcrumbJsonLd,
  jsonLdScript,
} from "@/lib/seo";

const pagePath = "/contact";

export const metadata: Metadata = buildStaticPageMetadata("contact", DEFAULT_LOCALE);

function ContactOptionCard({
  eyebrow,
  title,
  description,
  href,
  label,
  analyticsOption,
  variant = "primary",
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  label: string;
  analyticsOption: string;
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
        <AnalyticsLink
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          eventName={
            href.startsWith("https://wa.me/")
              ? "whatsapp_click"
              : "contact_option_click"
          }
          eventParams={
            href.startsWith("https://wa.me/")
              ? { source_route: "/contact" }
              : { option: analyticsOption, destination: href }
          }
          className={variant === "primary" ? "btn-primary" : "btn-secondary"}
        >
          {label}
        </AnalyticsLink>
      </div>
    </article>
  );
}

export function renderContactPage(locale: AppLocale) {
  const copy = getDictionary(locale).contactHub;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbJsonLd([
            { name: locale === "en-US" ? "Home" : "Inicio", url: getEquivalentRoute("/", locale) ?? "/" },
            { name: locale === "en-US" ? "Contact" : "Contacto", url: getEquivalentRoute(pagePath, locale) ?? pagePath },
          ])
        )}
      />
      <Header />

      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-20">
          <div className="max-w-4xl">
            <p className="eyebrow">{copy.eyebrow}</p>

            <h1 className="heading-display mt-4 !text-[#11518B]">
              {copy.title}
            </h1>

            <p className="body-lg mt-8 max-w-3xl">
              {copy.description}
            </p>
          </div>
        </section>

        <section className="section-shell pb-24">
          <div className="grid gap-6 xl:grid-cols-3">
            <ContactOptionCard
              eyebrow={copy.options[0].eyebrow}
              title={copy.options[0].title}
              description={copy.options[0].description}
              href="/contact/compradores-arrendatarios"
              label={copy.options[0].label}
              analyticsOption="compradores y arrendatarios"
              variant="primary"
            />

            <ContactOptionCard
              eyebrow={copy.options[1].eyebrow}
              title={copy.options[1].title}
              description={copy.options[1].description}
              href="/contact/vendedor-arrendador"
              label={copy.options[1].label}
              analyticsOption="vendedores y arrendadores"
              variant="primary"
            />

            <ContactOptionCard
              eyebrow={copy.options[2].eyebrow}
              title={copy.options[2].title}
              description={copy.options[2].description}
              href="https://wa.me/17876774900"
              label={copy.options[2].label}
              analyticsOption="consulta general"
              variant="secondary"
            />
          </div>
        </section>

      </main>
    </>
  );
}

export default function ContactPage() {
  return renderContactPage(DEFAULT_LOCALE);
}
