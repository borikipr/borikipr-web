import Header from "@/components/Header";
import Image from "next/image";
import Link from "next/link";
import HomeHeroClient from "@/components/HomeHeroClient";
import {
  getPropiedades,
  getPropiedadesDestacadas,
} from "@/lib/queries/propiedades";

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

export default async function Home() {
  const rows = (await getPropiedades()) as unknown as { id: string }[];
  const totalPropiedades = rows.length;

  const destacadas = await getPropiedadesDestacadas(3);

  return (
    <>
      <Header transparent />

      <main className="bg-white">
        <HomeHeroClient totalPropiedades={totalPropiedades} />

        <section className="bg-white py-24">
          <div className="section-shell grid gap-14 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="eyebrow">Erickson Real Estate</p>

              <h2 className="heading-section mt-4 max-w-3xl">
                Una presencia profesional para decisiones importantes.
              </h2>

              <p className="body-lg mt-6 max-w-2xl">
                Cada propiedad tiene una historia, una estrategia y un momento.
                La experiencia correcta combina mercado, presentación y guía
                precisa para ayudarte a avanzar con seguridad.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="surface-muted card-hover p-7">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                  Comprar
                </p>
                <p className="body-base mt-4">
                  Encuentra una propiedad alineada con tu visión, estilo de vida
                  y objetivos.
                </p>
              </div>

              <div className="surface-muted card-hover p-7">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                  Vender
                </p>
                <p className="body-base mt-4">
                  Presentación, estrategia y posicionamiento para destacar tu
                  propiedad en el mercado.
                </p>
              </div>

              <div className="surface-muted card-hover p-7 sm:col-span-2">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                  Invertir
                </p>
                <p className="body-base mt-4 max-w-xl">
                  Identifica oportunidades con potencial real en uno de los
                  mercados más atractivos del Caribe.
                </p>
              </div>
            </div>
          </div>
        </section>

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
                <div className="overflow-hidden rounded-[2rem] border border-[#e8e8e8] bg-white shadow-sm">
                  <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="relative min-h-[320px] bg-[#f1f1f1]">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#e2e2e2] via-[#f2f2f2] to-white" />

                      <div className="absolute left-6 top-6">
                        <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#11518b] shadow-sm">
                          Próximamente
                        </span>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 p-6">
                        <div className="max-w-md rounded-2xl border border-white/50 bg-white/70 p-5 backdrop-blur-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
                            Selección destacada
                          </p>
                          <p className="mt-3 text-lg font-semibold text-[#000000]">
                            Nuevas propiedades premium en camino
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-[#4d4d4d]">
                            Pronto podrás explorar oportunidades reales con mejor
                            presentación, detalles claros y acceso rápido a cada
                            listing.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-8 md:p-10">
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                        Qué verás aquí
                      </p>

                      <h3 className="mt-4 text-3xl font-bold leading-tight text-[#000000]">
                        Una vitrina más cuidada, clara y profesional.
                      </h3>

                      <p className="body-base mt-6">
                        Cuando entren listados reales, esta sección presentará
                        propiedades seleccionadas por su atractivo visual,
                        ubicación, potencial y calidad de presentación.
                      </p>

                      <div className="mt-8 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl bg-[#f8f8f8] p-5">
                          <p className="text-sm font-semibold text-[#000000]">
                            Venta y renta
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-[#4d4d4d]">
                            Oportunidades reales y actualizadas.
                          </p>
                        </div>

                        <div className="rounded-2xl bg-[#f8f8f8] p-5">
                          <p className="text-sm font-semibold text-[#000000]">
                            Presentación premium
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-[#4d4d4d]">
                            Fotografías y detalles bien organizados.
                          </p>
                        </div>
                      </div>

                      <div className="mt-8 flex flex-wrap gap-4">
                        <Link href="/listados" className="btn-primary">
                          Explorar listados
                        </Link>

                        <Link href="/contact" className="btn-secondary">
                          Solicitar orientación
                        </Link>
                      </div>
                    </div>
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

                          <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#4d4d4d]">
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

        <section className="bg-[#f8f8f8] py-24">
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