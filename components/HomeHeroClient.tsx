"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { buscarSugerencias } from "@/data/zonas";

export default function HomeHeroClient({
  totalPropiedades,
}: {
  totalPropiedades: number;
}) {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [tipoNegocio, setTipoNegocio] = useState("venta");
  const [precioMin, setPrecioMin] = useState("");
  const [precioMax, setPrecioMax] = useState("");
  const [habitaciones, setHabitaciones] = useState("");
  const [banos, setBanos] = useState("");
  const [tipoPropiedad, setTipoPropiedad] = useState<string[]>([]);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [sugerencias, setSugerencias] = useState<{
    zonas: string[];
    municipios: string[];
  }>({ zonas: [], municipios: [] });
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  const handleSearchChange = (value: string) => {
    setQ(value);
    if (value.trim()) {
      const sug = buscarSugerencias(value);
      setSugerencias(sug);
      setMostrarSugerencias(true);
    } else {
      setSugerencias({ zonas: [], municipios: [] });
      setMostrarSugerencias(false);
    }
  };

  const seleccionarSugerencia = (valor: string) => {
    setQ(valor);
    setMostrarSugerencias(false);
    setSugerencias({ zonas: [], municipios: [] });
  };

  const handleBuscar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const params = new URLSearchParams();

    if (q.trim()) params.set("q", q.trim());
    if (tipoNegocio) params.set("tipoNegocio", tipoNegocio);
    if (precioMin) params.set("precioMin", precioMin);
    if (precioMax) params.set("precioMax", precioMax);
    if (habitaciones) params.set("habitaciones", habitaciones);
    if (banos) params.set("banos", banos);
    if (tipoPropiedad.length > 0) params.set("tipoPropiedad", tipoPropiedad.join(","));

    const query = params.toString();
    router.push(query ? `/listados?${query}` : "/listados");
  };

  const toggleTipoNegocio = (tipo: "venta" | "renta") => {
    if (tipoNegocio === tipo) return;
    setTipoNegocio(tipo);
  };

  const toggleTipoPropiedad = (tipo: string) => {
    if (tipoPropiedad.includes(tipo)) {
      setTipoPropiedad(tipoPropiedad.filter((t) => t !== tipo));
    } else {
      setTipoPropiedad([...tipoPropiedad, tipo]);
    }
  };

  return (
    <section className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/hero-new-image.png"
          alt="Residencia de lujo en Puerto Rico"
          fill
          priority
          className="object-cover"
        />
      </div>

      <div className="absolute inset-0 bg-black/50" />

      <div className="section-shell relative z-10 flex min-h-screen flex-col items-center justify-center pt-28 pb-16 sm:pt-32 sm:pb-24 lg:pt-40 lg:pb-32">
        <div className="w-full max-w-[calc(100vw-2.5rem)] sm:max-w-4xl">
          <p className="eyebrow mb-4 text-center !leading-tight sm:mb-7 sm:!text-[1.8rem] sm:!leading-normal sm:!tracking-[0.25em]">
            <span className="block !text-[1.64rem] !font-bold !tracking-[0.05em] sm:hidden">
              Erickson Real Estate
              <span className="mt-1 block !text-[1.21rem] !font-bold !tracking-[0.05em]">Puerto Rico</span>
            </span>
            <span className="hidden sm:inline">Erickson Real Estate · Puerto Rico</span>
          </p>

          <h1 className="mx-auto max-w-[20rem] text-center text-[1.5rem] font-bold leading-[1.08] text-white sm:max-w-4xl sm:text-[1.85rem] sm:leading-[1.02] md:text-[2.85rem] xl:text-[3.6rem]">
            Propiedades con estrategia, intención y presencia.
          </h1>

          {/* Barra de búsqueda rectangular */}
          <form
            onSubmit={handleBuscar}
            className="mx-auto mt-6 w-full min-w-0 max-w-5xl sm:mt-8 md:mt-11"
          >
            {/* Búsqueda principal - rectangular */}
            <div className="relative flex min-w-0 items-center overflow-hidden rounded-2xl border border-white/20 bg-white shadow-[0_22px_60px_rgba(0,0,0,0.28)]">
              {/* Botón toggle +/- */}
              <button
                type="button"
                onClick={() => setMostrarFiltros(!mostrarFiltros)}
                className="flex h-14 w-12 flex-shrink-0 items-center justify-center border-r border-[#e0e0e0] text-2xl font-bold text-[#11518b] transition hover:bg-[#f7f7f7] sm:w-14"
                title={mostrarFiltros ? "Cerrar filtros" : "Mostrar filtros"}
              >
                {mostrarFiltros ? "−" : "+"}
              </button>

              {/* Input de búsqueda */}
              <div className="relative min-w-0 flex-1">
                <input
                  type="text"
                  placeholder="Buscar por ubicación"
                  value={q}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => q.trim() && setMostrarSugerencias(true)}
                  onBlur={() => setTimeout(() => setMostrarSugerencias(false), 200)}
                  className="w-full min-w-0 px-4 py-3.5 text-base text-[#4d4d4d] outline-none placeholder:text-[#aaa] sm:px-6"
                />

                {/* Dropdown de sugerencias */}
                {mostrarSugerencias &&
                  (sugerencias.zonas.length > 0 ||
                    sugerencias.municipios.length > 0) && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-[#e8e8e8] bg-white shadow-lg max-h-64 overflow-y-auto">
                      {sugerencias.zonas.length > 0 && (
                        <div className="border-b border-[#e8e8e8] p-2">
                          <p className="px-3 py-1 text-xs font-semibold uppercase text-[#11518b]">
                            Zonas
                          </p>
                          {sugerencias.zonas.map((zona) => (
                            <button
                              key={zona}
                              type="button"
                              onClick={() => seleccionarSugerencia(zona)}
                              className="block w-full px-3 py-2 text-left text-sm text-[#4d4d4d] hover:bg-[#f7f7f7]"
                            >
                              {zona}
                            </button>
                          ))}
                        </div>
                      )}

                      {sugerencias.municipios.length > 0 && (
                        <div className="p-2">
                          <p className="px-3 py-1 text-xs font-semibold uppercase text-[#11518b]">
                            Municipios
                          </p>
                          {sugerencias.municipios.map((municipio) => (
                            <button
                              key={municipio}
                              type="button"
                              onClick={() => seleccionarSugerencia(municipio)}
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

              {/* Botón de búsqueda con lupa */}
              <button
                type="submit"
                className="flex h-14 w-12 flex-shrink-0 items-center justify-center border-l border-[#e0e0e0] bg-[#11518b] text-white transition hover:bg-[#0d3a63] sm:w-14"
                title="Buscar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </button>
            </div>

            {/* Filtros avanzados expandibles */}
            {mostrarFiltros && (
              <div className="mt-0 bg-white border border-t-0 border-[#e0e0e0] p-6 shadow-lg">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {/* Columna izquierda */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Venta/Renta */}
                    <div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => toggleTipoNegocio("venta")}
                          className={`px-6 py-2.5 text-sm font-semibold rounded-l transition ${
                            tipoNegocio === "venta"
                              ? "bg-[#11518b] text-white"
                              : "bg-[#f5f5f5] text-[#333] border border-[#d9d9d9]"
                          }`}
                        >
                          Venta
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleTipoNegocio("renta")}
                          className={`px-6 py-2.5 text-sm font-semibold rounded-r transition ${
                            tipoNegocio === "renta"
                              ? "bg-[#11518b] text-white"
                              : "bg-[#f5f5f5] text-[#333] border border-[#d9d9d9]"
                          }`}
                        >
                          Alquiler
                        </button>
                      </div>
                    </div>

                    {/* Rango de Precio */}
                    <div>
                      <label className="block text-sm font-semibold text-[#333] mb-2">
                        Rango de Precio
                      </label>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs text-[#666] mb-1">
                            Mín
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={precioMin}
                            onChange={(e) => {
                              const val = e.target.value;
                              // Bloquear números negativos y la letra 'e'
                              if (val === "" || (parseInt(val) >= 0 && !val.includes("-"))) {
                                setPrecioMin(val.replace(/[eE-]/g, ""));
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "e" || e.key === "E" || e.key === "-" || e.key === "+") e.preventDefault();
                            }}
                            className="w-full rounded border border-[#d9d9d9] px-3 py-2.5 text-sm text-[#333] outline-none focus:border-[#11518b]"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-[#666] mb-1">
                            Máx
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={precioMax}
                            onChange={(e) => {
                              const val = e.target.value;
                              // Bloquear números negativos y la letra 'e'
                              if (val === "" || (parseInt(val) >= 0 && !val.includes("-"))) {
                                setPrecioMax(val.replace(/[eE-]/g, ""));
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "e" || e.key === "E" || e.key === "-" || e.key === "+") e.preventDefault();
                            }}
                            className="w-full rounded border border-[#d9d9d9] px-3 py-2.5 text-sm text-[#333] outline-none focus:border-[#11518b]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Habitaciones */}
                    <div>
                      <label className="block text-sm font-semibold text-[#333] mb-3">
                        Habitaciones
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {["Todos", "1+", "2+", "3+", "4+", "5+"].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setHabitaciones(opt === "Todos" ? "" : opt)}
                            className={`px-4 py-2 rounded text-sm font-semibold transition ${
                              (opt === "Todos" && !habitaciones) ||
                              habitaciones === opt
                                ? "bg-[#11518b] text-white"
                                : "border border-[#d9d9d9] text-[#333] hover:border-[#11518b]"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Baños */}
                    <div>
                      <label className="block text-sm font-semibold text-[#333] mb-3">
                        Baños
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {["Todos", "1+", "2+", "3+", "4+", "5+"].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setBanos(opt === "Todos" ? "" : opt)}
                            className={`px-4 py-2 rounded text-sm font-semibold transition ${
                              (opt === "Todos" && !banos) || banos === opt
                                ? "bg-[#11518b] text-white"
                                : "border border-[#d9d9d9] text-[#333] hover:border-[#11518b]"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Columna derecha - Tipo de Propiedad */}
                  <div className="lg:col-span-1">
                    <h3 className="text-sm font-semibold text-[#333] mb-4">
                      Tipo de Propiedad
                    </h3>
                    <div className="space-y-3">
                      {["Apartamento", "Comercial", "Casas", "Terreno", "Multi-Familia"].map(
                        (tipo) => (
                          <label
                            key={tipo}
                            className="flex items-center gap-3 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={tipoPropiedad.includes(tipo)}
                              onChange={() => toggleTipoPropiedad(tipo)}
                              className="sr-only"
                            />
                            <div
                              className={`w-10 h-6 rounded-full transition border ${
                                tipoPropiedad.includes(tipo)
                                  ? "bg-[#11518b] border-[#11518b]"
                                  : "bg-white border-[#d9d9d9]"
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-full transition transform mt-1 ${
                                  tipoPropiedad.includes(tipo)
                                    ? "bg-white translate-x-5"
                                    : "bg-[#999] translate-x-1"
                                }`}
                              />
                            </div>
                            <span className="text-sm text-[#333]">{tipo}</span>
                          </label>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="mt-6 flex gap-3">
                  <button
                    type="submit"
                    className="flex items-center gap-2 rounded bg-[#11518b] text-white font-semibold py-2.5 px-6 hover:bg-[#0d3a63] transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    Buscar
                  </button>
                  <button
                    type="button"
                    onClick={() => setMostrarFiltros(false)}
                    className="rounded border border-[#d9d9d9] text-[#333] font-semibold py-2.5 px-6 hover:bg-[#f5f5f5] transition"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}

            {totalPropiedades > 0 && (
              <p className="mt-4 text-center text-sm text-white/85">
                {totalPropiedades}{" "}
                {totalPropiedades === 1 ? "listado disponible" : "listados disponibles"}
              </p>
            )}
          </form>

          <p className="mx-auto mt-4 max-w-[19rem] text-center text-[1.1rem] leading-[1.65] text-white/90 sm:mt-6 sm:max-w-xl sm:text-base md:mt-8 md:max-w-2xl md:text-xl md:leading-relaxed">
            Compra, vende o invierte con guía clara, estrategia y confianza desde el inicio.
          </p>

          {/* CTA Buttons */}
          <div className="mx-auto mt-5 flex w-full max-w-xs flex-col gap-3 justify-center sm:mt-7 sm:max-w-none sm:flex-row sm:flex-wrap sm:gap-4 md:mt-9">
            <Link href="/listados" className="btn-primary min-h-[50px] w-full sm:w-auto">
              Explorar listados
            </Link>

            <Link
              href="/contact"
              className="inline-flex min-h-[50px] w-full items-center justify-center rounded-full border border-white/60 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 sm:w-auto"
            >
              Agendar consulta
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
