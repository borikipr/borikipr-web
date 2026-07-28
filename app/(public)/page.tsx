import type { Metadata } from "next";
import Header from "@/components/Header";
import Image from "next/image";
import Link from "next/link";
import HomeHeroClient from "@/components/HomeHeroClient";
import {
  Building2,
  Camera,
  HeartHandshake,
  Mountain,
  Sun,
  Sunset,
  Trees,
  TrendingUp,
  UserCheck,
  Waves,
} from "lucide-react";
import { getRegionByName } from "@/data/zonas";
import {
  getPropiedades,
  getPropiedadesDestacadas,
  type PropiedadHomeDestacada,
} from "@/lib/queries/propiedades";
import { getTestimoniosPublicos, type TestimonioPublico } from "@/lib/queries/testimonios";
import { formatPropertyLocation } from "@/lib/puerto-rico-sectores";
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo";

const pageTitle = "Bienes Raíces en Puerto Rico";
const pageDescription =
  "Compra, vende o invierte en Puerto Rico con orientación clara, estrategia y acompañamiento profesional.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${SITE_NAME} | ${pageTitle}`,
    description: pageDescription,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | ${pageTitle}`,
    description: pageDescription,
    images: [DEFAULT_OG_IMAGE],
  },
};

type TipoNegocio = "venta" | "renta";
type EstadoPropiedad =
  | "disponible"
  | "coming_soon"
  | "bajo_contrato"
  | "vendida"
  | "rentada";

function formatoPrecio(precio: number, tipo: TipoNegocio) {
  if (!Number.isFinite(precio) || precio <= 0) {
    return "Precio próximamente";
  }

  return tipo === "renta"
    ? `$${precio.toLocaleString("en-US")}/mes`
    : `$${precio.toLocaleString("en-US")}`;
}

function estadoLabel(estado: EstadoPropiedad) {
  switch (estado) {
    case "disponible":
      return "Disponible";
    case "coming_soon":
      return "Próximamente";
    case "bajo_contrato":
      return "Bajo contrato";
    case "vendida":
      return "Vendida";
    case "rentada":
      return "Alquilada";
    default:
      return estado;
  }
}

function estadoClasses(estado: EstadoPropiedad) {
  switch (estado) {
    case "disponible":
      return "bg-[#11518b] text-white";
    case "coming_soon":
      return "bg-[#d4af37] text-black";
    case "bajo_contrato":
      return "bg-[#d4af37] text-black";
    case "vendida":
    case "rentada":
      return "bg-[#4d4d4d] text-white";
    default:
      return "bg-[#cccccc] text-black";
  }
}

const zonasHome = [
  {
    nombre: "Metropolitana",
    descripcion: "San Juan, Guaynabo, Carolina, Bayamón y más.",
    Icon: Building2,
  },
  {
    nombre: "Norte",
    descripcion: "Dorado, Arecibo, Manatí, Vega Baja y más.",
    Icon: Waves,
  },
  {
    nombre: "Sur",
    descripcion: "Ponce, Guayama, Salinas, Coamo y más.",
    Icon: Sun,
  },
  {
    nombre: "Este",
    descripcion: "Fajardo, Río Grande, Luquillo, Vieques y más.",
    Icon: Trees,
  },
  {
    nombre: "Oeste",
    descripcion: "Mayagüez, Cabo Rojo, Rincón, Isabela y más.",
    Icon: Sunset,
  },
  {
    nombre: "Central",
    descripcion: "Cayey, Aibonito, Barranquitas, Orocovis y más.",
    Icon: Mountain,
  },
];

export default async function Home() {
  let rows: { id: string }[] = [];
  let destacadas: PropiedadHomeDestacada[] = [];
  let allTestimonios: TestimonioPublico[] = [];

  try {
    rows = (await getPropiedades()) as unknown as { id: string }[];
  } catch (error) {
    console.warn("HOME WARNING: no se pudo cargar el total de propiedades.", error);
  }

  try {
    destacadas = await getPropiedadesDestacadas(3);
  } catch (error) {
    console.warn("HOME WARNING: no se pudieron cargar propiedades destacadas.", error);
  }

  try {
    allTestimonios = await getTestimoniosPublicos();
  } catch (error) {
    console.warn("HOME WARNING: no se pudieron cargar testimonios.", error);
  }

  const totalPropiedades = rows.length;

  const testimoniosDestacados = allTestimonios
    .filter((t) => t.destacado)
    .slice(0, 3);
  const testimoniosHome =
    testimoniosDestacados.length > 0
      ? testimoniosDestacados
      : allTestimonios.slice(0, 3);

  return (
    <>
      <Header transparent />

      <main className="bg-white">
        <HomeHeroClient totalPropiedades={totalPropiedades} />

        {/* Sección: Por qué elegir a Ivonne */}
        <section className="bg-white py-24">
          <div className="section-shell">
            <div className="text-center max-w-3xl mx-auto">
              <p className="eyebrow">¿Por qué Erickson Real Estate?</p>

              <h2 className="heading-section mt-4 !text-[#11518B]">
                Estrategia clara. Ejecución precisa. Resultados con intención.
              </h2>

              <p className="body-lg mt-6">
                Más que un servicio inmobiliario, es una experiencia guiada con estrategia, transparencia y acompañamiento real para que tomes decisiones seguras en cada etapa del proceso.
              </p>
            </div>

            <div className="mt-14 grid gap-8 md:grid-cols-4">
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#11518B]">
                  <UserCheck className="h-7 w-7 text-white" strokeWidth={1.9} aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#000000]">
                  Atención personalizada
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
                  Cada cliente recibe una estrategia adaptada a sus objetivos, estilo de vida y visión a futuro.
                </p>
              </div>

              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#11518B]">
                  <TrendingUp className="h-7 w-7 text-white" strokeWidth={1.9} aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#000000]">
                  Estrategia de mercado
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
                  Conocimiento actualizado del mercado para ayudarte a tomar decisiones informadas y aprovechar las mejores oportunidades.
                </p>
              </div>

              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#11518B]">
                  <Camera className="h-7 w-7 text-white" strokeWidth={1.9} aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#000000]">
                  Presentación premium
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
                  Presentación profesional y estrategias de mercadeo diseñadas para destacar el potencial de cada propiedad.
                </p>
              </div>

              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#11518B]">
                  <HeartHandshake className="h-7 w-7 text-white" strokeWidth={1.9} aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#000000]">
                  Acompañamiento completo
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
                  Acompañamiento cercano y constante desde la primera conversación hasta el cierre del proceso.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Sección: Propiedades destacadas */}
        <section className="bg-[#f8f8f8] py-20">
          <div className="section-shell">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-3xl">
                <p className="eyebrow">Nuevos listados</p>

                <h2 className="heading-section mt-4 !text-[#11518B]">
                  Conoce los nuevos listados disponibles.
                </h2>

                <p className="body-lg mt-5 max-w-2xl">
                  Descubre propiedades recientemente incorporadas al mercado en venta y alquiler. Explora nuevas oportunidades con información clara y actualizada para ayudarte a tomar decisiones con confianza.
                </p>
              </div>

              <div>
                <Link href="/listados" className="btn-secondary">
                  Ver todos los listados
                </Link>
              </div>
            </div>

            <div className="mt-10">
              {destacadas.length === 0 ? (
                <div className="mx-auto max-w-4xl rounded-2xl border border-[#e8e8e8] bg-white p-8 text-center shadow-sm sm:p-10">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                    Próximamente
                  </p>
                  <h3 className="mt-3 text-2xl font-bold text-[#000000]">
                    Muy pronto habrá nuevos listados disponibles
                  </h3>
                  <p className="mt-3 max-w-lg mx-auto text-[#4d4d4d] leading-relaxed">
                    Esta sección se actualizará regularmente con nuevas propiedades en venta y alquiler. Vuelve pronto para descubrir las oportunidades más recientes disponibles.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-4 justify-center">
                    <Link href="/listados" className="btn-primary">
                      Ver todos los listados
                    </Link>
                    <Link href="/contact" className="btn-secondary">
                      Contactar a Ivonne
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid gap-8 md:grid-cols-2 2xl:grid-cols-3">
                  {destacadas.map((item) => {
                    const imagenPrincipal =
                      Array.isArray(item.imagenes) && item.imagenes.length > 0
                        ? item.imagenes[0]
                        : "/og-image.jpg";

                    return (
                      <article
                        key={item.id}
                        className="group overflow-hidden rounded-3xl border border-[#e8e8e8] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                      >
                        <div className="relative h-72 w-full bg-[#f5f5f5]">
                          <Image
                            src={imagenPrincipal}
                            alt={item.titulo}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1536px) 50vw, 33vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />

                          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                            <span
                              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] ${estadoClasses(
                                item.estado
                              )}`}
                            >
                              {estadoLabel(item.estado)}
                            </span>

                            {item.destacado && (
                              <span className="rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#11518b]">
                                Destacado
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-8">
                          <div className="mb-4 flex justify-between gap-4">
                            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                              {item.tipo_negocio === "venta" ? "Venta" : "Alquiler"}
                            </span>

                            <span className="text-sm text-[#4d4d4d]">
                              {formatPropertyLocation(
                                item.municipio,
                                item.sector_comunidad
                              )}
                            </span>
                          </div>

                          <h3 className="text-xl font-semibold text-[#11518b]">
                            {item.titulo}
                          </h3>

                          <p className="mt-4 text-2xl font-bold tracking-tight text-[#000000]">
                            {formatoPrecio(Number(item.precio), item.tipo_negocio)}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-3 text-sm text-[#4d4d4d]">
                            {item.habitaciones && (
                              <span>{item.habitaciones} hab</span>
                            )}
                            {item.banos && <span>{item.banos} baños</span>}
                            <span>{item.tipo_propiedad}</span>
                          </div>

                          <div className="mt-6">
                            <Link
                              href={`/listados/${item.slug}`}
                              className="inline-flex items-center justify-center rounded-full border border-[#11518b] px-5 py-2.5 text-sm font-semibold text-[#11518b] transition-all duration-300 hover:bg-[#11518b] hover:text-white"
                            >
                              Ver detalles
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Sección: Zonas de Puerto Rico */}
        <section className="bg-[#f8f8f8] py-24">
          <div className="section-shell">
            <div className="text-center max-w-3xl mx-auto">
              <p className="eyebrow">Zonas</p>

              <h2 className="heading-section mt-4 !text-[#11518B]">
                Presencia en toda la isla de Puerto Rico.
              </h2>

              <p className="body-lg mt-6">
                Desde la zona metropolitana hasta las costas y montañas, conectamos contigo oportunidades inmobiliarias en cada región de Puerto Rico.
              </p>
            </div>

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {zonasHome.map((zona) => (
                <Link
                  key={zona.nombre}
                  href={`/listados?region=${getRegionByName(zona.nombre) ?? ""}`}
                  className="group rounded-2xl border border-[#e8e8e8] bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-[#11518b]/30"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#11518B]">
                      <zona.Icon className="h-6 w-6 text-white" strokeWidth={1.9} aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-[#11518b] group-hover:text-[#0d3a63] transition">
                        {zona.nombre}
                      </h3>
                      <p className="mt-1 text-sm text-[#4d4d4d]">
                        {zona.descripcion}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Sección: Testimonios */}
        {testimoniosHome.length > 0 && (
          <section className="bg-white py-24">
            <div className="section-shell">
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div className="max-w-3xl">
                  <p className="eyebrow">Testimonios</p>

                  <h2 className="heading-section mt-4 !text-[#11518B]">
                    Experiencias reales que hablan por sí solas.
                  </h2>

                  <p className="body-lg mt-6 max-w-2xl">
                    Historias de personas que confiaron para comprar, vender o invertir en Puerto Rico.
                  </p>
                </div>

                <div>
                  <Link href="/testimonios" className="btn-secondary">
                    Ver todos los testimonios
                  </Link>
                </div>
              </div>

              <div className="mt-14 grid gap-8 md:grid-cols-3">
                {testimoniosHome.map((testimonio) => (
                  <article
                    key={testimonio.id}
                    className="rounded-2xl border border-[#e8e8e8] bg-white p-8 shadow-sm transition-all duration-300 hover:shadow-lg"
                  >
                    <div className="flex items-center gap-4 mb-6">
                      {testimonio.imagen && testimonio.imagen !== "/og-image.jpg" ? (
                        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full">
                          <Image
                            src={testimonio.imagen}
                            alt={testimonio.nombre}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#11518b]/10">
                          <span className="text-xl font-bold text-[#11518b]">
                            {testimonio.nombre.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-[#000000]">
                          {testimonio.nombre}
                        </p>
                        <p className="text-sm text-[#4d4d4d]">
                          {testimonio.lugar}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#d4af37] mb-3">
                      {testimonio.tipo === "comprador"
                        ? "Compra"
                        : "Venta"}
                    </p>

                    <p className="text-[#4d4d4d] leading-relaxed line-clamp-4">
                      &ldquo;{testimonio.texto}&rdquo;
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Sección: CTA */}
        <section className="bg-[#11518b] py-24">
          <div className="section-shell">
            <div className="rounded-[2rem] border border-white/10 bg-white/10 p-10 text-white shadow-xl backdrop-blur-sm md:p-14">
              <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
                <div className="max-w-3xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#d4af37]">
                    Comencemos
                  </p>

                  <h2 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">
                    Una buena decisión empieza con una buena conversación.
                  </h2>

                  <p className="mt-6 text-lg leading-relaxed text-white/85">
                    Ya sea que estés comprando, vendiendo o invirtiendo, estoy aquí para brindarte una atención personalizada, estrátegica y enfocada en tus objetivos, y ayudarte a tomar decisiones con confianza.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Link href="/contact" className="btn-gold">
                    Solicitar orientación
                  </Link>

                  <Link
                    href="/about"
                    className="inline-flex items-center justify-center rounded-full border border-white/30 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Conocer a Ivonne
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
