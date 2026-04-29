import Header from "@/components/Header";
import Image from "next/image";
import Link from "next/link";
import HomeHeroClient from "@/components/HomeHeroClient";
import {
  getPropiedades,
  getPropiedadesDestacadas,
} from "@/lib/queries/propiedades";
import { getTestimoniosPublicos } from "@/lib/queries/testimonios";

type TipoNegocio = "venta" | "renta";
type EstadoPropiedad =
  | "disponible"
  | "bajo_contrato"
  | "vendida"
  | "rentada";

function formatoPrecio(precio: number, tipo: TipoNegocio) {
  return tipo === "renta"
    ? `$${precio.toLocaleString("en-US")}/mes`
    : `$${precio.toLocaleString("en-US")}`;
}

function estadoLabel(estado: EstadoPropiedad) {
  switch (estado) {
    case "disponible":
      return "Disponible";
    case "bajo_contrato":
      return "Bajo contrato";
    case "vendida":
      return "Vendida";
    case "rentada":
      return "Rentada";
    default:
      return estado;
  }
}

function estadoClasses(estado: EstadoPropiedad) {
  switch (estado) {
    case "disponible":
      return "bg-[#11518b] text-white";
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
    descripcion: "San Juan, Guaynabo, Carolina, Bayamón",
    icon: "🏙️",
  },
  {
    nombre: "Norte",
    descripcion: "Dorado, Arecibo, Manatí, Vega Baja",
    icon: "🌊",
  },
  {
    nombre: "Sur",
    descripcion: "Ponce, Guayama, Salinas, Coamo",
    icon: "☀️",
  },
  {
    nombre: "Este",
    descripcion: "Fajardo, Río Grande, Luquillo, Vieques",
    icon: "🌴",
  },
  {
    nombre: "Oeste",
    descripcion: "Mayagüez, Cabo Rojo, Rincón, Isabela",
    icon: "🌅",
  },
  {
    nombre: "Central",
    descripcion: "Cayey, Aibonito, Barranquitas, Orocovis",
    icon: "⛰️",
  },
];

export default async function Home() {
  const rows = (await getPropiedades()) as unknown as { id: string }[];
  const totalPropiedades = rows.length;

  const destacadas = await getPropiedadesDestacadas(3);
  const allTestimonios = await getTestimoniosPublicos();
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

              <h2 className="heading-section mt-4">
                Compromiso, estrategia y presencia en cada transacción.
              </h2>

              <p className="body-lg mt-6">
                Más que una agente, una aliada que entiende el mercado, cuida
                cada detalle y te guía con transparencia de principio a fin.
              </p>
            </div>

            <div className="mt-14 grid gap-8 md:grid-cols-4">
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#11518b]/10">
                  <span className="text-2xl font-bold text-[#11518b]">✓</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#000000]">
                  Atención personalizada
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
                  Cada cliente recibe un trato único, adaptado a sus necesidades
                  y objetivos específicos.
                </p>
              </div>

              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#11518b]/10">
                  <span className="text-2xl font-bold text-[#11518b]">📊</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#000000]">
                  Estrategia de mercado
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
                  Análisis profundo del mercado para posicionar tu propiedad
                  con el mejor precio y visibilidad.
                </p>
              </div>

              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#11518b]/10">
                  <span className="text-2xl font-bold text-[#11518b]">📸</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#000000]">
                  Presentación premium
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
                  Fotografía profesional, descripciones cuidadas y marketing
                  visual que destaca cada propiedad.
                </p>
              </div>

              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#11518b]/10">
                  <span className="text-2xl font-bold text-[#11518b]">🤝</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#000000]">
                  Acompañamiento completo
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
                  Desde la primera consulta hasta el cierre, siempre con
                  comunicación clara y transparente.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Sección: Propiedades destacadas */}
        <section className="bg-[#f8f8f8] py-24">
          <div className="section-shell">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-3xl">
                <p className="eyebrow">Propiedades destacadas</p>

                <h2 className="heading-section mt-4">
                  Oportunidades seleccionadas con mejor presentación.
                </h2>

                <p className="body-lg mt-6 max-w-2xl">
                  Explora una selección destacada de propiedades en venta y renta
                  en Puerto Rico, con fotografía cuidada, información clara y una
                  experiencia visual más premium.
                </p>
              </div>

              <div>
                <Link href="/listados" className="btn-secondary">
                  Ver todos los listados
                </Link>
              </div>
            </div>

            <div className="mt-14">
              {destacadas.length === 0 ? (
                <div className="rounded-2xl border border-[#e8e8e8] bg-white p-10 text-center shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                    Próximamente
                  </p>
                  <h3 className="mt-4 text-2xl font-bold text-[#000000]">
                    Nuevas propiedades premium en camino
                  </h3>
                  <p className="mt-4 max-w-lg mx-auto text-[#4d4d4d] leading-relaxed">
                    Pronto podrás explorar oportunidades reales con mejor
                    presentación, detalles claros y acceso rápido a cada listing.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-4 justify-center">
                    <Link href="/listados" className="btn-primary">
                      Explorar listados
                    </Link>
                    <Link href="/contact" className="btn-secondary">
                      Solicitar orientación
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid gap-8 md:grid-cols-2 2xl:grid-cols-3">
                  {destacadas.map((item) => {
                    const imagenPrincipal =
                      Array.isArray(item.imagenes) && item.imagenes.length > 0
                        ? item.imagenes[0]
                        : "/placeholder.jpg";

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
                              {item.tipo_negocio === "venta" ? "Venta" : "Renta"}
                            </span>

                            <span className="text-sm text-[#4d4d4d]">
                              {item.municipio}
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

        {/* Sección: Servicios */}
        <section className="bg-white py-24">
          <div className="section-shell">
            <div className="max-w-3xl">
              <p className="eyebrow">Servicios</p>

              <h2 className="heading-section mt-4">
                Una experiencia inmobiliaria más clara y mejor presentada.
              </h2>

              <p className="body-lg mt-6">
                Desde la primera llamada hasta la negociación y el cierre, cada
                paso debe sentirse organizado, estratégico y bien acompañado.
              </p>
            </div>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              <article className="surface-card card-hover p-8">
                <div className="mb-5 h-1.5 w-14 rounded-full bg-[#d4af37]" />
                <h3 className="text-2xl font-semibold text-[#11518b]">
                  Compra
                </h3>
                <p className="body-base mt-4">
                  Evaluación clara de opciones, orientación local y apoyo
                  estratégico para elegir con confianza.
                </p>
              </article>

              <article className="surface-card card-hover p-8">
                <div className="mb-5 h-1.5 w-14 rounded-full bg-[#d4af37]" />
                <h3 className="text-2xl font-semibold text-[#11518b]">
                  Venta
                </h3>
                <p className="body-base mt-4">
                  Estrategia de presentación, visibilidad y manejo profesional
                  del proceso para maximizar valor.
                </p>
              </article>

              <article className="surface-card card-hover p-8">
                <div className="mb-5 h-1.5 w-14 rounded-full bg-[#d4af37]" />
                <h3 className="text-2xl font-semibold text-[#11518b]">
                  Consultoría
                </h3>
                <p className="body-base mt-4">
                  Conversaciones estratégicas para compradores, vendedores e
                  inversionistas que quieren claridad antes de decidir.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* Sección: Zonas de Puerto Rico */}
        <section className="bg-[#f8f8f8] py-24">
          <div className="section-shell">
            <div className="text-center max-w-3xl mx-auto">
              <p className="eyebrow">Zonas</p>

              <h2 className="heading-section mt-4">
                Cubrimos toda la isla de Puerto Rico.
              </h2>

              <p className="body-lg mt-6">
                Desde la zona metropolitana hasta las costas y montañas,
                te ayudamos a encontrar la propiedad ideal en cualquier región.
              </p>
            </div>

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {zonasHome.map((zona) => (
                <Link
                  key={zona.nombre}
                  href={`/listados?q=${encodeURIComponent(zona.nombre)}`}
                  className="group rounded-2xl border border-[#e8e8e8] bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-[#11518b]/30"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{zona.icon}</span>
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

                  <h2 className="heading-section mt-4">
                    Lo que dicen nuestros clientes.
                  </h2>

                  <p className="body-lg mt-6 max-w-2xl">
                    Experiencias reales de personas que confiaron en nosotros
                    para comprar, vender o invertir en Puerto Rico.
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
                      {testimonio.imagen && testimonio.imagen !== "/placeholder.jpg" ? (
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
                    Próximo paso
                  </p>

                  <h2 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">
                    Una buena decisión empieza con una buena conversación.
                  </h2>

                  <p className="mt-6 text-lg leading-relaxed text-white/85">
                    Cuéntanos qué estás buscando y te ayudamos a construir el
                    camino correcto con una presencia profesional y un enfoque
                    estratégico.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Link href="/contact" className="btn-gold">
                    Contactar ahora
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
