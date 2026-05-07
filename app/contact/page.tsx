import Header from "@/components/Header";
import Link from "next/link";

function ContactOptionCard({
  eyebrow,
  title,
  description,
  href,
  label,
  variant = "primary",
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <article className="surface-card card-hover p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#d4af37]">
        {eyebrow}
      </p>

      <h2 className="mt-4 text-2xl font-semibold text-[#11518b]">
        {title}
      </h2>

      <p className="body-base mt-4">
        {description}
      </p>

      <div className="mt-8">
        <Link
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          className={variant === "primary" ? "btn-primary" : "btn-secondary"}
        >
          {label}
        </Link>
      </div>
    </article>
  );
}

export default function ContactPage() {
  return (
    <>
      <Header />

      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-20">
          <div className="max-w-4xl">
            <p className="eyebrow">Contacto</p>

            <h1 className="heading-display mt-4">
              ¿Cómo puedo orientarte?
            </h1>

            <p className="body-lg mt-8 max-w-3xl">
              Elige la opción que mejor se ajuste a lo que necesitas. Así puedo orientarte con más claridad, estrategia y una experiencia alineada a tus objetivos en Puerto Rico.
            </p>
          </div>
        </section>

        <section className="section-shell pb-24">
          <div className="grid gap-6 xl:grid-cols-3">
            <ContactOptionCard
              eyebrow="Compradores"
              title="Quiero comprar"
              description="Cuéntame qué estás buscando y te ayudaré a identificar propiedades alineadas con tu estilo de vida, presupuesto y objetivos."
              href="/contact/comprador"
              label="Solicitar orientación para comprar"
              variant="primary"
            />

            <ContactOptionCard
              eyebrow="Vendedores"
              title="Quiero vender"
              description="Comparte la información de tu propiedad y te orientaré sobre presentación, estrategia y posicionamiento para salir al mercado con mejor dirección."
              href="/contact/vendedor"
              label="Solicitar orientación para vender"
              variant="primary"
            />

            <ContactOptionCard
              eyebrow="Consulta general"
              title="Necesito orientación general"
              description="Si tienes dudas, necesitas orientación adicional o prefieres una conversación más directa, también puedes escribir por WhatsApp."
              href="https://wa.me/17876774900"
              label="Escribir por WhatsApp"
              variant="secondary"
            />
          </div>
        </section>

        <section className="bg-[#f8f8f8] py-24">
          <div className="section-shell">
            <div className="overflow-hidden rounded-[2rem] border border-[#e8e8e8] bg-white shadow-sm">
              <div className="grid gap-0 lg:grid-cols-[1fr_1fr]">
                <div className="p-10 md:p-12 lg:pb-16">
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#d4af37]">
                    Atención personalizada
                  </p>

                  <h2 className="mt-4 text-3xl font-bold leading-tight text-[#000000]">
                    Una buena orientación puede ahorrarte tiempo y darte más claridad
                  </h2>

                  <p className="body-base mt-6">
                    Ya sea que estés evaluando comprar, vender o simplemente
                    necesites orientación, el objetivo es ayudarte a avanzar con
                    estrategia, información clara y una experiencia profesional.
                  </p>
                </div>

                <div className="bg-[#11518b] p-10 text-white md:p-12">
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#d4af37]">
                    Contacto rápido
                  </p>

                  <h3 className="mt-4 text-3xl font-bold leading-tight">
                    ¿Prefieres una respuesta más directa?
                  </h3>

                  <p className="mt-6 text-white/90">
                    Si ya tienes una duda puntual o quieres una respuesta más
                    directa, también puedes comunicarte por WhatsApp.
                  </p>

                  <div className="mt-8">
                    <Link
                      href="https://wa.me/17876774900"
                      target="_blank"
                      className="btn-gold"
                    >
                      Abrir WhatsApp
                    </Link>
                  </div>

                  <div className="mt-10 border-t border-white/20 pt-8 text-sm text-white/85">
                    <p className="font-semibold text-white">
                      Erickson Real Estate
                    </p>
                    <p className="mt-2 leading-relaxed">
                      Orientación para compradores, vendedores e interesados en
                      oportunidades inmobiliarias en Puerto Rico.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
