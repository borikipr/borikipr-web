import type { Metadata } from "next";
import "./globals.css";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://borikipr.com"),

  title: {
    default: "Erickson Real Estate | Puerto Rico Real Estate",
    template: "%s | Erickson Real Estate",
  },

  description:
    "Explora propiedades en venta y alquiler en Puerto Rico. Encuentra casas, apartamentos y oportunidades comerciales con asesoría profesional.",

  openGraph: {
    title: "Erickson Real Estate | Puerto Rico Real Estate",
    description:
      "Explora propiedades en venta y alquiler en Puerto Rico con una experiencia moderna y profesional.",
    url: "https://borikipr.com",
    siteName: "Erickson Real Estate",
    locale: "es_PR",
    type: "website",
    images: [
      {
        url: "https://borikipr.com/og-image.jpg", // puedes cambiar luego
        width: 1200,
        height: 630,
        alt: "Erickson Real Estate Puerto Rico",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Erickson Real Estate | Puerto Rico Real Estate",
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
        {children}
        <Footer />
      </body>
    </html>
  );
}
