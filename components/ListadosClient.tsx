"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  buscarSugerencias,
  getRegionByName,
  type RegionSlug,
} from "@/data/zonas";
import {
  formatoPrecio,
  estadoClasses,
  Orden,
} from "@/lib/propiedades";
import { formatPropertyLocation } from "@/lib/puerto-rico-sectores";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { usePublicLocale } from "@/components/PublicLocaleProvider";
import type { DictionaryShape } from "@/lib/i18n/get-dictionary";
import { getEquivalentRoute } from "@/lib/i18n/routing";

type TipoNegocio = "venta" | "renta";
type TipoPropiedad =
  | "Casa"
  | "Apartamento"
  | "Condominio"
  | "Terreno"
  | "Comercial";
type EstadoPropiedad =
  | "disponible"
  | "coming_soon"
  | "bajo_contrato"
  | "vendida"
  | "rentada";

// Note: This type is used for the server-side data from queries
// It uses snake_case to match database column names
type PropiedadDB = {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  municipio: string;
  sector_comunidad?: string | null;
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
  origen_listado: "propio" | "co_broke" | "externo";
  permiso_publicar_web?: boolean;
  permiso_usar_fotos?: boolean;
};


type InitialFilters = {
  q: string;
  region: "" | RegionSlug;
  tipoNegocio: "" | TipoNegocio;
  municipio: string;
  tipoPropiedad: TipoPropiedad[];
  precioMin: string;
  precioMax: string;
  habitaciones: string;
  banos: string;
  orden: Orden;
};

type ActiveChip = {
  key:
    | "q"
    | "region"
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

type ListingsCopy = DictionaryShape["listingsPage"];

function ordenLabel(orden: Orden, copy: ListingsCopy) {
  switch (orden) {
    case "precio-asc":
      return copy.sort.priceAsc;
    case "precio-desc":
      return copy.sort.priceDesc;
    case "municipio-asc":
      return copy.sort.municipalityAsc;
    case "municipio-desc":
      return copy.sort.municipalityDesc;
    default:
      return "";
  }
}

function PaginationControls({
  currentPage,
  totalPages,
  queryString,
  pathname,
  previousLabel,
  nextLabel,
}: {
  currentPage: number;
  totalPages: number;
  queryString: string;
  pathname: string;
  previousLabel: string;
  nextLabel: string;
}) {
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i);
  }

  const pageHref = (page: number) => {
    const params = new URLSearchParams(queryString);
    params.set("page", String(page));
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-center gap-2">
      {currentPage > 1 && (
        <Link
          href={pageHref(currentPage - 1)}
          className="rounded-lg border border-[#d9d9d9] px-4 py-2 text-sm font-semibold text-[#11518b] transition hover:bg-[#11518b] hover:text-white"
        >
          {previousLabel}
        </Link>
      )}

      {pages.map((page) => (
        <Link
          key={page}
          href={pageHref(page)}
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
          href={pageHref(currentPage + 1)}
          className="rounded-lg border border-[#d9d9d9] px-4 py-2 text-sm font-semibold text-[#11518b] transition hover:bg-[#11518b] hover:text-white"
        >
          {nextLabel}
        </Link>
      )}
    </div>
  );
}

/* ─── Toggle switch component ─────────────────────────────────────────────── */
function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[22px] w-[42px] flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        checked ? "bg-[#11518b]" : "bg-[#d9d9d9]"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow ring-0 transition duration-200 ${
          checked ? "translate-x-[20px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function ListadosClient({
  propiedades,
  paginationData,
  initialFilters,
}: {
  propiedades: PropiedadDB[];
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
  const { locale, dictionary } = usePublicLocale();
  const copy = dictionary.listingsPage;
  const contactHref = getEquivalentRoute("/contact", locale) || "/contact";
  const regionLabel = useCallback(
    (value: RegionSlug) => copy.regionLabels[value],
    [copy]
  );
  const propertyTypeLabel = useCallback(
    (value: TipoPropiedad) => copy.propertyTypes[value],
    [copy]
  );

  // Filtros temporales (se actualizan mientras el usuario escribe)
  const [qTemp, setQTemp] = useState(initialFilters.q);
  const [precioMinTemp, setPrecioMinTemp] = useState(initialFilters.precioMin);
  const [precioMaxTemp, setPrecioMaxTemp] = useState(initialFilters.precioMax);
  const [habitacionesTemp, setHabitacionesTemp] = useState(initialFilters.habitaciones);
  const [banosTemp, setBanosTemp] = useState(initialFilters.banos);

  // Filtros aplicados (se actualizan solo al hacer clic en buscar o presionar Enter)
  const [q, setQ] = useState(initialFilters.q);
  const [region, setRegion] = useState<"" | RegionSlug>(initialFilters.region);
  const [tipoNegocio, setTipoNegocio] = useState<TipoNegocio>(
    initialFilters.tipoNegocio || "venta"
  );
  const [municipio, setMunicipio] = useState(initialFilters.municipio);
  const [tipoPropiedad, setTipoPropiedad] = useState<TipoPropiedad[]>(
    Array.isArray(initialFilters.tipoPropiedad) ? initialFilters.tipoPropiedad : []
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const limpiarFiltros = () => {
    setQ("");
    setQTemp("");
    setRegion("");
    setTipoNegocio("venta");
    setMunicipio("");
    setTipoPropiedad([]);
    setPrecioMin("");
    setPrecioMinTemp("");
    setPrecioMax("");
    setPrecioMaxTemp("");
    setHabitaciones("");
    setHabitacionesTemp("");
    setBanos("");
    setBanosTemp("");
    setOrden("");
    // Actualizar URL
    updateUrl({
      q: "",
      region: "",
      tipoNegocio: "venta",
      municipio: "",
      tipoPropiedad: [],
      precioMin: "",
      precioMax: "",
      habitaciones: "",
      banos: "",
      orden: "",
    });
  };

  // Función para actualizar la URL con los filtros actuales
  const updateUrl = (filters: {
    q?: string;
    region?: "" | RegionSlug;
    tipoNegocio?: TipoNegocio;
    municipio?: string;
    tipoPropiedad?: TipoPropiedad[];
    precioMin?: string;
    precioMax?: string;
    habitaciones?: string;
    banos?: string;
    orden?: Orden;
  }) => {
    const params = new URLSearchParams();

    if (filters.q?.trim()) params.set("q", filters.q.trim());
    if (filters.region) params.set("region", filters.region);
    if (filters.tipoNegocio) params.set("tipoNegocio", filters.tipoNegocio);
    if (filters.municipio?.trim()) params.set("municipio", filters.municipio.trim());
    if (filters.tipoPropiedad && filters.tipoPropiedad.length > 0) {
      params.set("tipoPropiedad", filters.tipoPropiedad.join(","));
    }
    if (filters.precioMin?.trim()) params.set("precioMin", filters.precioMin.trim());
    if (filters.precioMax?.trim()) params.set("precioMax", filters.precioMax.trim());
    if (filters.habitaciones?.trim()) params.set("habitaciones", filters.habitaciones.trim());
    if (filters.banos?.trim()) params.set("banos", filters.banos.trim());
    if (filters.orden) params.set("orden", filters.orden);

    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    router.replace(nextUrl, { scroll: false });
  };

  // Función para aplicar la búsqueda (se ejecuta al hacer clic en lupa o presionar Enter)
  const aplicarBusqueda = () => {
    setQ(qTemp);
    setPrecioMin(precioMinTemp);
    setPrecioMax(precioMaxTemp);
    setHabitaciones(habitacionesTemp);
    setBanos(banosTemp);

    // Actualizar URL con los nuevos valores
    updateUrl({
      q: qTemp,
      region,
      tipoNegocio,
      municipio,
      tipoPropiedad,
      precioMin: precioMinTemp,
      precioMax: precioMaxTemp,
      habitaciones: habitacionesTemp,
      banos: banosTemp,
      orden,
    });
  };

  // Manejador de Venta/Renta: exclusión mutua (SIN actualizar URL)
  const handleTipoNegocio = (tipo: TipoNegocio) => {
    if (tipoNegocio === tipo) {
      // Si ya está seleccionado, no hacer nada (siempre debe haber uno activo)
      return;
    }
    // Solo cambiar el estado, NO actualizar la URL
    setTipoNegocio(tipo);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const quitarFiltro = (key: ActiveChip["key"]) => {
    switch (key) {
      case "q":
        setQ("");
        setQTemp("");
        break;
      case "region":
        setRegion("");
        break;
      case "tipoNegocio":
        setTipoNegocio("venta");
        break;
      case "municipio":
        setMunicipio("");
        break;
      case "tipoPropiedad":
        setTipoPropiedad([]);
        break;
      case "precioMin":
        setPrecioMin("");
        setPrecioMinTemp("");
        break;
      case "precioMax":
        setPrecioMax("");
        setPrecioMaxTemp("");
        break;
      case "habitaciones":
        setHabitaciones("");
        setHabitacionesTemp("");
        break;
      case "banos":
        setBanos("");
        setBanosTemp("");
        break;
      case "orden":
        setOrden("");
        break;
    }
  };

  // NO hay useEffect reactivo. La URL solo se actualiza cuando se llama a updateUrl()
  // Esto previene auto-updates mientras el usuario escribe

  useEffect(() => {
    if (!shareMessage) return;
    const timer = setTimeout(() => setShareMessage(""), 2200);
    return () => clearTimeout(timer);
  }, [shareMessage]);

  const propiedadesNormalizadas = useMemo(
    () =>
      (propiedades as PropiedadDB[]).map((p) => ({
        id: p.id,
        slug: p.slug,
        titulo: p.titulo,
        descripcion: p.descripcion,
        municipio: p.municipio,
        sectorComunidad: p.sector_comunidad,
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
            : ["/og-image.jpg"],
        origenListado: p.origen_listado || "propio",
        origen_listado: p.origen_listado || "propio",
        permiso_publicar_web: p.permiso_publicar_web || false,
        permiso_usar_fotos: p.permiso_usar_fotos || false,
      })),
    [propiedades]
  );

  const propiedadesFiltradas = propiedadesNormalizadas;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const activeChips = useMemo<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];

    if (q.trim()) {
      chips.push({ key: "q", label: `${copy.filters.search}: ${q.trim()}` });
    }
    if (region) {
      chips.push({ key: "region", label: `${copy.filters.region}: ${regionLabel(region)}` });
    }
    if (tipoNegocio) {
      chips.push({
        key: "tipoNegocio",
        label: tipoNegocio === "venta" ? copy.sale : copy.rent,
      });
    }
    if (municipio.trim()) {
      chips.push({ key: "municipio", label: `${copy.filters.municipality}: ${municipio.trim()}` });
    }
    if (tipoPropiedad.length > 0) {
      chips.push({
        key: "tipoPropiedad",
        label: `${copy.filters.types}: ${tipoPropiedad.map(propertyTypeLabel).join(", ")}`,
      });
    }
    if (precioMin.trim()) {
      chips.push({ key: "precioMin", label: `${copy.filters.from}: $${Number(precioMin).toLocaleString("en-US")}` });
    }
    if (precioMax.trim()) {
      chips.push({ key: "precioMax", label: `${copy.filters.to}: $${Number(precioMax).toLocaleString("en-US")}` });
    }
    if (habitaciones.trim()) {
      chips.push({ key: "habitaciones", label: `${habitaciones} ${copy.filters.bedroomsShort}` });
    }
    if (banos.trim()) {
      chips.push({ key: "banos", label: `${banos} ${copy.filters.bathroomsShort}` });
    }
    if (orden) {
      chips.push({ key: "orden", label: ordenLabel(orden, copy) });
    }

    return chips;
  }, [
    q,
    region,
    tipoNegocio,
    municipio,
    tipoPropiedad,
    precioMin,
    precioMax,
    habitaciones,
    banos,
    orden,
    copy,
    propertyTypeLabel,
    regionLabel,
  ]);

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
      setShareMessage(copy.linkCopied);
    } catch {
      setShareMessage(copy.copyFailed);
    }
  };

  /* ── helpers for property type toggles ── */
  const ALL_TIPOS: TipoPropiedad[] = ["Casa", "Apartamento", "Condominio", "Terreno", "Comercial"];
  const allSelected = tipoPropiedad.length === ALL_TIPOS.length;

  const toggleTipo = (tipo: TipoPropiedad) => {
    let newTipos: TipoPropiedad[];
    if (tipoPropiedad.includes(tipo)) {
      newTipos = tipoPropiedad.filter((t) => t !== tipo);
    } else {
      newTipos = [...tipoPropiedad, tipo];
    }
    setTipoPropiedad(newTipos);
    // Actualizar URL inmediatamente
    updateUrl({
      q,
      region,
      tipoNegocio,
      municipio,
      tipoPropiedad: newTipos,
      precioMin,
      precioMax,
      habitaciones,
      banos,
      orden,
    });
  };

  return (
    <section className="pb-24">
      <div className="section-shell">

        {/* ══════════════════════════════════════════════════════════════════
            SEARCH PANEL — matches reference design
        ══════════════════════════════════════════════════════════════════ */}
        <div className="mb-8 rounded-lg border border-[#e0e0e0] bg-white shadow-sm">
          <div className="flex flex-col lg:flex-row">

            {/* ── LEFT COLUMN ────────────────────────────────────────────── */}
            <div className="flex-1 p-5 lg:border-r lg:border-[#e0e0e0]">

              {/* Row 1: For Sale | For Rent + Search by Location + Search btn */}
              <div className="flex items-stretch gap-0 mb-4">
                {/* Venta tab */}
                <button
                  type="button"
                  onClick={() => handleTipoNegocio("venta")}
                  className={`px-5 py-2.5 text-sm font-semibold rounded-l transition whitespace-nowrap ${
                    tipoNegocio === "venta"
                      ? "bg-[#11518b] text-white"
                      : "bg-white text-[#333] border border-[#d9d9d9] hover:bg-[#f5f5f5]"
                  }`}
                >
                  {copy.sale}
                </button>

                {/* Renta tab */}
                <button
                  type="button"
                  onClick={() => handleTipoNegocio("renta")}
                  className={`px-5 py-2.5 text-sm font-semibold border-t border-b transition whitespace-nowrap ${
                    tipoNegocio === "renta"
                      ? "bg-[#11518b] text-white border-[#11518b]"
                      : "bg-white text-[#333] border-[#d9d9d9] hover:bg-[#f5f5f5]"
                  }`}
                >
                  {copy.rent}
                </button>

                {/* Search by Location input */}
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder={copy.searchByLocation}
                    value={qTemp}
                    onChange={(e) => {
                      setQTemp(e.target.value);
                      if (e.target.value.trim()) {
                        const sug = buscarSugerencias(e.target.value);
                        setSugerencias(sug);
                        setMostrarSugerencias(true);
                      } else {
                        setSugerencias({ zonas: [], municipios: [] });
                        setMostrarSugerencias(false);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setQ(qTemp);
                        aplicarBusqueda();
                        setMostrarSugerencias(false);
                      }
                    }}
                    onFocus={() => qTemp.trim() && setMostrarSugerencias(true)}
                    onBlur={() => setTimeout(() => setMostrarSugerencias(false), 200)}
                    className="h-full w-full border border-[#d9d9d9] border-l-0 px-4 py-2.5 text-sm text-[#333] outline-none focus:border-[#11518b] transition placeholder:text-[#aaa]"
                  />

                  {/* Autocomplete dropdown */}
                  {mostrarSugerencias &&
                    (sugerencias.zonas.length > 0 || sugerencias.municipios.length > 0) && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-[#e8e8e8] bg-white shadow-lg max-h-64 overflow-y-auto">
                        {sugerencias.zonas.length > 0 && (
                          <div className="border-b border-[#e8e8e8] p-2">
                            <p className="px-3 py-1 text-xs font-semibold uppercase text-[#11518b]">
                              {copy.zones}
                            </p>
                            {sugerencias.zonas.map((zona) => (
                              <button
                                key={zona}
                                type="button"
                                onClick={() => {
                                  const selectedRegion = getRegionByName(zona);
                                  if (!selectedRegion) return;
                                  setQTemp("");
                                  setQ("");
                                  setRegion(selectedRegion);
                                  setMostrarSugerencias(false);
                                  setSugerencias({ zonas: [], municipios: [] });
                                  updateUrl({
                                    q: "",
                                    region: selectedRegion,
                                    tipoNegocio,
                                    municipio,
                                    tipoPropiedad,
                                    precioMin,
                                    precioMax,
                                    habitaciones,
                                    banos,
                                    orden,
                                  });
                                }}
                                className="block w-full px-3 py-2 text-left text-sm text-[#4d4d4d] hover:bg-[#f7f7f7]"
                              >
                                {(() => {
                                  const suggestionRegion = getRegionByName(zona);
                                  return suggestionRegion
                                    ? regionLabel(suggestionRegion)
                                    : zona;
                                })()}
                              </button>
                            ))}
                          </div>
                        )}
                        {sugerencias.municipios.length > 0 && (
                          <div className="p-2">
                            <p className="px-3 py-1 text-xs font-semibold uppercase text-[#11518b]">
                              {copy.municipalities}
                            </p>
                            {sugerencias.municipios.map((mun) => (
                              <button
                                key={mun}
                                type="button"
                                onClick={() => {
                                  setQTemp(mun);
                                  setQ(mun);
                                  setMostrarSugerencias(false);
                                  setSugerencias({ zonas: [], municipios: [] });
                                  updateUrl({
                                    q: mun,
                                    region,
                                    tipoNegocio,
                                    municipio,
                                    tipoPropiedad,
                                    precioMin,
                                    precioMax,
                                    habitaciones,
                                    banos,
                                    orden,
                                  });
                                }}
                                className="block w-full px-3 py-2 text-left text-sm text-[#4d4d4d] hover:bg-[#f7f7f7]"
                              >
                                {mun}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                </div>

                {/* Botón de búsqueda */}
                <button
                  type="button"
                  onClick={aplicarBusqueda}
                  className="flex items-center justify-center bg-[#11518b] hover:bg-[#0d406d] text-white px-4 rounded-r transition"
                  title={dictionary.common.search}
                  aria-label={dictionary.common.search}
                >
                  {/* Magnifier icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>
              </div>

              {/* Row 2: Min $ | Max $ | Beds | Baths */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

                {/* Min $ */}
                <div className="flex items-center gap-2 rounded border border-[#d9d9d9] bg-white px-3 py-2.5 hover:border-[#11518b] transition">
                  <span className="text-sm font-medium text-[#555] whitespace-nowrap">{copy.minimumPrice}</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={precioMinTemp}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Bloquear números negativos y la letra 'e'
                      if (val === "" || (parseInt(val) >= 0 && !val.includes("-"))) {
                        setPrecioMinTemp(val.replace(/[eE-]/g, ""));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "e" || e.key === "E" || e.key === "-" || e.key === "+") e.preventDefault();
                      if (e.key === "Enter") aplicarBusqueda();
                    }}
                    className="flex-1 min-w-0 outline-none text-sm bg-transparent text-[#333] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    onFocus={(e) => e.target.classList.add('focus:border-[#11518b]')}
                  />
                </div>

                {/* Max $ */}
                <div className="flex items-center gap-2 rounded border border-[#d9d9d9] bg-white px-3 py-2.5 hover:border-[#11518b] transition">
                  <span className="text-sm font-medium text-[#555] whitespace-nowrap">{copy.maximumPrice}</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={precioMaxTemp}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Bloquear números negativos y la letra 'e'
                      if (val === "" || (parseInt(val) >= 0 && !val.includes("-"))) {
                        setPrecioMaxTemp(val.replace(/[eE-]/g, ""));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "e" || e.key === "E" || e.key === "-" || e.key === "+") e.preventDefault();
                      if (e.key === "Enter") aplicarBusqueda();
                    }}
                    className="flex-1 min-w-0 outline-none text-sm bg-transparent text-[#333] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    onFocus={(e) => e.target.classList.add('focus:border-[#11518b]')}
                  />
                </div>

                {/* Beds */}
                <div className="flex items-center gap-2 rounded border border-[#d9d9d9] bg-white px-3 py-2.5 hover:border-[#11518b] transition">
                  {/* Bed icon — matches reference exactly */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="text-[#3a3a3a] flex-shrink-0"
                  >
                    <path d="M22 10.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v4.5A2.5 2.5 0 0 0 0 13v5h1.5v2h1v-2h19v2h1v-2H24v-5a2.5 2.5 0 0 0-2-2.5zM4 6h16v4h-5V9a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v1H4V6zm5 4V9h6v1H9zm-7 8v-5a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v5H2z" />
                  </svg>
                  <input
                    type="number"
                    placeholder={copy.bedrooms}
                    min="0"
                    value={habitacionesTemp}
                    onChange={(e) => setHabitacionesTemp(e.target.value)}
                    onKeyDown={(e) => { 
                      if (e.key === "Enter") aplicarBusqueda();
                      if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") e.preventDefault();
                    }}
                    className="flex-1 min-w-0 outline-none text-sm bg-transparent text-[#333] placeholder:text-[#aaa]"
                  />
                </div>

                {/* Baths */}
                <div className="flex items-center gap-2 rounded border border-[#d9d9d9] bg-white px-3 py-2.5 hover:border-[#11518b] transition">
                  {/* Bath icon — matches reference exactly */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="text-[#3a3a3a] flex-shrink-0"
                  >
                    <path d="M21 10H7V5a1 1 0 0 1 1-1 1 1 0 0 1 1 1 3 3 0 0 0 3 3h1a1 1 0 0 0 0-2h-1a1 1 0 0 1-1-1 3 3 0 0 0-3-3 3 3 0 0 0-3 3v5H3a1 1 0 0 0-1 1v2a5 5 0 0 0 4 4.9V20H4a1 1 0 0 0 0 2h16a1 1 0 0 0 0-2h-2v-2.1A5 5 0 0 0 22 13v-2a1 1 0 0 0-1-1zm-1 3a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-1h16v1zm-5 5v2H9v-2h6z" />
                  </svg>
                  <input
                    type="number"
                    placeholder={copy.bathrooms}
                    min="0"
                    value={banosTemp}
                    onChange={(e) => setBanosTemp(e.target.value)}
                    onKeyDown={(e) => { 
                      if (e.key === "Enter") aplicarBusqueda();
                      if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") e.preventDefault();
                    }}
                    className="flex-1 min-w-0 outline-none text-sm bg-transparent text-[#333] placeholder:text-[#aaa]"
                  />
                </div>

              </div>
            </div>

            {/* ── RIGHT COLUMN: Property Type ────────────────────────────── */}
            <div className="p-5 lg:w-[380px]">
              {/* Header row */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-base font-semibold text-[#222]">{copy.propertyType}</span>
                <div className="flex items-center gap-2">
                  <Toggle
                    checked={allSelected}
                    onChange={(v) => setTipoPropiedad(v ? [...ALL_TIPOS] : [])}
                    ariaLabel={copy.all}
                  />
                  <span className="text-sm text-[#555]">{copy.all}</span>
                </div>
              </div>

              {/* Tipo grid: 2 columns */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                {(
                  [
                    { tipo: "Apartamento", label: copy.propertyTypes.Apartamento },
                    { tipo: "Comercial",   label: copy.propertyTypes.Comercial },
                    { tipo: "Casa",        label: copy.propertyTypes.Casa },
                    { tipo: "Terreno",     label: copy.propertyTypes.Terreno },
                    { tipo: "Condominio",  label: copy.propertyTypes.Condominio },
                  ] as { tipo: TipoPropiedad; label: string }[]
                ).map(({ tipo, label }) => (
                  <div key={tipo} className="flex items-center gap-2">
                    <Toggle
                      checked={tipoPropiedad.includes(tipo)}
                      onChange={() => toggleTipo(tipo)}
                      ariaLabel={label}
                    />
                    <span className="text-sm text-[#444]">{label}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
        {/* ══════════════════════════════════════════════════════════════════ */}

        {/* Resultados y compartir */}
        {region && (
          <div className="mb-5 flex flex-wrap items-center gap-2" aria-label={copy.filters.active}>
            <button
              type="button"
              onClick={() => {
                setRegion("");
                const next = new URLSearchParams(searchParams.toString());
                next.delete("region");
                next.delete("page");
                router.replace(next.size > 0 ? `${pathname}?${next.toString()}` : pathname, {
                  scroll: false,
                });
              }}
              className="inline-flex items-center gap-2 rounded-full border border-[#11518b]/25 bg-[#eef6fc] px-3 py-1.5 text-sm font-semibold text-[#11518b]"
              aria-label={`${copy.filters.remove} ${copy.filters.region}: ${regionLabel(region)}`}
            >
              {copy.filters.region}: {regionLabel(region)}
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-[#4d4d4d]">
              {paginationData.totalItems}{" "}
              {paginationData.totalItems === 1
                ? copy.resultsSingular
                : copy.resultsPlural}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center justify-center rounded-full border border-[#d9d9d9] bg-white px-5 py-2.5 text-sm font-semibold text-[#4d4d4d] transition hover:border-[#11518b] hover:text-[#11518b]"
            >
              {copy.shareSearch}
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
              {copy.emptyTitle}
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#4d4d4d]">
              {copy.emptyDescription}
            </p>

            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link href={contactHref} className="btn-primary px-8 py-3">
                {copy.requestGuidance}
              </Link>

              <a
                href="https://wa.me/17876774900"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackAnalyticsEvent("whatsapp_click", {
                    source_route: "/listados_empty_state",
                  })
                }
                className="btn-secondary px-8 py-3"
              >
                {copy.whatsapp}
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
                      const src = propiedad.imagenes[0] || "/og-image.jpg";
                      const esVideo = /\.(mp4|webm|mov)(\?|$)/i.test(src) || src.includes("/videos/");
                      if (esVideo) {
                        return (
                          <video
                            src={src}
                            muted
                            autoPlay
                            loop
                            playsInline
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        );
                      }
                      return (
                        <Image
                          src={src}
                          alt={propiedad.titulo}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1536px) 50vw, 33vw"
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
                        {copy.statuses[propiedad.estado]}
                      </span>

                      {propiedad.destacado && (
                        <span className="rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#11518b]">
                          {copy.featured}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleFavorite(propiedad.id)}
                      className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-xl transition hover:bg-white"
                      title={favorites.has(propiedad.id) ? copy.removeFavorite : copy.addFavorite}
                      aria-label={favorites.has(propiedad.id) ? copy.removeFavorite : copy.addFavorite}
                    >
                      {favorites.has(propiedad.id) ? "❤️" : "🤍"}
                    </button>
                  </div>

                  <div className="p-6">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                        {propiedad.tipoNegocio === "venta" ? copy.sale : copy.rent}
                      </span>
                      {propiedad.origen_listado === "co_broke" && (
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37] bg-[#fff9e6] px-2 py-1 rounded">
                          {copy.collaboration}
                        </span>
                      )}
                      {propiedad.origen_listado === "externo" && (
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37] bg-[#fff9e6] px-2 py-1 rounded">
                          {copy.externalReference}
                        </span>
                      )}
                    </div>

                    <h3 className="mb-2 text-lg font-bold text-[#000000] line-clamp-2">
                      {propiedad.titulo}
                    </h3>

                    <p className="mb-3 text-sm text-[#4d4d4d]">
                      {formatPropertyLocation(
                        propiedad.municipio,
                        propiedad.sectorComunidad
                      )}
                    </p>

                    <p className="mb-4 text-sm text-[#4d4d4d] line-clamp-2">
                      {propiedad.descripcion}
                    </p>

                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-2xl font-bold text-[#11518b]">
                        {formatoPrecio(propiedad.precio, propiedad.tipoNegocio)}
                      </span>
                    </div>

                    <div className="mb-4 grid grid-cols-3 gap-2 border-t border-[#e8e8e8] pt-4">
                      <div className="text-center">
                        <p className="text-xs text-[#4d4d4d]">{copy.bedroomsCard}</p>
                        <p className="text-lg font-bold text-[#000000]">
                          {propiedad.habitaciones}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-[#4d4d4d]">{copy.bathroomsCard}</p>
                        <p className="text-lg font-bold text-[#000000]">
                          {propiedad.banos}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-[#4d4d4d]">m²</p>
                        <p className="text-lg font-bold text-[#000000]">
                          {propiedad.metrosCuadrados}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={
                        getEquivalentRoute(`/listados/${propiedad.slug}`, locale) ||
                        `/listados/${propiedad.slug}`
                      }
                      className="btn-primary w-full text-center py-2.5"
                    >
                      {dictionary.common.viewProperty}
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            {/* Paginación */}
            <div className="mt-12">
              <PaginationControls
                currentPage={paginationData.currentPage}
                totalPages={paginationData.totalPages}
                queryString={searchParams.toString()}
                pathname={pathname}
                previousLabel={dictionary.common.previous}
                nextLabel={dictionary.common.next}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
