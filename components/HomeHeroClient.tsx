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
  const [tipoNegocio, setTipoNegocio] = useState("");
  const [precioMin, setPrecioMin] = useState("");
  const [precioMax, setPrecioMax] = useState("");
  const [habitaciones, setHabitaciones] = useState("");
  const [banos, setBanos] = useState("");
  const [tipoPropiedad, setTipoPropiedad] = useState("");
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
    if (tipoPropiedad) params.set("tipoPropiedad", tipoPropiedad);

    const query = params.toString();
    router.push(query ? `/listados?${query}` : "/listados");
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

      <div className="section-shell relative z-10 flex min-h-screen flex-col items-center justify-center pt-32 pb-16 lg:pt-40">
        <div className="max-w-4xl w-full">
          <p className="eyebrow mb-5 text-center">Puerto Rico Real Estate</p>

          <h1 className="max-w-4xl text-4xl font-bold leading-[0.95] text-white sm:text-5xl md:text-7xl xl:text-[5.5rem] text-center mx-auto">
            Propiedades con visión, estrategia y presencia.
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/90 md:text-xl text-center mx-auto">
            Compra, vende o invierte en Puerto Rico con una asesoría clara,
            una imagen profesional y una experiencia diseñada para inspirar
            confianza desde el primer paso.
          </p>

          {/* Barra de búsqueda premium */}
          <form
            onSubmit={handleBuscar}
            className="mt-12 max-w-3xl mx-auto w-full"
          >
            {/* Búsqueda principal */}
            <div className="relative rounded-full bg-white shadow-2xl overflow-hidden flex items-center">
              {/* Botón de filtros avanzados */}
              <button
                type="button"
                onClick={() => setMostrarFiltros(!mostrarFiltros)}
                className="flex-shrink-0 h-16 w-16 flex items-center justify-center text-[#11518b] hover:bg-[#f7f7f7] transition font-bold text-xl"
                title="Filtros avanzados"
              >
                +
              </button>

              {/* Input de búsqueda */}
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Buscar por ubicación, municipio, zona..."
                  value={q}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => q.trim() && setMostrarSugerencias(true)}
                  onBlur={() => setTimeout(() => setMostrarSugerencias(false), 200)}
                  className="w-full px-6 py-4 text-[#4d4d4d] outline-none text-base"
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
                className="flex-shrink-0 h-16 w-16 flex items-center justify-center bg-[#11518b] text-white hover:bg-[#0d3a63] transition text-xl"
                title="Buscar"
              >
                🔍
              </button>
            </div>

            {/* Filtros avanzados expandibles */}
            {mostrarFiltros && (
              <div className="mt-4 rounded-2xl bg-white/95 backdrop-blur-sm p-6 shadow-xl">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {/* Venta/Renta */}
                  <div>
                    <label className="block text-sm font-semibold text-[#4d4d4d] mb-2">
                      Tipo
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setTipoNegocio(tipoNegocio === "venta" ? "" : "venta")}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                          tipoNegocio === "venta"
                            ? "bg-[#11518b] text-white"
                            : "border border-[#d9d9d9] text-[#4d4d4d] hover:border-[#11518b]"
                        }`}
                      >
                        Venta
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipoNegocio(tipoNegocio === "renta" ? "" : "renta")}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                          tipoNegocio === "renta"
                            ? "bg-[#11518b] text-white"
                            : "border border-[#d9d9d9] text-[#4d4d4d] hover:border-[#11518b]"
                        }`}
                      >
                        Renta
                      </button>
                    </div>
                  </div>

                  {/* Precio Min */}
                  <div>
                    <label className="block text-sm font-semibold text-[#4d4d4d] mb-2">
                      Precio mínimo
                    </label>
                    <input
                      type="number"
                      placeholder="Min $"
                      value={precioMin}
                      onChange={(e) => setPrecioMin(e.target.value)}
                      className="w-full rounded-lg border border-[#d9d9d9] px-4 py-2.5 text-sm text-[#4d4d4d] outline-none focus:border-[#11518b]"
                    />
                  </div>

                  {/* Precio Max */}
                  <div>
                    <label className="block text-sm font-semibold text-[#4d4d4d] mb-2">
                      Precio máximo
                    </label>
                    <input
                      type="number"
                      placeholder="Max $"
                      value={precioMax}
                      onChange={(e) => setPrecioMax(e.target.value)}
                      className="w-full rounded-lg border border-[#d9d9d9] px-4 py-2.5 text-sm text-[#4d4d4d] outline-none focus:border-[#11518b]"
                    />
                  </div>

                  {/* Habitaciones */}
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-semibold text-[#4d4d4d] mb-3">
                      Habitaciones
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {["All", "1+", "2+", "3+", "4+", "5+"].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setHabitaciones(opt === "All" ? "" : opt)}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                            (opt === "All" && !habitaciones) ||
                            habitaciones === opt
                              ? "bg-[#11518b] text-white"
                              : "border border-[#d9d9d9] text-[#4d4d4d] hover:border-[#11518b]"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Baños */}
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-semibold text-[#4d4d4d] mb-3">
                      Baños
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {["All", "1+", "2+", "3+", "4+", "5+"].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setBanos(opt === "All" ? "" : opt)}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                            (opt === "All" && !banos) || banos === opt
                              ? "bg-[#11518b] text-white"
                              : "border border-[#d9d9d9] text-[#4d4d4d] hover:border-[#11518b]"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tipo de propiedad */}
                  <div className="lg:col-span-3">
                    <label className="block text-sm font-semibold text-[#4d4d4d] mb-3">
                      Tipo de propiedad
                    </label>
<div className="flex flex-wrap gap-4">
                      {["Casa", "Apartamento", "Condominio", "Terreno", "Comercial"].map(
                        (tipo) => (
                          <label
                            key={tipo}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={tipoPropiedad === tipo}
                              onChange={(e) =>
                                setTipoPropiedad(e.target.checked ? tipo : "")
                              }
                              className="sr-only"
                            />
                            <div className={`w-12 h-6 rounded-full transition ${
                              tipoPropiedad === tipo
                                ? "bg-[#11518b]"
                                : "bg-[#e8e8e8]"
                            }`}>
                              <div className={`w-5 h-5 rounded-full bg-white transition transform ${
                                tipoPropiedad === tipo
                                  ? "translate-x-6"
                                  : "translate-x-0.5"
                              } mt-0.5`} />
                            </div>
                            <span className="text-sm text-[#4d4d4d]">{tipo}</span>
                          </label>
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-[#11518b] text-white font-semibold py-3 hover:bg-[#0d3a63] transition"
                  >
                    Buscar con filtros
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarFiltros(false);
                      setTipoNegocio("");
                      setPrecioMin("");
                      setPrecioMax("");
                      setHabitaciones("");
                      setBanos("");
                      setTipoPropiedad("");
                    }}
                    className="rounded-lg border border-[#d9d9d9] text-[#4d4d4d] font-semibold py-3 px-6 hover:bg-[#f7f7f7] transition"
                  >
                    Limpiar
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

          {/* Info cards */}
          <div className="mt-12 grid max-w-3xl gap-4 md:grid-cols-3 mx-auto">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-md">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                Enfoque
              </p>
              <p className="mt-2 text-sm text-white/90">
                Atención estratégica y personalizada
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-md">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                Mercado
              </p>
              <p className="mt-2 text-sm text-white/90">
                Propiedades en venta y renta en Puerto Rico
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-md">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                Experiencia
              </p>
              <p className="mt-2 text-sm text-white/90">
                Acompañamiento claro en cada etapa
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
