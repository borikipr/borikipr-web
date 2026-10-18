import type { Metadata } from "next";
import Image from "next/image";
import { connection } from "next/server";
import Header from "@/components/Header";
import HaciendaMonteCarmeloShowingForm from "@/components/HaciendaMonteCarmeloShowingForm";
import { isHaciendaShowingClosed } from "@/lib/hacienda-monte-carmelo-showing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Registro Showing | Hacienda Monte Carmelo",
  description: "Formulario privado por enlace para el Showing de Hacienda Monte Carmelo.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
  referrer: "no-referrer",
};

export default async function HaciendaMonteCarmeloShowingPage() {
  await connection();
  const initiallyClosed = isHaciendaShowingClosed(new Date());

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f4f7f9] pb-16 pt-[96px] lg:pt-[128px]">
        <div className="section-shell py-8 sm:py-12">
          <article className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-[#dde4e9] bg-white shadow-[0_24px_70px_rgba(13,27,42,0.09)]">
            <div className="bg-[#eef3f6] p-3 sm:p-6">
              <Image
                src="/images/hacienda-monte-carmelo-showing.jpeg"
                alt="Arte oficial de Hacienda Monte Carmelo: Cascadas y Café, finca en venta de 21 cuerdas en Guayanilla por $280,000"
                width={940}
                height={788}
                priority
                sizes="(max-width: 960px) calc(100vw - 32px), 864px"
                className="mx-auto h-auto w-full max-w-[940px] object-contain"
              />
            </div>

            <div className="px-5 py-9 sm:px-10 sm:py-12 lg:px-14">
              <header className="border-b border-[#e4e8eb] pb-8 text-center">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#765f12]">Confirmación de asistencia | Showing</p>
                <h1 className="mx-auto mt-4 max-w-3xl text-3xl font-bold leading-tight text-[#11518b] sm:text-4xl">21 CUERDAS DE TERRENO | HACIENDA MONTE CARMELO</h1>
                <div className="mx-auto mt-6 grid max-w-2xl gap-2 rounded-2xl border border-[#d4af37]/60 bg-[#fff9e6] px-5 py-4 text-[#263746] sm:grid-cols-3">
                  <p className="font-semibold">Domingo, 25 de octubre de 2026</p>
                  <p className="font-semibold">10:00 a. m.</p>
                  <p className="font-semibold">Guayanilla, Puerto Rico</p>
                </div>
                <div className="mx-auto mt-7 max-w-3xl space-y-4 text-left leading-7 text-[#4d5963]">
                  <p>Gracias por tu interés en Hacienda Monte Carmelo, una finca de aproximadamente 21 cuerdas que combina naturaleza, agricultura y un proyecto de café en desarrollo, rodeado de recursos naturales en Guayanilla, Puerto Rico.</p>
                  <p>Completa este breve formulario para confirmar tu asistencia y compartirnos información sobre tu interés en la propiedad.</p>
                </div>
              </header>

              <div className="mt-9">
                <HaciendaMonteCarmeloShowingForm initiallyClosed={initiallyClosed} />
              </div>
            </div>
          </article>
        </div>
      </main>
    </>
  );
}
