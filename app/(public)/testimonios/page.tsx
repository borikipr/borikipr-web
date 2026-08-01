import type { Metadata } from "next";
import TestimoniosClientPage from "./TestimoniosClientPage";
import { getTestimoniosPublicosPaginados } from "@/lib/queries/testimonios";
import { DEFAULT_LOCALE, type AppLocale } from "@/lib/i18n/locales";
import { getEquivalentRoute } from "@/lib/i18n/routing";
import { overlayTestimonialTranslations } from "@/lib/i18n/translations/public-overlay";
import { buildStaticPageMetadata } from "@/lib/i18n/seo";
import {
  SITE_NAME,
  breadcrumbJsonLd,
  jsonLdScript,
} from "@/lib/seo";

const pagePath = "/testimonios";

export const metadata: Metadata = buildStaticPageMetadata("testimonials", DEFAULT_LOCALE);

export async function renderTestimonialsPage({
  searchParams,
  locale,
}: {
  searchParams: Promise<{ page?: string }>;
  locale: AppLocale;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);

  const sourceData = await getTestimoniosPublicosPaginados(page, 8);
  const data = {
    ...sourceData,
    testimonios: await overlayTestimonialTranslations({
      testimonials: sourceData.testimonios,
      locale,
    }),
  };
  const jsonLd = [
    breadcrumbJsonLd([
      { name: locale === "en-US" ? "Home" : "Inicio", url: getEquivalentRoute("/", locale) ?? "/" },
      { name: locale === "en-US" ? "Testimonials" : "Testimonios", url: getEquivalentRoute(pagePath, locale) ?? pagePath },
    ]),
    ...(sourceData.testimonios.length > 0
      ? [
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: locale === "en-US" ? "Erickson Real Estate Testimonials" : "Testimonios de Erickson Real Estate",
            itemListElement: data.testimonios.map((testimonio, index) => ({
              "@type": "Review",
              position: index + 1,
              author: {
                "@type": "Person",
                name: testimonio.nombre,
              },
              reviewBody: testimonio.texto,
              itemReviewed: {
                "@type": "RealEstateAgent",
                name: SITE_NAME,
              },
            })),
          },
        ]
      : []),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(jsonLd)}
      />
      <TestimoniosClientPage data={data} />
    </>
  );
}

export default function TestimoniosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  return renderTestimonialsPage({ searchParams, locale: DEFAULT_LOCALE });
}
