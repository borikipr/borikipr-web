import Header from "@/components/Header";
import Link from "next/link";
import HomeHeroClient from "@/components/HomeHeroClient";
import { getPropiedades } from "@/lib/queries/propiedades";

export default async function Home() {
  const rows = (await getPropiedades()) as unknown as { id: string }[];
  const totalPropiedades = rows.length;

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
                  Muy pronto estaremos presentando nuevas oportunidades.
                </h2>

                <p className="body-lg mt-6 max-w-2xl">
                  Esta sección mostrará una selección curada de propiedades en
                  venta y renta en Puerto Rico, con fotografía cuidada,
                  información clara y una experiencia visual a la altura de cada
                  oportunidad.
                </p>
              </div>

              <div>
                <Link href="/listados" className="btn-secondary">
                  Ver todos los listados
                </Link>
              </div>
            </div>

            <div className="mt-14">
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