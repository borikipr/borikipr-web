"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { municipiosPR } from "@/data/municipios";
import {
  filtrarPropiedades,
  formatoPrecio,
  estadoClasses,
  estadoLabel,
  Orden,
} from "@/lib/propiedades";

type TipoNegocio = "venta" | "renta";
type TipoPropiedad = "Casa" | "Apartamento" | "Condominio" | "Terreno";
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
  tipoNegocio: "" | TipoNegocio;
  municipio: string;
  tipoPropiedad: "" | TipoPropiedad;
  precioMin: string;
  precioMax: string;
  orden: Orden;
};

type ActiveChip = {
  key:
    | "tipoNegocio"
    | "municipio"
    | "tipoPropiedad"
    | "precioMin"
    | "precioMax"
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

export default function ListadosClient({
  propiedades,
  initialFilters,
}: {
  propiedades: Propiedad[];
  initialFilters: InitialFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tipoNegocio, setTipoNegocio] = useState<"" | TipoNegocio>(
    initialFilters.tipoNegocio
  );
  const [municipio, setMunicipio] = useState(initialFilters.municipio);
  const [tipoPropiedad, setTipoPropiedad] = useState<"" | TipoPropiedad>(
    initialFilters.tipoPropiedad
  );
  const [precioMin, setPrecioMin] = useState(initialFilters.precioMin);
  const [precioMax, setPrecioMax] = useState(initialFilters.precioMax);
  const [orden, setOrden] = useState<Orden>(initialFilters.orden);
  const [shareMessage, setShareMessage] = useState("");

  const limpiarFiltros = () => {
    setTipoNegocio("");
    setMunicipio("");
    setTipoPropiedad("");
    setPrecioMin("");
    setPrecioMax("");
    setOrden("");
  };

  const quitarFiltro = (key: ActiveChip["key"]) => {
    switch (key) {
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
      case "orden":
        setOrden("");
        break;
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

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
    tipoNegocio,
    municipio,
    tipoPropiedad,
    precioMin,
    precioMax,
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
        imagenes: Array.isArray(p.imagenes) ? p.imagenes : [],
      })),
    [propiedades]
  );

  const propiedadesFiltradas = useMemo(() => {
    return filtrarPropiedades(propiedadesNormalizadas, {
      tipoNegocio,
      municipio,
      tipoPropiedad,
      precioMin,
      precioMax,
      orden,
    });
  }, [
    propiedadesNormalizadas,
    tipoNegocio,
    municipio,
    tipoPropiedad,
    precioMin,
    precioMax,
    orden,
  ]);

  const activeChips = useMemo<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];

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

    if (orden) {
      chips.push({
        key: "orden",
        label: ordenLabel(orden),
      });
    }

    return chips;
  }, [tipoNegocio, municipio, tipoPropiedad, precioMin, precioMax, orden]);

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
      <div className="section-shell grid gap-10 xl:grid-cols-[320px_1fr]">
        <aside className="h-fit rounded-3xl border border-[#e8e8e8] bg-white p-6 shadow-sm xl:sticky xl:top-[108px]">
          <div className="mb-6">
            <p className="eyebrow">Filtros</p>
            <h2 className="mt-2 text-2xl font-bold text-[#000000]">
              Refinar búsqueda
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#000000]">
                Venta o renta
              </label>
              <select
                value={tipoNegocio}
                onChange={(e) =>
                  setTipoNegocio(e.target.value as "" | TipoNegocio)
                }
                className="input-premium"
              >
                <option value="">Todos</option>
                <option value="venta">Venta</option>
                <option value="renta">Renta</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#000000]">
                Municipio
              </label>
              <select
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                className="input-premium"
              >
                <option value="">Todos los municipios</option>
                {municipiosPR.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#000000]">
                Tipo de propiedad
              </label>
              <select
                value={tipoPropiedad}
                onChange={(e) =>
                  setTipoPropiedad(e.target.value as "" | TipoPropiedad)
                }
                className="input-premium"
              >
                <option value="">Todos los tipos</option>
                <option value="Casa">Casa</option>
                <option value="Apartamento">Apartamento</option>
                <option value="Condominio">Condominio</option>
                <option value="Terreno">Terreno</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#000000]">
                Precio mínimo
              </label>
              <input
                type="number"
                placeholder="Ej. 150000"
                value={precioMin}
                onChange={(e) => setPrecioMin(e.target.value)}
                className="input-premium"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#000000]">
                Precio máximo
              </label>
              <input
                type="number"
                placeholder="Ej. 500000"
                value={precioMax}
                onChange={(e) => setPrecioMax(e.target.value)}
                className="input-premium"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#000000]">
                Ordenar por
              </label>
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value as Orden)}
                className="input-premium"
              >
                <option value="">Sin ordenar</option>
                <option value="precio-asc">Precio: menor a mayor</option>
                <option value="precio-desc">Precio: mayor a menor</option>
                <option value="municipio-asc">Municipio: A-Z</option>
                <option value="municipio-desc">Municipio: Z-A</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={limpiarFiltros}
              className="btn-secondary px-5 py-2.5"
            >
              Limpiar filtros
            </button>
          </div>
        </aside>

        <div>
          <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm text-[#4d4d4d]">
                {propiedadesFiltradas.length} resultado
                {propiedadesFiltradas.length !== 1 ? "s" : ""}
              </p>
              <p className="mt-1 text-sm text-[#4d4d4d]">
                Resultados actualizados según tus filtros
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

              <button
                type="button"
                onClick={limpiarFiltros}
                className="inline-flex items-center rounded-full px-2 py-2 text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
              >
                Limpiar todo
              </button>
            </div>
          )}

          {propiedadesFiltradas.length === 0 ? (
            <div className="rounded-3xl border border-[#e8e8e8] bg-gradient-to-br from-white to-[#f8f8f8] p-10 text-center shadow-sm md:p-16">
              <h2 className="text-3xl font-semibold text-[#000000]">
                Próximamente nuevas propiedades disponibles
              </h2>

              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#4d4d4d]">
                Estamos preparando oportunidades exclusivas en distintas zonas de
                Puerto Rico. Si estás buscando comprar o rentar, agenda una
                consulta personalizada y recibe opciones alineadas con tus
                criterios.
              </p>

              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <Link href="/contact" className="btn-primary px-8 py-3">
                  Agendar consulta
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
            <div className="grid gap-8 md:grid-cols-2 2xl:grid-cols-3">
              {propiedadesFiltradas.map((propiedad) => (
                <article
                  key={propiedad.id}
                  className="group overflow-hidden rounded-3xl border border-[#e8e8e8] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative h-72 w-full bg-[#f5f5f5]">
                    <Image
                      src={propiedad.imagenes[0] || "/placeholder.jpg"}
                      alt={propiedad.titulo}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />

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
                  </div>

                  <div className="p-8">
                    <div className="mb-4 flex justify-between gap-4">
                      <span className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                        {propiedad.tipoNegocio === "venta" ? "Venta" : "Renta"}
                      </span>
                      <span className="text-sm text-[#4d4d4d]">
                        {propiedad.municipio}
                      </span>
                    </div>

                    <h2 className="text-xl font-semibold text-[#11518b]">
                      {propiedad.titulo}
                    </h2>

                    <p className="mt-4 text-2xl font-bold tracking-tight text-[#000000]">
                      {formatoPrecio(propiedad.precio, propiedad.tipoNegocio)}
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

                    <div className="mt-6">
                      <Link
                        href={`/listados/${propiedad.slug}`}
                        className="inline-flex items-center justify-center rounded-full border border-[#11518b] px-5 py-2.5 text-sm font-semibold text-[#11518b] transition-all duration-300 hover:bg-[#11518b] hover:text-white"
                      >
                        Ver detalles
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}