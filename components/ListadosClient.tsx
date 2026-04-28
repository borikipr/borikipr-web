"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { buscarSugerencias } from "@/data/zonas";
import {
  filtrarPropiedades,
  formatoPrecio,
  estadoClasses,
  estadoLabel,
  Orden,
} from "@/lib/propiedades";

type TipoNegocio = "venta" | "renta";
type TipoPropiedad =
  | "Casa"
  | "Apartamento"
  | "Condominio"
  | "Terreno"
  | "Comercial";
type EstadoPropiedad =
  | "disponible"
  | "bajo_contrato"
  | "vendida"
  | "rentada";

type Propiedad = {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  municipio: string;
  precio: number;
  tipo_negocio: TipoNegocio;
  tipo_propiedad: TipoPropiedad;
  habitaciones: number;
  banos: number;
  estacionamientos: number;
  metros_cuadrados: number;
  estado: EstadoPropiedad;
  destacado: boolean;
  imagenes: string[];
};

type PropiedadUI = {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  municipio: string;
  precio: number;
  tipoNegocio: TipoNegocio;
  tipoPropiedad: TipoPropiedad;
  habitaciones: number;
  banos: number;
  estacionamientos: number;
  metrosCuadrados: number;
  estado: EstadoPropiedad;
  destacado: boolean;
  imagenes: string[];
};

type InitialFilters = {
  q: string;
  tipoNegocio: "" | TipoNegocio;
  municipio: string;
  tipoPropiedad: "" | TipoPropiedad;
  precioMin: string;
  precioMax: string;
  habitaciones: string;
  banos: string;
  orden: Orden;
};

type ActiveChip = {
  key:
    | "q"
    | "tipoNegocio"
    | "municipio"
    | "tipoPropiedad"
    | "precioMin"
    | "precioMax"
    | "habitaciones"
    | "banos"
    | "orden";
  label: string;
};

function ordenLabel(orden: Orden) {
  switch (orden) {
    case "precio-asc":
      return "Precio: menor a mayor";
    case "precio-desc":
      return "Precio: mayor a menor";
    case "municipio-asc":
      return "Municipio: A-Z";
    case "municipio-desc":
      return "Municipio: Z-A";
    default:
      return "";
  }
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
          href={`/listados?page=${currentPage - 1}`}
          className="rounded-lg border border-[#d9d9d9] px-4 py-2 text-sm font-semibold text-[#11518b] transition hover:bg-[#11518b] hover:text-white"
        >
          Anterior
        </Link>
      )}

      {pages.map((page) => (
        <Link
          key={page}
          href={`/listados?page=${page}`}
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
          href={`/listados?page=${currentPage + 1}`}
          className="rounded-lg border border-[#d9d9d9] px-4 py-2 text-sm font-semibold text-[#11518b] transition hover:bg-[#11518b] hover:text-white"
        >
          Siguiente
        </Link>
      )}
    </div>
  );
}

export default function ListadosClient({
  propiedades,
  paginationData,
  initialFilters,
}: {
  propiedades: Propiedad[];
  paginationData: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
  initialFilters: InitialFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(initialFilters.q);
  const [tipoNegocio, setTipoNegocio] = useState<"" | TipoNegocio>(
    initialFilters.tipoNegocio
  );
  const [municipio, setMunicipio] = useState(initialFilters.municipio);
  const [tipoPropiedad, setTipoPropiedad] = useState<"" | TipoPropiedad>(
    initialFilters.tipoPropiedad
  );
  const [precioMin, setPrecioMin] = useState(initialFilters.precioMin);
  const [precioMax, setPrecioMax] = useState(initialFilters.precioMax);
  const [habitaciones, setHabitaciones] = useState(initialFilters.habitaciones);
  const [banos, setBanos] = useState(initialFilters.banos);
  const [orden, setOrden] = useState<Orden>(initialFilters.orden);
  const [shareMessage, setShareMessage] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("favorites");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            return new Set(parsed);
          }
        } catch (e) {
          console.error("Error parsing favorites from localStorage", e);
        }
      }
    }
    return new Set();
  });
  const [sugerencias, setSugerencias] = useState<{
    zonas: string[];
    municipios: string[];
  }>({ zonas: [], municipios: [] });
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  const toggleFavorite = (id: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(id)) {
      newFavorites.delete(id);
    } else {
      newFavorites.add(id);
    }
    setFavorites(newFavorites);
    localStorage.setItem("favorites", JSON.stringify(Array.from(newFavorites)));
  };

  const limpiarFiltros = () => {
    setQ("");
    setTipoNegocio("");
    setMunicipio("");
    setTipoPropiedad("");
    setPrecioMin("");
    setPrecioMax("");
    setHabitaciones("");
    setBanos("");
    setOrden("");
  };

  const quitarFiltro = (key: ActiveChip["key"]) => {
    switch (key) {
      case "q":
        setQ("");
        break;
      case "tipoNegocio":
        setTipoNegocio("");
        break;
      case "municipio":
        setMunicipio("");
        break;
      case "tipoPropiedad":
        setTipoPropiedad("");
        break;
      case "precioMin":
        setPrecioMin("");
        break;
      case "precioMax":
        setPrecioMax("");
        break;
      case "habitaciones":
        setHabitaciones("");
        break;
      case "banos":
        setBanos("");
        break;
      case "orden":
        setOrden("");
        break;
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (q.trim()) {
      params.set("q", q.trim());
    } else {
      params.delete("q");
    }

    if (tipoNegocio) {
      params.set("tipoNegocio", tipoNegocio);
    } else {
      params.delete("tipoNegocio");
    }

    if (municipio.trim()) {
      params.set("municipio", municipio.trim());
    } else {
      params.delete("municipio");
    }

    if (tipoPropiedad) {
      params.set("tipoPropiedad", tipoPropiedad);
    } else {
      params.delete("tipoPropiedad");
    }

    if (precioMin.trim()) {
      params.set("precioMin", precioMin.trim());
    } else {
      params.delete("precioMin");
    }

    if (precioMax.trim()) {
      params.set("precioMax", precioMax.trim());
    } else {
      params.delete("precioMax");
    }

    if (habitaciones.trim()) {
      params.set("habitaciones", habitaciones.trim());
    } else {
      params.delete("habitaciones");
    }

    if (banos.trim()) {
      params.set("banos", banos.trim());
    } else {
      params.delete("banos");
    }

    if (orden) {
      params.set("orden", orden);
    } else {
      params.delete("orden");
    }

    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    const currentUrl = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [
    q,
    tipoNegocio,
    municipio,
    tipoPropiedad,
    precioMin,
    precioMax,
    habitaciones,
    banos,
    orden,
    pathname,
    router,
    searchParams,
  ]);

  useEffect(() => {
    if (!shareMessage) return;
    const timer = setTimeout(() => setShareMessage(""), 2200);
    return () => clearTimeout(timer);
  }, [shareMessage]);

  const propiedadesNormalizadas: PropiedadUI[] = useMemo(
    () =>
      propiedades.map((p) => ({
        id: p.id,
        slug: p.slug,
        titulo: p.titulo,
        descripcion: p.descripcion,
        municipio: p.municipio,
        precio: Number(p.precio),
        tipoNegocio: p.tipo_negocio,
        tipoPropiedad: p.tipo_propiedad,
        habitaciones: p.habitaciones,
        banos: p.banos,
        estacionamientos: p.estacionamientos,
        metrosCuadrados: p.metros_cuadrados,
        estado: p.estado,
        destacado: p.destacado,
        imagenes:
          Array.isArray(p.imagenes) && p.imagenes.length > 0
            ? p.imagenes
            : ["/placeholder.jpg"],
      })),
    [propiedades]
  );

  const propiedadesFiltradas = useMemo(() => {
    return filtrarPropiedades(propiedadesNormalizadas, {
      q,
      tipoNegocio,
      municipio,
      tipoPropiedad,
      precioMin,
      precioMax,
      habitaciones,
      banos,
      orden,
    });
  }, [
    propiedadesNormalizadas,
    q,
    tipoNegocio,
    municipio,
    tipoPropiedad,
    precioMin,
    precioMax,
    habitaciones,
    banos,
    orden,
  ]);

  const activeChips = useMemo<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];

    if (q.trim()) {
      chips.push({
        key: "q",
        label: `Buscar: ${q.trim()}`,
      });
    }

    if (tipoNegocio) {
      chips.push({
        key: "tipoNegocio",
        label: tipoNegocio === "venta" ? "Venta" : "Renta",
      });
    }

    if (municipio.trim()) {
      chips.push({
        key: "municipio",
        label: `Municipio: ${municipio.trim()}`,
      });
    }

    if (tipoPropiedad) {
      chips.push({
        key: "tipoPropiedad",
        label: `Tipo: ${tipoPropiedad}`,
      });
    }

    if (precioMin.trim()) {
      chips.push({
        key: "precioMin",
        label: `Desde: $${Number(precioMin).toLocaleString("en-US")}`,
      });
    }

    if (precioMax.trim()) {
      chips.push({
        key: "precioMax",
        label: `Hasta: $${Number(precioMax).toLocaleString("en-US")}`,
      });
    }

    if (habitaciones.trim()) {
      chips.push({
        key: "habitaciones",
        label: `${habitaciones} hab.`,
      });
    }

    if (banos.trim()) {
      chips.push({
        key: "banos",
        label: `${banos} baños`,
      });
    }

    if (orden) {
      chips.push({
        key: "orden",
        label: ordenLabel(orden),
      });
    }

    return chips;
  }, [q, tipoNegocio, municipio, tipoPropiedad, precioMin, precioMax, habitaciones, banos, orden]);

  const shareUrl = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const handleShare = async () => {
    try {
      const fullUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}${shareUrl}`
          : shareUrl;

      await navigator.clipboard.writeText(fullUrl);
      setShareMessage("Enlace copiado");
    } catch {
      setShareMessage("No se pudo copiar");
    }
  };

  return (
    <section className="pb-24">
      <div className="section-shell">
        {/* Filtro horizontal */}
        <div className="mb-8 rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
          {/* Primera fila: Venta/Renta + Búsqueda + Precios */}
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
            {/* Botones Venta/Renta */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setTipoNegocio(tipoNegocio === "venta" ? "" : "venta")
                }
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  tipoNegocio === "venta"
                    ? "bg-[#11518b] text-white"
                    : "border border-[#d9d9d9] text-[#4d4d4d] hover:bg-[#f7f7f7]"
                }`}
              >
                Venta
              </button>
              <button
                type="button"
                onClick={() =>
                  setTipoNegocio(tipoNegocio === "renta" ? "" : "renta")
                }
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  tipoNegocio === "renta"
                    ? "bg-[#11518b] text-white"
                    : "border border-[#d9d9d9] text-[#4d4d4d] hover:bg-[#f7f7f7]"
                }`}
              >
                Renta
              </button>
            </div>

            {/* Búsqueda con autocompletado */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar por ubicación, municipio, zona..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  if (e.target.value.trim()) {
                    const sug = buscarSugerencias(e.target.value);
                    setSugerencias(sug);
                    setMostrarSugerencias(true);
                  } else {
                    setSugerencias({ zonas: [], municipios: [] });
                    setMostrarSugerencias(false);
                  }
                }}
                onFocus={() => q.trim() && setMostrarSugerencias(true)}
                onBlur={() => setTimeout(() => setMostrarSugerencias(false), 200)}
                className="input-premium w-full"
              />

              {/* Dropdown de sugerencias */}
              {mostrarSugerencias && (sugerencias.zonas.length > 0 || sugerencias.municipios.length > 0) && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-[#e8e8e8] bg-white shadow-lg max-h-64 overflow-y-auto">
                  {sugerencias.zonas.length > 0 && (
                    <div className="border-b border-[#e8e8e8] p-2">
                      <p className="px-3 py-1 text-xs font-semibold uppercase text-[#11518b]">Zonas</p>
                      {sugerencias.zonas.map((zona) => (
                        <button
                          key={zona}
                          type="button"
                          onClick={() => {
                            setQ(zona);
                            setMostrarSugerencias(false);
                            setSugerencias({ zonas: [], municipios: [] });
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-[#4d4d4d] hover:bg-[#f7f7f7]"
                        >
                          {zona}
                        </button>
                      ))}
                    </div>
                  )}

                  {sugerencias.municipios.length > 0 && (
                    <div className="p-2">
                      <p className="px-3 py-1 text-xs font-semibold uppercase text-[#11518b]">Municipios</p>
                      {sugerencias.municipios.map((municipio) => (
                        <button
                          key={municipio}
                          type="button"
                          onClick={() => {
                            setQ(municipio);
                            setMostrarSugerencias(false);
                            setSugerencias({ zonas: [], municipios: [] });
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-[#4d4d4d] hover:bg-[#f7f7f7]"
                        >
                          {municipio}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Precio Min */}
            <div className="lg:max-w-[90px]">
              <input
                type="number"
                placeholder="Min $"
                value={precioMin}
                onChange={(e) => setPrecioMin(e.target.value)}
                className="input-premium w-full text-sm"
              />
            </div>

            {/* Precio Max */}
            <div className="lg:max-w-[90px]">
              <input
                type="number"
                placeholder="Max $"
                value={precioMax}
                onChange={(e) => setPrecioMax(e.target.value)}
                className="input-premium w-full text-sm"
              />
            </div>
          </div>

          {/* Segunda fila: Habitaciones, Baños, Tipo de Propiedad, Ordenar, Limpiar */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
            {/* Habitaciones */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#4d4d4d]">Hab.</span>
              <div className="flex flex-wrap gap-2">
                {["All", "1+", "2+", "3+", "4+", "5+"].map((opt) => {
                  const active =
                    (opt === "All" && !habitaciones) || habitaciones === opt;
                  return (
                    <button
                      key={`hab-${opt}`}
                      type="button"
                      onClick={() => setHabitaciones(opt === "All" ? "" : opt)}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                        active
                          ? "border-[#11518b] bg-[#11518b] text-white"
                          : "border-[#d9d9d9] text-[#4d4d4d] hover:bg-[#f7f7f7]"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Baños */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#4d4d4d]">Baños</span>
              <div className="flex flex-wrap gap-2">
                {["All", "1+", "2+", "3+", "4+", "5+"].map((opt) => {
                  const active = (opt === "All" && !banos) || banos === opt;
                  return (
                    <button
                      key={`bath-${opt}`}
                      type="button"
                      onClick={() => setBanos(opt === "All" ? "" : opt)}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                        active
                          ? "border-[#11518b] bg-[#11518b] text-white"
                          : "border-[#d9d9d9] text-[#4d4d4d] hover:bg-[#f7f7f7]"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tipo de Propiedad - Toggle Switches */}
            <div className="flex flex-wrap gap-4 lg:flex-nowrap">
              {(["Casa", "Apartamento", "Condominio", "Terreno", "Comercial"] as TipoPropiedad[]).map((tipo) => (
                <label key={tipo} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tipoPropiedad === tipo}
                    onChange={(e) =>
                      setTipoPropiedad(e.target.checked ? tipo : "")
                    }
                    className="sr-only"
                  />
                  <div className={`w-10 h-5 rounded-full transition ${tipoPropiedad === tipo ? "bg-[#11518b]" : "bg-[#e8e8e8]"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition transform ${tipoPropiedad === tipo ? "translate-x-5" : "translate-x-0.5"} mt-0.5`} />
                  </div>
                  <span className="text-sm text-[#4d4d4d]">{tipo}</span>
                </label>
              ))}
            </div>

            {/* Ordenar */}
            <div className="lg:max-w-xs">
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value as Orden)}
                className="input-premium w-full text-sm"
              >
                <option value="">Ordenar</option>
                <option value="precio-asc">Precio ↑</option>
                <option value="precio-desc">Precio ↓</option>
                <option value="municipio-asc">Municipio A-Z</option>
                <option value="municipio-desc">Municipio Z-A</option>
              </select>
            </div>

            {/* Botón Limpiar */}
            <button
              type="button"
              onClick={limpiarFiltros}
              className="btn-secondary px-5 py-2.5 text-sm lg:ml-auto"
            >
              Limpiar
            </button>
          </div>
        </div>

        {/* Chips de filtros activos */}
        {activeChips.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-3">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => quitarFiltro(chip.key)}
                className="inline-flex items-center gap-2 rounded-full border border-[#e2e2e2] bg-[#fafafa] px-4 py-2 text-sm font-medium text-[#4d4d4d] transition hover:border-[#11518b] hover:text-[#11518b]"
              >
                <span>{chip.label}</span>
                <span className="text-xs">✕</span>
              </button>
            ))}
          </div>
        )}

        {/* Resultados y compartir */}
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-[#4d4d4d]">
              {propiedadesFiltradas.length} resultado
              {propiedadesFiltradas.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center justify-center rounded-full border border-[#d9d9d9] bg-white px-5 py-2.5 text-sm font-semibold text-[#4d4d4d] transition hover:border-[#11518b] hover:text-[#11518b]"
            >
              Compartir búsqueda
            </button>

            {shareMessage && (
              <span className="text-sm text-[#11518b]">{shareMessage}</span>
            )}
          </div>
        </div>

        {/* Grid de propiedades */}
        {propiedadesFiltradas.length === 0 ? (
          <div className="rounded-3xl border border-[#e8e8e8] bg-gradient-to-br from-white to-[#f8f8f8] p-10 text-center shadow-sm md:p-16">
            <h2 className="text-3xl font-semibold text-[#000000]">
              No encontramos propiedades con esos filtros
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#4d4d4d]">
              Ajusta la búsqueda o contáctanos para ayudarte a encontrar una
              opción alineada con lo que estás buscando en Puerto Rico.
            </p>

            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link href="/contact" className="btn-primary px-8 py-3">
                Solicitar orientación
              </Link>

              <a
                href="https://wa.me/17876774900"
                target="_blank"
                rel="noreferrer"
                className="btn-secondary px-8 py-3"
              >
                Escribir por WhatsApp
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              {propiedadesFiltradas.map((propiedad) => (
                <article
                  key={propiedad.id}
                  className="group overflow-hidden rounded-3xl border border-[#e8e8e8] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative h-72 w-full bg-[#f5f5f5]">
                    {(() => {
                      const src = propiedad.imagenes[0] || "/placeholder.jpg";
                      const esVideo = /\.(mp4|webm|mov)(\?|$)/i.test(src) || src.includes("/videos/");
                      if (esVideo) {
                        return (
                          <>
                            <video
                              src={src}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              muted
                              autoPlay
                              loop
                              playsInline
                              preload="metadata"
                            />
                            <span className="absolute top-4 right-14 z-10 rounded-full bg-[#11518b] px-2.5 py-1 text-[10px] font-semibold uppercase text-white">
                              Video
                            </span>
                          </>
                        );
                      }
                      return (
                        <Image
                          src={src}
                          alt={propiedad.titulo}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      );
                    })()}

                    <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] ${estadoClasses(
                          propiedad.estado
                        )}`}
                      >
                        {estadoLabel(propiedad.estado)}
                      </span>

                      {propiedad.destacado && (
                        <span className="rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#11518b]">
                          Destacado
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleFavorite(propiedad.id)}
                      className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-lg transition hover:bg-white"
                      title="Agregar a favoritos"
                    >
                      {favorites.has(propiedad.id) ? "❤️" : "🤍"}
                    </button>

                    {propiedad.estado === "bajo_contrato" && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                        <p className="text-sm font-semibold text-[#ffd700]">
                          ⚠️ Bajo contrato
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-8">
                    <div className="mb-4 flex justify-between gap-4">
                      <div>
                        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                          {propiedad.tipoNegocio === "venta"
                            ? "Venta"
                            : "Renta"}
                        </span>
                        <span className="text-sm text-[#4d4d4d]">
                          {propiedad.municipio}
                        </span>
                      </div>
                    </div>

                    <h2 className="text-xl font-semibold text-[#11518b]">
                      {propiedad.titulo}
                    </h2>

                    <p className="mt-4 text-2xl font-bold tracking-tight text-[#000000]">
                      {formatoPrecio(
                        propiedad.precio,
                        propiedad.tipoNegocio
                      )}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#4d4d4d]">
                      <span>{propiedad.tipoPropiedad}</span>
                      {propiedad.habitaciones > 0 && (
                        <span>{propiedad.habitaciones} hab.</span>
                      )}
                      {propiedad.banos > 0 && (
                        <span>{propiedad.banos} baños</span>
                      )}
                    </div>

                    <div className="mt-6 flex flex-col gap-3">
                      <Link
                        href={`/listados/${propiedad.slug}`}
                        className="inline-flex items-center justify-center rounded-full border border-[#11518b] px-5 py-2.5 text-sm font-semibold text-[#11518b] transition-all duration-300 hover:bg-[#11518b] hover:text-white"
                      >
                        Ver detalles
                      </Link>

                      <a
                        href={`https://wa.me/17876774900?text=${encodeURIComponent(
                          `Hola, me interesa esta propiedad:

${propiedad.titulo}
${propiedad.municipio}, Puerto Rico
Precio: ${formatoPrecio(
                            propiedad.precio,
                            propiedad.tipoNegocio
                          )}

https://borikipr.com/listados/${propiedad.slug}`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-full bg-[#d4af37] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                      >
                        Consultar por WhatsApp
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {paginationData.totalPages > 1 && (
              <div className="mt-16">
                <PaginationControls
                  currentPage={paginationData.currentPage}
                  totalPages={paginationData.totalPages}
                />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
