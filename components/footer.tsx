import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-[#0d1b2a] text-white">
      <div className="section-shell py-16">
        <div className="grid gap-12 md:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr_0.8fr_1fr]">
          <div>
            <Link href="/" className="inline-flex">
              <Image
                src="/logo-erickson.png"
                alt="Erickson Real Estate"
                width={170}
                height={58}
                className="h-auto w-[150px] sm:w-[170px]"
              />
            </Link>

            <p className="mt-6 max-w-sm text-sm leading-relaxed text-white/75">
              Una presencia profesional para comprar, vender o invertir en
              Puerto Rico con estrategia, claridad y confianza.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="https://www.facebook.com/ericksonrealestatepr"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm text-white/85 transition hover:-translate-y-0.5 hover:border-[#d4af37] hover:text-[#d4af37]"
                aria-label="Facebook"
              >
                f
              </Link>

              <Link
                href="https://www.instagram.com/ivonnerealestatepr/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm text-white/85 transition hover:-translate-y-0.5 hover:border-[#d4af37] hover:text-[#d4af37]"
                aria-label="Instagram"
              >
                ig
              </Link>

              <Link
                href="https://wa.me/17876774900"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm text-white/85 transition hover:-translate-y-0.5 hover:border-[#d4af37] hover:text-[#d4af37]"
                aria-label="WhatsApp"
              >
                wa
              </Link>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#d4af37]">
              Navegación
            </p>

            <nav className="mt-6 flex flex-col gap-4 text-sm text-white/75">
              <Link href="/" className="transition hover:text-white">
                Inicio
              </Link>
              <Link href="/about" className="transition hover:text-white">
                Sobre mí
              </Link>
              <Link href="/contact" className="transition hover:text-white">
                Contacto
              </Link>
            </nav>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#d4af37]">
              Servicios
            </p>

            <div className="mt-6 flex flex-col gap-4 text-sm text-white/75">
              <p>Compra de propiedades</p>
              <p>Venta de propiedades</p>
              <p>Consultoría inmobiliaria</p>
              <p>Orientación estratégica</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#d4af37]">
              Contacto
            </p>

            <div className="mt-6 space-y-4 text-sm text-white/75">
              <div>
                <p className="font-medium text-white">Email</p>
                <p className="mt-1">ivonneerickson@borikipr.com</p>
              </div>

              <div>
                <p className="font-medium text-white">WhatsApp</p>
                <p className="mt-1">(787) 677-4900</p>
              </div>

              <div>
                <p className="font-medium text-white">Ubicación</p>
                <p className="mt-1">Puerto Rico</p>
              </div>

              <div>
                <p className="font-medium text-white">Licencia</p>
                <p className="mt-1">C-25961</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 border-t border-white/10 pt-6">
          <div className="flex flex-col gap-4 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
            <p>
              Ivonne Erickson · Corredora de Bienes Raíces · Licencia C-25961
            </p>
            <p>© 2026 Erickson Real Estate. Todos los derechos reservados.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}