"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

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
  const imagenesValidas = useMemo(
    () =>
      Array.isArray(imagenes) && imagenes.length > 0
        ? imagenes
        : ["/placeholder.jpg"],
    [imagenes]
  );

  const [indiceActivo, setIndiceActivo] = useState(0);
  const [lightboxAbierto, setLightboxAbierto] = useState(false);

  const totalImagenes = imagenesValidas.length;

  // Ajustar el índice si las imágenes cambian y el índice actual queda fuera de rango
  if (indiceActivo > totalImagenes - 1 && totalImagenes > 0) {
    setIndiceActivo(0);
  }

  const itemActivo = imagenesValidas[indiceActivo];
  const esVideoActivo = isVideoUrl(itemActivo);

  const irAnterior = () => {
    setIndiceActivo((prev) => (prev === 0 ? totalImagenes - 1 : prev - 1));
  };

  const irSiguiente = () => {
    setIndiceActivo((prev) => (prev === totalImagenes - 1 ? 0 : prev + 1));
  };

  useEffect(() => {
    if (!lightboxAbierto) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxAbierto(false);
      }

      if (e.key === "ArrowLeft") {
        setIndiceActivo((prev) => (prev === 0 ? totalImagenes - 1 : prev - 1));
      }

      if (e.key === "ArrowRight") {
        setIndiceActivo((prev) => (prev === totalImagenes - 1 ? 0 : prev + 1));
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
      <div>
        <button
          type="button"
          onClick={() => setLightboxAbierto(true)}
          className="relative block h-[440px] w-full overflow-hidden rounded-3xl bg-[#f5f5f5]"
          aria-label="Abrir galería"
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
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Video
                </span>
              </div>
            </>
          ) : (
            <Image
              src={itemActivo}
              alt={titulo}
              fill
              priority
              sizes="(max-width: 1280px) 100vw, 60vw"
              className="object-cover transition duration-300 hover:scale-[1.02]"
            />
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent p-6 text-left">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex rounded-full bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#11518b]">
                Ver galería
              </span>

              <span className="inline-flex rounded-full bg-black/35 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                {indiceActivo + 1} / {totalImagenes}
              </span>
            </div>
          </div>
        </button>

        {totalImagenes > 1 && (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {imagenesValidas.map((item, index) => {
              const activa = index === indiceActivo;
              const esVideo = isVideoUrl(item);

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setIndiceActivo(index)}
                  className={`relative h-28 overflow-hidden rounded-2xl border transition ${
                    activa
                      ? "border-[#11518b] ring-2 ring-[#11518b]/20"
                      : "border-[#cccccc] hover:border-[#11518b]"
                  }`}
                  aria-label={`Ver ${esVideo ? "video" : "imagen"} ${index + 1}`}
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
                      alt={`${titulo} imagen ${index + 1}`}
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
          className="fixed inset-0 z-[100] bg-black/90"
          onClick={() => setLightboxAbierto(false)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxAbierto(false);
            }}
            className="absolute right-6 top-6 z-[110] inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20"
            aria-label="Cerrar galería"
          >
            ×
          </button>

          <div className="absolute left-6 top-6 z-[110]">
            <span className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
              {indiceActivo + 1} / {totalImagenes}
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
                className="absolute left-6 top-1/2 z-[110] inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20"
                aria-label="Anterior"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  irSiguiente();
                }}
                className="absolute right-6 top-1/2 z-[110] inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20"
                aria-label="Siguiente"
              >
                ›
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
              className="absolute inset-x-0 bottom-6 mx-auto flex w-fit max-w-[90vw] gap-3 overflow-x-auto rounded-2xl bg-white/5 px-4 py-3"
              onClick={(e) => e.stopPropagation()}
            >
              {imagenesValidas.map((item, index) => {
                const activa = index === indiceActivo;
                const esVideo = isVideoUrl(item);

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setIndiceActivo(index)}
                    className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border transition ${
                      activa
                        ? "border-white ring-2 ring-white/30"
                        : "border-white/20 hover:border-white/60"
                    }`}
                    aria-label={`Ver miniatura ${index + 1}`}
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
                          <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </>
                    ) : (
                      <Image
                        src={item}
                        alt={`${titulo} miniatura ${index + 1}`}
                        fill
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
