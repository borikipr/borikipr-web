import "./globals.css";
import Footer from "@/components/footer";
import WhatsAppButton from "@/components/WhatsAppButton";

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