import type { Metadata } from "next";
import TestimoniosClientPage from "./TestimoniosClientPage";
import { getTestimoniosPublicosPaginados } from "@/lib/queries/testimonios";
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

export default async function TestimoniosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);

  const data = await getTestimoniosPublicosPaginados(page, 8);
  const jsonLd = [
    breadcrumbJsonLd([
      { name: "Inicio", url: "/" },
      { name: "Testimonios", url: pagePath },
    ]),
    ...(data.testimonios.length > 0
      ? [
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Testimonios de Erickson Real Estate",
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
