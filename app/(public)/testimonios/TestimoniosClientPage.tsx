"use client";

import Header from "@/components/Header";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { TestimonioPublico, TestimoniosPaginados } from "@/lib/queries/testimonios";
import { usePublicLocale } from "@/components/PublicLocaleProvider";
import type { DictionaryShape } from "@/lib/i18n/get-dictionary";
import { getEquivalentRoute } from "@/lib/i18n/routing";

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

type TestimonialsCopy = DictionaryShape["testimonialsPage"];

function TestimonioCard({
  item,
  copy,
}: {
  item: TestimonioPublico;
  copy: TestimonialsCopy;
}) {
  const [expanded, setExpanded] = useState(false);
  const initialClampClass = item.destacado ? "line-clamp-6" : "line-clamp-3";
  const canExpand = item.texto.length > (item.destacado ? 260 : 150);
  const displayTag = item.destacado ? copy.featuredTag : copy.defaultTag;
  const displayTitle = item.tipo === "comprador" ? copy.buyerTitle : copy.sellerTitle;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-[#e8e8e8] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="relative h-80 w-full bg-[#f5f5f5]">
        <Image
          src={item.imagen}
          alt={`${displayTitle} - ${copy.imageAltSuffix}`}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover"
          loading="lazy"
        />

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white [text-shadow:0_2px_8px_rgba(0,0,0,.45)]">
            {displayTag}
          </p>
          <p className="mt-2 text-sm text-white/90">{item.lugar}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
          {item.tipo === "comprador" ? copy.buyer : copy.seller}
        </p>

        <h3 className="mt-3 text-2xl font-semibold text-[#11518b]">
          {displayTitle}
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
            {expanded ? copy.readLess : copy.readMore}
          </button>
        )}

        <div className="mt-auto border-t border-[#efefef] pt-5">
          <p className="font-semibold text-[#000000]">{item.nombre}</p>
          <p className="mt-1 text-sm text-[#4d4d4d]">
            {item.tipo === "comprador" ? copy.buyer : copy.seller} · {item.lugar}
          </p>
        </div>
      </div>
    </article>
  );
}

function PaginationControls({
  currentPage,
  totalPages,
  basePath,
  previousLabel,
  nextLabel,
}: {
  currentPage: number;
  totalPages: number;
  basePath: string;
  previousLabel: string;
  nextLabel: string;
}) {
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-2">
      {currentPage > 1 && (
        <Link
          href={`${basePath}?page=${currentPage - 1}`}
          className="rounded-lg border border-[#d9d9d9] px-4 py-2 text-sm font-semibold text-[#11518b] transition hover:bg-[#11518b] hover:text-white"
        >
          {previousLabel}
        </Link>
      )}

      {pages.map((page) => (
        <Link
          key={page}
          href={`${basePath}?page=${page}`}
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
          href={`${basePath}?page=${currentPage + 1}`}
          className="rounded-lg border border-[#d9d9d9] px-4 py-2 text-sm font-semibold text-[#11518b] transition hover:bg-[#11518b] hover:text-white"
        >
          {nextLabel}
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
  const { locale, dictionary } = usePublicLocale();
  const copy = dictionary.testimonialsPage;
  const testimonialsHref =
    getEquivalentRoute("/testimonios", locale) || "/testimonios";
  const contactHref = getEquivalentRoute("/contact", locale) || "/contact";
  const listingsHref = getEquivalentRoute("/listados", locale) || "/listados";
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
            <p className="eyebrow">{copy.eyebrow}</p>

            <h1 className="heading-display heading-display-blue mt-4">
              {copy.title}
            </h1>

            <p className="body-lg mt-8 max-w-3xl">
              {copy.description}
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <FiltroButton
              active={filtro === "todos"}
              onClick={() => setFiltro("todos")}
            >
              {copy.filters.all}
            </FiltroButton>

            <FiltroButton
              active={filtro === "comprador"}
              onClick={() => setFiltro("comprador")}
            >
              {copy.filters.buyers}
            </FiltroButton>

            <FiltroButton
              active={filtro === "vendedor"}
              onClick={() => setFiltro("vendedor")}
            >
              {copy.filters.sellers}
            </FiltroButton>
          </div>
        </section>

        <section className="pb-24">
          <div className="section-shell">
            {testimoniosFiltrados.length === 0 ? (
              <div className="surface-muted p-14 text-center">
                <h2 className="text-3xl font-semibold text-[#000000]">
                  {copy.emptyTitle}
                </h2>

                <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#4d4d4d]">
                  {copy.emptyDescription}
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-2">
                  {testimoniosFiltrados.map((item) => (
                    <TestimonioCard key={item.id} item={item} copy={copy} />
                  ))}
                </div>

                {data.totalPages > 1 && (
                  <div className="mt-16">
                    <PaginationControls
                      currentPage={data.currentPage}
                      totalPages={data.totalPages}
                      basePath={testimonialsHref}
                      previousLabel={dictionary.common.previous}
                      nextLabel={dictionary.common.next}
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
              <p className="eyebrow text-white/90">{copy.cta.eyebrow}</p>

              <h2 className="mt-4 text-3xl font-bold leading-tight text-white md:text-4xl">
                {copy.cta.title}
              </h2>

              <p className="body-lg mt-6 !text-white">
                {copy.cta.description}
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link href={contactHref} className="btn-gold">
                  {copy.cta.contact}
                </Link>

                <Link
                  href={listingsHref}
                  className="inline-flex items-center justify-center rounded-full border border-white/30 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {copy.cta.listings}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
