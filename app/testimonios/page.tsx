"use client";

import Header from "@/components/Header";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

type TipoTestimonio = "todos" | "comprador" | "vendedor";

type Testimonio = {
  nombre: string;
  lugar: string;
  tipo: "comprador" | "vendedor";
  texto: string;
  imagen: string;
  etiqueta?: string;
  titulo?: string;
};

const testimonios: Testimonio[] = [
  {
    nombre: "Nilo Rivera",
    lugar: "Bo. Arenas, Reparto San Carlos, Guánica, Puerto Rico",
    tipo: "vendedor",
    texto:
      "Desde nuestro primer encuentro quedé muy impresionado con tu profesionalismo y conocimiento del mercado. Gracias a tu gestión, un proceso que suele ser estresante resultó ser fluido y exitoso. Valoro mucho tu puntualidad, transparencia y la paciencia para resolver todas mis dudas. Sin duda, no dudaré en recomendar tus servicios a amigos y familiares que busquen asesoría en bienes raíces.",
    imagen: "/testimonio-san-carlos-guanica.jpg",
    etiqueta: "Propiedad vendida",
    titulo: "Venta completada en Guánica",
  },
];

function FiltroButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
        active
          ? "bg-[#11518b] text-white"
          : "border border-[#d9d9d9] bg-white text-[#4d4d4d] hover:border-[#11518b] hover:text-[#11518b]"
      }`}
    >
      {children}
    </button>
  );
}

function TestimonioCard({ item }: { item: Testimonio }) {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-[#e8e8e8] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="relative h-80 w-full bg-[#f5f5f5]">
        <Image
          src={item.imagen}
          alt={item.titulo || `${item.nombre} - Testimonio`}
          fill
          className="object-cover"
        />

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d4af37]">
            {item.etiqueta || "Experiencia real"}
          </p>
          <p className="mt-2 text-sm text-white/90">{item.lugar}</p>
        </div>
      </div>

      <div className="p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
          {item.tipo === "comprador" ? "Comprador" : "Vendedor"}
        </p>

        <h3 className="mt-3 text-2xl font-semibold text-[#11518b]">
          {item.titulo || item.nombre}
        </h3>

        <p className="mt-5 text-lg leading-relaxed text-[#4d4d4d]">
          “{item.texto}”
        </p>

        <div className="mt-6 border-t border-[#efefef] pt-5">
          <p className="font-semibold text-[#000000]">{item.nombre}</p>
          <p className="mt-1 text-sm text-[#4d4d4d]">
            Cliente {item.tipo} · {item.lugar}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function TestimoniosPage() {
  const [filtro, setFiltro] = useState<TipoTestimonio>("todos");

  const testimoniosFiltrados = useMemo(() => {
    if (filtro === "todos") return testimonios;
    return testimonios.filter((item) => item.tipo === filtro);
  }, [filtro]);

  return (
    <>
      <Header />

      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-20">
          <div className="max-w-4xl">
            <p className="eyebrow">Testimonios</p>

            <h1 className="heading-display mt-4">
              Experiencias reales. Resultados con confianza.
            </h1>

            <p className="body-lg mt-8 max-w-3xl">
              Cada proceso inmobiliario tiene una historia. Estas experiencias
              reflejan el acompañamiento, la estrategia y la claridad con la que
              Ivonne guía a sus clientes en Puerto Rico.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <FiltroButton
              active={filtro === "todos"}
              onClick={() => setFiltro("todos")}
            >
              Todos
            </FiltroButton>

            <FiltroButton
              active={filtro === "comprador"}
              onClick={() => setFiltro("comprador")}
            >
              Compradores
            </FiltroButton>

            <FiltroButton
              active={filtro === "vendedor"}
              onClick={() => setFiltro("vendedor")}
            >
              Vendedores
            </FiltroButton>
          </div>
        </section>

        <section className="pb-24">
          <div className="section-shell">
            {testimoniosFiltrados.length === 0 ? (
              <div className="surface-muted p-14 text-center">
                <h2 className="text-3xl font-semibold text-[#000000]">
                  Próximamente más experiencias reales
                </h2>

                <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#4d4d4d]">
                  Estamos preparando más testimonios reales de clientes que
                  confiaron en Erickson Real Estate en Puerto Rico.
                </p>
              </div>
            ) : (
              <div className="grid gap-8 xl:grid-cols-1">
                {testimoniosFiltrados.map((item, index) => (
                  <TestimonioCard key={index} item={item} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bg-[#f8f8f8] py-24">
          <div className="section-shell grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            <div className="surface-card card-hover p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#d4af37]">
                Claridad
              </p>
              <p className="mt-4 leading-relaxed text-[#4d4d4d]">
                Un proceso mejor guiado reduce dudas y ayuda a tomar decisiones
                con más seguridad.
              </p>
            </div>

            <div className="surface-card card-hover p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#d4af37]">
                Estrategia
              </p>
              <p className="mt-4 leading-relaxed text-[#4d4d4d]">
                Cada propiedad y cada cliente requieren un enfoque bien pensado,
                no una fórmula genérica.
              </p>
            </div>

            <div className="surface-card card-hover p-8 md:col-span-2 xl:col-span-1">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#d4af37]">
                Confianza
              </p>
              <p className="mt-4 leading-relaxed text-[#4d4d4d]">
                Una presencia profesional consistente hace que cada interacción
                se sienta más sólida y mejor acompañada.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-[#11518b] py-24">
          <div className="section-shell">
            <div className="rounded-[2rem] border border-white/10 bg-white/10 p-10 text-white shadow-xl backdrop-blur-sm md:p-14">
              <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
                <div className="max-w-3xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#d4af37]">
                    Próximo paso
                  </p>

                  <h2 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">
                    Tu experiencia también puede comenzar con claridad.
                  </h2>

                  <p className="mt-6 text-lg leading-relaxed text-white/85">
                    Si estás considerando comprar, vender o explorar tus
                    opciones, agenda una consulta y recibe orientación
                    profesional en cada etapa.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Link href="/contact" className="btn-gold">
                    Agendar consulta
                  </Link>

                  <Link
                    href="/about"
                    className="inline-flex items-center justify-center rounded-full border border-white/30 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Conocer a Ivonne
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