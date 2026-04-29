import Header from "@/components/Header";
import Image from "next/image";
import Link from "next/link";

export default function About() {
  return (
    <>
      <Header />

      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-20">
          <div className="grid gap-14 xl:grid-cols-[0.95fr_1.05fr] xl:items-center">
            <div className="flex justify-center">
              <div className="w-full max-w-md">
                <Image
                  src="/ivonne.png"
                  alt="Ivonne Erickson - Corredora de Bienes Raíces en Puerto Rico"
                  width={700}
                  height={900}
                  priority
                  className="h-auto w-full object-contain"
                />
              </div>
            </div>

            <div>
              <p className="eyebrow">Sobre mí</p>

              <h1 className="heading-display mt-4 max-w-3xl">
                Experiencia, estrategia y presencia en cada decisión.
              </h1>

              <p className="body-lg mt-8 max-w-2xl">
                Soy Ivonne Erickson, corredora de bienes raíces en Puerto Rico,
                dedicada a guiarte con claridad, estrategia y una atención
                personalizada que inspira confianza en cada etapa del proceso.
              </p>

              <p className="body-lg mt-6 max-w-2xl">
                Comprar, vender o invertir en una propiedad no es solo una
                transacción, sino una decisión importante que requiere
                conocimiento del mercado, dirección precisa y asesoría
                profesional sólida.
              </p>

              <p className="body-lg mt-6 max-w-2xl">
                Mi compromiso es acompañarte de principio a fin, brindándote
                una experiencia fluida, transparente y enfocada en alcanzar
                tus objetivos.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link href="/contact" className="btn-primary">
                  Agendar una consulta
                </Link>

                <Link
                  href="https://wa.me/17876774900"
                  target="_blank"
                  className="btn-secondary"
                >
                  Escribir por WhatsApp
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#f8f8f8] py-24">
          <div className="section-shell">
            <div className="max-w-3xl">
              <p className="eyebrow">Filosofía de servicio</p>

              <h2 className="heading-section mt-4">
                Cada propiedad merece una estrategia bien pensada.
              </h2>

              <p className="body-lg mt-6">
                Mi prioridad es crear una experiencia inmobiliaria clara,
                organizada y profesional, donde cada cliente se sienta bien
                orientado y respaldado en cada decisión.
              </p>
            </div>

            <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <article className="surface-card card-hover p-8">
                <div className="mb-5 h-1.5 w-14 rounded-full bg-[#d4af37]" />
                <h3 className="text-2xl font-semibold text-[#11518b]">
                  Claridad
                </h3>
                <p className="body-base mt-4">
                  Información directa, orientación transparente y pasos bien
                  explicados para que el proceso se sienta más seguro.
                </p>
              </article>

              <article className="surface-card card-hover p-8">
                <div className="mb-5 h-1.5 w-14 rounded-full bg-[#d4af37]" />
                <h3 className="text-2xl font-semibold text-[#11518b]">
                  Estrategia
                </h3>
                <p className="body-base mt-4">
                  Cada propiedad y cada cliente requieren una dirección distinta,
                  con enfoque en objetivos reales y decisiones inteligentes.
                </p>
              </article>

              <article className="surface-card card-hover p-8 md:col-span-2 xl:col-span-1">
                <div className="mb-5 h-1.5 w-14 rounded-full bg-[#d4af37]" />
                <h3 className="text-2xl font-semibold text-[#11518b]">
                  Confianza
                </h3>
                <p className="body-base mt-4">
                  Más que una transacción, busco construir relaciones sólidas con
                  una presencia profesional consistente y un acompañamiento bien
                  guiado.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="bg-white py-24">
          <div className="section-shell grid gap-12 xl:grid-cols-[1fr_1fr]">
            <div className="surface-muted card-hover p-8 md:p-10">
              <p className="eyebrow">Presencia profesional</p>

              <h2 className="mt-4 text-3xl font-bold leading-tight text-[#000000] md:text-4xl">
                Una experiencia bien presentada genera más confianza.
              </h2>

              <p className="body-base mt-6">
                La forma en que se presenta una propiedad, se atiende una
                consulta o se acompaña una decisión cambia por completo la
                experiencia del cliente. Mi enfoque combina servicio,
                estrategia y una imagen profesional coherente.
              </p>
            </div>

            <div className="surface-card card-hover p-8 md:p-10">
              <p className="eyebrow">Credenciales</p>

              <div className="mt-6 space-y-5 text-[#4d4d4d]">
                <div className="border-b border-[#efefef] pb-5">
                  <p className="font-semibold text-[#000000]">
                    Corredora de Bienes Raíces
                  </p>
                  <p className="mt-1">Puerto Rico</p>
                </div>

                <div className="border-b border-[#efefef] pb-5">
                  <p className="font-semibold text-[#000000]">Licencia</p>
                  <p className="mt-1">C-25961</p>
                </div>

                <div>
                  <p className="font-semibold text-[#000000]">Atención</p>
                  <p className="mt-1">
                    Orientación clara para compra, venta e inversión.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#11518b] py-24">
          <div className="section-shell">
            <div className="rounded-[2rem] border border-white/10 bg-white/10 p-10 text-white shadow-xl backdrop-blur-sm md:p-14">
              <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
                <div className="max-w-3xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#d4af37]">
                    Siguiente paso
                  </p>

                  <h2 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">
                    Una conversación clara puede cambiar toda la experiencia.
                  </h2>

                  <p className="mt-6 text-lg leading-relaxed text-white/85">
                    Si estás considerando comprar, vender o invertir en Puerto
                    Rico, estaré encantada de orientarte con una estrategia más
                    clara y una experiencia profesional.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Link href="/contact" className="btn-gold">
                    Contactar ahora
                  </Link>

                  <Link
                    href="/listados"
                    className="inline-flex items-center justify-center rounded-full border border-white/30 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Ver listados
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
