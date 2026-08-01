import type { Metadata } from "next";
import Header from "@/components/Header";
import AnalyticsLink from "@/components/AnalyticsLink";
import Image from "next/image";
import Link from "next/link";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { DEFAULT_LOCALE, type AppLocale } from "@/lib/i18n/locales";
import { getEquivalentRoute } from "@/lib/i18n/routing";
import { buildStaticPageMetadata } from "@/lib/i18n/seo";
import {
  breadcrumbJsonLd,
  jsonLdScript,
} from "@/lib/seo";

const pagePath = "/about";

export const metadata: Metadata = buildStaticPageMetadata("about", DEFAULT_LOCALE);

export function renderAboutPage(locale: AppLocale) {
  const copy = getDictionary(locale).about;
  const contactHref = getEquivalentRoute("/contact", locale) || "/contact";
  const listingsHref = getEquivalentRoute("/listados", locale) || "/listados";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbJsonLd([
            { name: locale === "en-US" ? "Home" : "Inicio", url: getEquivalentRoute("/", locale) ?? "/" },
            { name: locale === "en-US" ? "About Ivonne Erickson" : "Sobre Ivonne Erickson", url: getEquivalentRoute(pagePath, locale) ?? pagePath },
          ])
        )}
      />
      <Header />

      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-20">
          <div className="grid gap-14 xl:grid-cols-[0.95fr_1.05fr] xl:items-center">
            <div className="order-2 flex justify-center xl:order-1">
              <div className="w-full max-w-md">
                <Image
                  src="/ivonne.png"
                  alt={copy.imageAlt}
                  width={700}
                  height={900}
                  priority
                  className="h-auto w-full object-contain"
                />
              </div>
            </div>

            <div className="order-1 xl:order-2">
              <p className="eyebrow">{copy.hero.eyebrow}</p>

              <h1 className="heading-display heading-display-blue mt-4 max-w-3xl">
                {copy.hero.title}
              </h1>

              {copy.hero.paragraphs.map((paragraph, index) => (
                <p
                  key={paragraph}
                  className={`body-lg max-w-2xl ${index === 0 ? "mt-8" : "mt-6"}`}
                >
                  {paragraph}
                </p>
              ))}

              <div className="mt-10 flex flex-wrap gap-4">
                <Link href={contactHref} className="btn-primary">
                  {copy.hero.schedule}
                </Link>

                <AnalyticsLink
                  href="https://wa.me/17876774900"
                  target="_blank"
                  rel="noopener noreferrer"
                  eventName="whatsapp_click"
                  eventParams={{ source_route: "/about" }}
                  className="btn-secondary"
                >
                  {copy.hero.whatsapp}
                </AnalyticsLink>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#f8f8f8] py-24">
  <div className="section-shell">
    <div className="max-w-3xl">
      <p className="eyebrow">{copy.philosophy.eyebrow}</p>

      <h2 className="heading-section mt-4 !text-[#11518B]">
        {copy.philosophy.title}
      </h2>

      <p className="body-lg mt-6">
        {copy.philosophy.description}
      </p>
    </div>

    <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {copy.philosophy.values.map((value, index) => (
        <article
          key={value.title}
          className={`surface-card card-hover p-8 ${
            index === 2 ? "md:col-span-2 xl:col-span-1" : ""
          }`}
        >
          <div className="mb-5 h-1.5 w-14 rounded-full bg-[#d4af37]" />
          <h3 className="text-2xl font-semibold text-[#11518b]">
            {value.title}
          </h3>
          <p className="body-base mt-4">{value.description}</p>
        </article>
      ))}
    </div>
  </div>
</section>

        <section className="bg-white py-24">
          <div className="section-shell grid gap-12 xl:grid-cols-[1fr_1fr]">
            <div className="surface-muted card-hover p-8 md:p-10">
              <p className="eyebrow">{copy.presentation.eyebrow}</p>

<h2 className="mt-4 text-3xl font-bold leading-tight text-[#11518B] md:text-4xl">
  {copy.presentation.title}
</h2>

<p className="body-base mt-6">
  {copy.presentation.description}
</p>
            </div>

            <div className="surface-card card-hover p-8 md:p-10">
              <p className="eyebrow">{copy.credentials.eyebrow}</p>

<div className="mt-6 space-y-5 text-[#4d4d4d]">
  <div className="border-b border-[#efefef] pb-5">
    <p className="font-semibold text-[#000000]">
      {copy.credentials.role}
    </p>
    <p className="mt-1">{copy.credentials.location}</p>
  </div>

  <div className="border-b border-[#efefef] pb-5">
    <p className="font-semibold text-[#000000]">{copy.credentials.licenseLabel}</p>
    <p className="mt-1">{copy.credentials.license}</p>
  </div>

  <div>
    <p className="font-semibold text-[#000000]">{copy.credentials.focusLabel}</p>
    <p className="mt-1">{copy.credentials.focus}</p>
  </div>
</div>
            </div>
          </div>
        </section>

        <section className="bg-[#11518b] py-24">
          <div className="section-shell">
            <div className="rounded-[2rem] border border-white/10 bg-white/10 p-10 text-white shadow-xl backdrop-blur-sm md:p-14">
              <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
                <div className="max-w-3xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#d4af37]">
  {copy.cta.eyebrow}
</p>

<h2 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">
  {copy.cta.title}
</h2>

<p className="mt-6 text-lg leading-relaxed text-white/85">
  {copy.cta.description}
</p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Link href={contactHref} className="btn-gold">
  {copy.cta.schedule}
</Link>

<Link
  href={listingsHref}
  className="inline-flex items-center justify-center rounded-full border border-white/30 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
>
  {copy.cta.listings}
</Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

export default function About() {
  return renderAboutPage(DEFAULT_LOCALE);
}
