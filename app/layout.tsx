import type { Metadata } from "next";
import "./globals.css";
import Footer from "@/components/footer";
import WhatsAppButton from "@/components/WhatsAppButton";

export const metadata: Metadata = {
  metadataBase: new URL("https://borikipr.com"),

  title: {
    default: "Borikí | Puerto Rico Real Estate",
    template: "%s | Borikí",
  },

  description:
    "Explora propiedades en venta y renta en Puerto Rico. Encuentra casas, apartamentos y oportunidades comerciales con asesoría profesional.",

  openGraph: {
    title: "Borikí | Puerto Rico Real Estate",
    description:
      "Explora propiedades en venta y renta en Puerto Rico con una experiencia moderna y profesional.",
    url: "https://borikipr.com",
    siteName: "Borikí",
    locale: "es_PR",
    type: "website",
    images: [
      {
        url: "https://borikipr.com/og-image.jpg", // puedes cambiar luego
        width: 1200,
        height: 630,
        alt: "Borikí Real Estate Puerto Rico",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Borikí | Puerto Rico Real Estate",
    description:
      "Propiedades en venta y renta en Puerto Rico con asesoría profesional.",
    images: ["https://borikipr.com/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        {children}
        <Footer />
        <WhatsAppButton />
      </body>
    </html>
  );
}