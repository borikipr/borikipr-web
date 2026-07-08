import type { Metadata } from "next";
import "./globals.css";
import Footer from "@/components/footer";
import AnalyticsScripts from "@/components/AnalyticsScripts";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
  jsonLdScript,
  realEstateAgentJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL("https://borikipr.com"),

  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },

  description:
    "Explora propiedades en venta y alquiler en Puerto Rico. Encuentra casas, apartamentos y oportunidades comerciales con asesoría profesional.",

  openGraph: {
    title: SITE_NAME,
    description:
      "Explora propiedades en venta y alquiler en Puerto Rico con una experiencia moderna y profesional.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "es_PR",
    type: "website",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} Puerto Rico`,
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description:
      "Propiedades en venta y alquiler en Puerto Rico con asesoría profesional.",
    images: ["https://borikipr.com/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(realEstateAgentJsonLd)}
        />
        {children}
        <Footer />
        <AnalyticsScripts />
      </body>
    </html>
  );
}
