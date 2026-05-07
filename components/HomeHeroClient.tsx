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
          src="/hero-luxurypr.jpg"
          alt="Residencia de lujo en Puerto Rico"
          fill
          priority
          className="object-cover"
        />
      </div>

      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-black/30" />

      <div className="section-shell relative z-10 flex min-h-screen flex-col items-center justify-center pt-32 pb-24 lg:pt-40 lg:pb-32">
        <div className="max-w-4xl w-full">
          <p className="eyebrow mb-5 text-center">Erickson Real Estate · Puerto Rico</p>

          <h1 className="max-w-4xl text-4xl font-bold leading-[0.95] text-white sm:text-5xl md:text-7xl xl:text-[5.5rem] text-center mx-auto">
            Propiedades con estrategia, intención y presencia.
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/90 md:text-xl text-center mx-auto">
            Compra, vende o invierte en Puerto Rico con guía clara, estrategia y confianza desde el inicio.
          </p>

          {/* Barra de búsqueda rectangular */}
          <form
            onSubmit={handleBuscar}
            className="mt-12 max-w-4xl mx-auto w-full"
          >
            {/* Búsqueda principal - rectangular */}
            <div className="relative bg-white shadow-2xl overflow-hidden flex items-center border border-[#e0e0e0]">
              {/* Botón toggle +/- */}
              <button
                type="button"
                onClick={() => setMostrarFiltros(!mostrarFiltros)}
                className="flex-shrink-0 h-14 w-14 flex items-center justify-center text-[#11518b] hover:bg-[#f7f7f7] transition font-bold text-2xl border-r border-[#e0e0e0]"
                title={mostrarFiltros ? "Cerrar filtros" : "Mostrar filtros"}
              >
                {mostrarFiltros ? "−" : "+"}
              </button>

              {/* Input de búsqueda */}
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Buscar por ubicación"
                  value={q}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => q.trim() && setMostrarSugerencias(true)}
                  onBlur={() => setTimeout(() => setMostrarSugerencias(false), 200)}
                  className="w-full px-6 py-3.5 text-[#4d4d4d] outline-none text-base placeholder:text-[#aaa]"
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
                className="flex-shrink-0 h-14 w-14 flex items-center justify-center bg-[#11518b] text-white hover:bg-[#0d3a63] transition border-l border-[#e0e0e0]"
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

            <p className="mt-4 text-center text-sm text-white/80">
              {totalPropiedades}{" "}
              {totalPropiedades === 1 ? "listado disponible" : "listados disponibles"}
            </p>
          </form>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-wrap gap-4 justify-center">
            <Link href="/listados" className="btn-primary">
              Explorar listados
            </Link>

            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              Agendar consulta
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
