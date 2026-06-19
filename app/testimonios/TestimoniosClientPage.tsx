"use client";

import Header from "@/components/Header";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { TestimonioPublico, TestimoniosPaginados } from "@/lib/queries/testimonios";

type TipoFiltro = "todos" | "comprador" | "vendedor";

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
          ? "bg-[#d4af37] text-[#111111]"
          : "border border-[#d9d9d9] bg-white text-[#4d4d4d] hover:border-[#11518b] hover:text-[#11518b]"
      }`}
    >
      {children}
    </button>
  );
}

function TestimonioCard({ item }: { item: TestimonioPublico }) {
  const [expanded, setExpanded] = useState(false);
  const initialClampClass = item.destacado ? "line-clamp-6" : "line-clamp-3";
  const canExpand = item.texto.length > (item.destacado ? 260 : 150);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-[#e8e8e8] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="relative h-80 w-full bg-[#f5f5f5]">
        <Image
          src={item.imagen}
          alt={item.titulo || `${item.nombre} - Testimonio`}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover"
          loading="lazy"
        />

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white [text-shadow:0_2px_8px_rgba(0,0,0,.45)]">
            {item.etiqueta || "Experiencia real"}
          </p>
          <p className="mt-2 text-sm text-white/90">{item.lugar}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
          {item.tipo === "comprador" ? "Comprador" : "Vendedor"}
        </p>

        <h3 className="mt-3 text-2xl font-semibold text-[#11518b]">
          {item.titulo || item.nombre}
        </h3>

        <p
          id={`testimonio-texto-${item.id}`}
          className={`mt-5 text-lg leading-relaxed text-[#4d4d4d] ${
            expanded ? "" : initialClampClass
          }`}
        >
          &quot;{item.texto}&quot;
        </p>

        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            aria-controls={`testimonio-texto-${item.id}`}
            className="mt-4 self-start text-sm font-semibold text-[#11518b] transition hover:text-[#0d406d]"
          >
            {expanded ? "Leer menos" : "Leer más"}
          </button>
        )}

        <div className="mt-auto border-t border-[#efefef] pt-5">
          <p className="font-semibold text-[#000000]">{item.nombre}</p>
          <p className="mt-1 text-sm text-[#4d4d4d]">
            {item.tipo === "comprador" ? "Comprador" : "Vendedor"} · {item.lugar}
          </p>
        </div>
      </div>
    </article>
  );
}

function PaginationControls({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}) {
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-2">
      {currentPage > 1 && (
        <Link
          href={`/testimonios?page=${currentPage - 1}`}
          className="rounded-lg border border-[#d9d9d9] px-4 py-2 text-sm font-semibold text-[#11518b] transition hover:bg-[#11518b] hover:text-white"
        >
          Anterior
        </Link>
      )}

      {pages.map((page) => (
        <Link
          key={page}
          href={`/testimonios?page=${page}`}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
            page === currentPage
              ? "bg-[#11518b] text-white"
              : "border border-[#d9d9d9] text-[#4d4d4d] hover:border-[#11518b] hover:text-[#11518b]"
          }`}
        >
          {page}
        </Link>
      ))}

      {currentPage < totalPages && (
        <Link
          href={`/testimonios?page=${currentPage + 1}`}
          className="rounded-lg border border-[#d9d9d9] px-4 py-2 text-sm font-semibold text-[#11518b] transition hover:bg-[#11518b] hover:text-white"
        >
          Siguiente
        </Link>
      )}
    </div>
  );
}

export default function TestimoniosClientPage({
  data,
}: {
  data: TestimoniosPaginados;
}) {
  const [filtro, setFiltro] = useState<TipoFiltro>("todos");

  const testimoniosFiltrados = useMemo(() => {
    if (filtro === "todos") return data.testimonios;
    return data.testimonios.filter((item) => item.tipo === filtro);
  }, [filtro, data.testimonios]);

  return (
    <>
      <Header />

      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-20">
          <div className="max-w-4xl">
            <p className="eyebrow">Testimonios</p>

            <h1 className="heading-display heading-display-blue mt-4">
              Experiencias reales. Resultados con confianza.
            </h1>

            <p className="body-lg mt-8 max-w-3xl">
              Cada proceso inmobiliario tiene una historia. Estas experiencias
              reflejan el acompañamiento, la estrategia y la claridad con la que
              Ivonne guía a sus clientes.
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
              <>
                <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-2">
                  {testimoniosFiltrados.map((item) => (
                    <TestimonioCard key={item.id} item={item} />
                  ))}
                </div>

                {data.totalPages > 1 && (
                  <div className="mt-16">
                    <PaginationControls
                      currentPage={data.currentPage}
                      totalPages={data.totalPages}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <section className="bg-[#11518b] py-24 text-white">
          <div className="section-shell">
            <div className="max-w-3xl">
              <p className="eyebrow text-white/90">¿Te gustaría vivir una experiencia similar?</p>

              <h2 className="mt-4 text-3xl font-bold leading-tight text-white md:text-4xl">
                Conversemos sobre tu próxima decisión inmobiliaria en Puerto Rico
              </h2>

              <p className="body-lg mt-6 !text-white">
                Cada cliente merece una orientación clara, una estrategia sólida
                y un acompañamiento profesional desde el primer contacto.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/contact" className="btn-gold">
                  Contactar a Ivonne
                </Link>

                <Link
                  href="/listados"
                  className="inline-flex items-center justify-center rounded-full border border-white/30 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Ver propiedades
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
