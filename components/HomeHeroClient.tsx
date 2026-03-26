"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { municipiosPR } from "@/data/municipios";

export default function HomeHeroClient({
  totalPropiedades,
}: {
  totalPropiedades: number;
}) {
  const router = useRouter();

  const [municipio, setMunicipio] = useState("");
  const [tipoNegocio, setTipoNegocio] = useState("");
  const [tipoPropiedad, setTipoPropiedad] = useState("");

  const handleBuscar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const params = new URLSearchParams();

    if (municipio) params.set("municipio", municipio);
    if (tipoNegocio) params.set("tipoNegocio", tipoNegocio);
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

      <div className="section-shell relative z-10 flex min-h-screen items-center pt-32 pb-16 lg:pt-40">
        <div className="max-w-4xl">
          <p className="eyebrow mb-5">Puerto Rico Real Estate</p>

          <h1 className="max-w-4xl text-4xl font-bold leading-[0.95] text-white sm:text-5xl md:text-7xl xl:text-[5.5rem]">
            Propiedades con visión, estrategia y presencia.
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/90 md:text-xl">
            Compra, vende o invierte en Puerto Rico con una asesoría clara,
            una imagen profesional y una experiencia diseñada para inspirar
            confianza desde el primer paso.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/listados" className="btn-primary">
              Explorar {totalPropiedades}{" "}
              {totalPropiedades === 1 ? "propiedad" : "propiedades"}
            </Link>

            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              Agendar consulta
            </Link>
          </div>

          <div className="mt-12 grid max-w-3xl gap-4 md:grid-cols-3">
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

          <form
            onSubmit={handleBuscar}
            className="shadow-luxury mt-12 max-w-4xl rounded-[2rem] border border-white/15 bg-white/10 p-4 backdrop-blur-xl"
          >
            <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr_1fr_auto]">
              <select
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                className="rounded-2xl border border-white/15 bg-white px-5 py-4 text-sm text-[#4d4d4d] outline-none"
              >
                <option value="">Municipio</option>
                {municipiosPR.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={tipoNegocio}
                onChange={(e) => setTipoNegocio(e.target.value)}
                className="rounded-2xl border border-white/15 bg-white px-5 py-4 text-sm text-[#4d4d4d] outline-none"
              >
                <option value="">Venta o renta</option>
                <option value="venta">Venta</option>
                <option value="renta">Renta</option>
              </select>

              <select
                value={tipoPropiedad}
                onChange={(e) => setTipoPropiedad(e.target.value)}
                className="rounded-2xl border border-white/15 bg-white px-5 py-4 text-sm text-[#4d4d4d] outline-none"
              >
                <option value="">Tipo de propiedad</option>
                <option value="Casa">Casa</option>
                <option value="Apartamento">Apartamento</option>
                <option value="Condominio">Condominio</option>
                <option value="Terreno">Terreno</option>
              </select>

              <button
                type="submit"
                className="btn-gold rounded-2xl px-6 py-4"
              >
                Buscar
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
              <p className="text-sm text-white/80">
                Filtra por municipio, tipo de negocio y tipo de propiedad.
              </p>

              <p className="text-sm font-medium text-white/90">
                {totalPropiedades}{" "}
                {totalPropiedades === 1 ? "listado disponible" : "listados disponibles"}
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}