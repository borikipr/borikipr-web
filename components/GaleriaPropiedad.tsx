"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  IconChevronLeft,
  IconChevronRight,
  IconPlayerPlayFilled,
  IconX,
} from "@tabler/icons-react";
import { usePublicLocale } from "@/components/PublicLocaleProvider";

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes("/videos/");
}

export default function GaleriaPropiedad({
  imagenes,
  titulo,
}: {
  imagenes: string[];
  titulo: string;
}) {
  const { dictionary } = usePublicLocale();
  const imagenesValidas = useMemo(
    () =>
      Array.isArray(imagenes) && imagenes.length > 0
        ? imagenes
        : ["/og-image.jpg"],
    [imagenes]
  );

  const [indiceActivo, setIndiceActivo] = useState(0);
  const [lightboxAbierto, setLightboxAbierto] = useState(false);
  const botonAbrirRef = useRef<HTMLButtonElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const lightboxEstabaAbiertoRef = useRef(false);
  const miniaturasRef = useRef<Array<HTMLButtonElement | null>>([]);
  const miniaturasLightboxRef = useRef<Array<HTMLButtonElement | null>>([]);

  const totalImagenes = imagenesValidas.length;
  const indiceVisible = Math.min(indiceActivo, totalImagenes - 1);

  useEffect(() => {
    if (lightboxAbierto) {
      lightboxEstabaAbiertoRef.current = true;
      return;
    }

    if (lightboxEstabaAbiertoRef.current) {
      lightboxEstabaAbiertoRef.current = false;
      botonAbrirRef.current?.focus();
    }
  }, [lightboxAbierto]);

  useEffect(() => {
    miniaturasRef.current[indiceVisible]?.scrollIntoView({
      block: "nearest",
      inline: "center",
    });

    if (lightboxAbierto) {
      miniaturasLightboxRef.current[indiceVisible]?.scrollIntoView({
        block: "nearest",
        inline: "center",
      });
    }
  }, [indiceVisible, lightboxAbierto]);

  const itemActivo = imagenesValidas[indiceVisible];
  const esVideoActivo = isVideoUrl(itemActivo);

  const irAnterior = () => {
    setIndiceActivo((prev) => {
      const actual = Math.min(prev, totalImagenes - 1);
      return actual === 0 ? totalImagenes - 1 : actual - 1;
    });
  };

  const irSiguiente = () => {
    setIndiceActivo((prev) => {
      const actual = Math.min(prev, totalImagenes - 1);
      return actual === totalImagenes - 1 ? 0 : actual + 1;
    });
  };

  useEffect(() => {
    if (!lightboxAbierto) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxAbierto(false);
      }

      if (e.key === "ArrowLeft") {
        setIndiceActivo((prev) => {
          const actual = Math.min(prev, totalImagenes - 1);
          return actual === 0 ? totalImagenes - 1 : actual - 1;
        });
      }

      if (e.key === "ArrowRight") {
        setIndiceActivo((prev) => {
          const actual = Math.min(prev, totalImagenes - 1);
          return actual === totalImagenes - 1 ? 0 : actual + 1;
        });
      }

      if (e.key === "Tab") {
        const controles = Array.from(
          lightboxRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []
        ).filter((control) => !control.disabled);
        const primero = controles[0];
        const ultimo = controles[controles.length - 1];

        if (controles.length > 0 && e.shiftKey && document.activeElement === primero) {
          e.preventDefault();
          ultimo.focus();
        } else if (controles.length > 0 && !e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primero.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [lightboxAbierto, totalImagenes]);

  return (
    <>
      <div className="min-w-0">
        <div className="relative h-[320px] w-full overflow-hidden rounded-3xl bg-[#f5f5f5] sm:h-[440px]">
          <button
            ref={botonAbrirRef}
            type="button"
            onClick={() => setLightboxAbierto(true)}
            className="group absolute inset-0 block h-full w-full overflow-hidden rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#11518b]"
            aria-label={`${dictionary.gallery.open}: ${titulo}`}
          >
            {esVideoActivo ? (
              <>
                <video
                  key={itemActivo}
                  src={itemActivo}
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
                <div className="absolute left-4 top-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#11518b] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-white">
                    <IconPlayerPlayFilled aria-hidden="true" className="h-3 w-3" />
                    Video
                  </span>
                </div>
              </>
            ) : (
              <Image
                src={itemActivo}
                alt={`${titulo} — ${dictionary.gallery.imageAlt} ${indiceVisible + 1}`}
                fill
                preload
                sizes="(max-width: 1280px) 100vw, 60vw"
                className="object-cover transition duration-300 group-hover:scale-[1.02]"
              />
            )}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent p-4 text-left sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex rounded-full bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#11518b]">
                  {dictionary.gallery.view}
                </span>

                <span
                  aria-live="polite"
                  aria-atomic="true"
                  className="inline-flex rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm"
                >
                  {indiceVisible + 1} / {totalImagenes}
                </span>
              </div>
            </div>
          </button>

          {totalImagenes > 1 && (
            <>
              <button
                type="button"
                onClick={irAnterior}
                className="absolute left-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-black/35 text-2xl text-white backdrop-blur-sm transition hover:bg-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:left-4"
                aria-label={dictionary.gallery.previous}
              >
                <IconChevronLeft aria-hidden="true" className="h-6 w-6" />
              </button>

              <button
                type="button"
                onClick={irSiguiente}
                className="absolute right-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-black/35 text-2xl text-white backdrop-blur-sm transition hover:bg-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-4"
                aria-label={dictionary.gallery.next}
              >
                <IconChevronRight aria-hidden="true" className="h-6 w-6" />
              </button>
            </>
          )}
        </div>

        {totalImagenes > 1 && (
          <div
            className="mt-4 flex max-w-full snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label={dictionary.gallery.thumbnails}
          >
            {imagenesValidas.map((item, index) => {
              const activa = index === indiceVisible;
              const esVideo = isVideoUrl(item);

              return (
                <button
                  key={index}
                  ref={(element) => {
                    miniaturasRef.current[index] = element;
                  }}
                  type="button"
                  onClick={() => setIndiceActivo(index)}
                  className={`relative h-20 w-28 shrink-0 snap-start overflow-hidden rounded-xl border transition sm:h-24 sm:w-36 sm:rounded-2xl ${
                    activa
                      ? "border-[#11518b] ring-2 ring-[#11518b]/20"
                      : "border-[#cccccc] hover:border-[#11518b]"
                  }`}
                  aria-label={`${esVideo ? dictionary.gallery.viewVideo : dictionary.gallery.viewImage} ${index + 1}`}
                  aria-current={activa ? "true" : undefined}
                >
                  {esVideo ? (
                    <>
                      <video
                        src={item}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80">
                          <svg className="h-4 w-4 text-[#11518b] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </>
                  ) : (
                    <Image
                      src={item}
                      alt={`${titulo} ${dictionary.gallery.imageAlt} ${index + 1}`}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxAbierto && (
        <div
          ref={lightboxRef}
          className="fixed inset-0 z-[100] bg-black/90"
          onClick={() => setLightboxAbierto(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${dictionary.gallery.dialog}: ${titulo}`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxAbierto(false);
            }}
            className="absolute right-3 top-3 z-[110] inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-6 sm:top-6 sm:h-12 sm:w-12"
            aria-label={dictionary.gallery.close}
            autoFocus
          >
            <IconX aria-hidden="true" className="h-6 w-6" />
          </button>

          <div className="absolute left-3 top-3 z-[110] sm:left-6 sm:top-6">
            <span className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
              {indiceVisible + 1} / {totalImagenes}
            </span>
          </div>

          {totalImagenes > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  irAnterior();
                }}
                className="absolute left-3 top-1/2 z-[110] inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:left-6 sm:h-12 sm:w-12"
                aria-label={dictionary.gallery.previous}
              >
                <IconChevronLeft aria-hidden="true" className="h-6 w-6" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  irSiguiente();
                }}
                className="absolute right-3 top-1/2 z-[110] inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-6 sm:h-12 sm:w-12"
                aria-label={dictionary.gallery.next}
              >
                <IconChevronRight aria-hidden="true" className="h-6 w-6" />
              </button>
            </>
          )}

          <div
            className="flex h-full items-center justify-center p-6 sm:p-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-[70vh] w-full max-w-6xl">
              {esVideoActivo ? (
                <video
                  key={itemActivo}
                  src={itemActivo}
                  className="h-full w-full object-contain"
                  autoPlay
                  controls
                  playsInline
                />
              ) : (
                <Image
                  src={itemActivo}
                  alt={titulo}
                  fill
                  sizes="100vw"
                  className="object-contain"
                />
              )}
            </div>
          </div>

          {totalImagenes > 1 && (
            <div
              className="absolute inset-x-0 bottom-3 mx-auto flex w-fit max-w-[90vw] gap-2 overflow-x-auto rounded-2xl bg-white/5 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:bottom-6 sm:gap-3 sm:px-4 sm:py-3"
              onClick={(e) => e.stopPropagation()}
            >
              {imagenesValidas.map((item, index) => {
                const activa = index === indiceVisible;
                const esVideo = isVideoUrl(item);

                return (
                  <button
                    key={index}
                    ref={(element) => {
                      miniaturasLightboxRef.current[index] = element;
                    }}
                    type="button"
                    onClick={() => setIndiceActivo(index)}
                    className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-xl border transition sm:h-16 sm:w-24 ${
                      activa
                        ? "border-white ring-2 ring-white/30"
                        : "border-white/20 hover:border-white/60"
                    }`}
                    aria-label={`${esVideo ? dictionary.gallery.viewVideo : dictionary.gallery.viewImage} ${index + 1}`}
                    aria-current={activa ? "true" : undefined}
                  >
                    {esVideo ? (
                      <>
                        <video
                          src={item}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <IconPlayerPlayFilled aria-hidden="true" className="h-4 w-4 text-white" />
                        </div>
                      </>
                    ) : (
                      <Image
                        src={item}
                        alt={`${titulo} ${dictionary.gallery.imageAlt} ${index + 1}`}
                        fill
                        sizes="(min-width: 640px) 96px, 80px"
                        className="object-cover"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
