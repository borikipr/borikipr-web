import type { Metadata } from "next";
import TestimoniosClientPage from "./TestimoniosClientPage";
import { getTestimoniosPublicosPaginados } from "@/lib/queries/testimonios";
import { DEFAULT_LOCALE, type AppLocale } from "@/lib/i18n/locales";
import { overlayTestimonialTranslations } from "@/lib/i18n/translations/public-overlay";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  absoluteUrl,
  breadcrumbJsonLd,
  jsonLdScript,
} from "@/lib/seo";

const pageTitle = "Testimonios";
const pageDescription =
  "Lee experiencias de clientes que han recibido orientación inmobiliaria clara, estrategia y acompañamiento profesional con Ivonne Erickson.";
const pagePath = "/testimonios";

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
      { name: "Inicio", url: "/" },
      { name: "Testimonios", url: pagePath },
    ]),
    ...(sourceData.testimonios.length > 0
      ? [
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Testimonios de Erickson Real Estate",
            itemListElement: sourceData.testimonios.map((testimonio, index) => ({
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
