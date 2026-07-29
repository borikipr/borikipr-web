import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import AnalyticsScripts from "@/components/AnalyticsScripts";
import {
  isMultilingualEnabled,
  isSupportedLocale,
  PUBLIC_LOCALE_REQUEST_HEADER,
} from "@/lib/i18n/locales";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let documentLanguage = "es";

  if (isMultilingualEnabled()) {
    const requestedLocale = (await headers()).get(PUBLIC_LOCALE_REQUEST_HEADER);
    if (requestedLocale && isSupportedLocale(requestedLocale)) {
      documentLanguage = requestedLocale;
    }
  }

  return (
    <html lang={documentLanguage} data-scroll-behavior="smooth">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(realEstateAgentJsonLd)}
        />
        {children}
        <AnalyticsScripts />
      </body>
    </html>
  );
}
