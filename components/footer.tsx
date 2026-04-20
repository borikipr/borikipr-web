import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#0d1b2a] text-white">
      <div className="section-shell py-16">
        <div className="grid gap-12 md:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr_0.8fr_1fr]">
          
          {/* BRAND */}
          <div>
            <p className="text-lg font-semibold tracking-wide text-white">
              Erickson Real Estate
            </p>

            <p className="mt-2 text-sm uppercase tracking-[0.2em] text-[#d4af37]">
              Puerto Rico
            </p>

            <p className="mt-6 max-w-sm text-sm leading-relaxed text-white/75">
              Una presencia profesional para comprar, vender o invertir en
              Puerto Rico con estrategia, claridad y confianza.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {/* Facebook */}
              <Link
                href="https://www.facebook.com/ericksonrealestatepr"
                target="_blank"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/85 transition hover:-translate-y-0.5 hover:border-[#d4af37] hover:text-[#d4af37]"
                aria-label="Facebook"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </Link>

              {/* Instagram */}
              <Link
                href="https://www.instagram.com/ivonnerealestatepr/"
                target="_blank"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/85 transition hover:-translate-y-0.5 hover:border-[#d4af37] hover:text-[#d4af37]"
                aria-label="Instagram"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.117.6c-.79.263-1.473.557-2.115 1.194-.657.646-.945 1.35-1.206 2.115-.266.788-.471 1.666-.53 2.948C.032 8.333.017 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.53 2.913.263.788.557 1.473 1.198 2.117.645.659 1.35.945 2.115 1.206.788.266 1.666.471 2.946.53C8.333 23.968 8.74 23.983 12 23.983s3.667-.015 4.947-.072c1.280-.059 2.148-.261 2.913-.53.788-.263 1.473-.557 2.117-1.198.659-.645.945-1.35 1.206-2.115.266-.788.471-1.666.53-2.946.057-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.261-2.148-.53-2.913-.263-.788-.557-1.473-1.198-2.117-.645-.659-1.35-.945-2.115-1.206-.788-.266-1.666-.471-2.946-.53C15.667.032 15.26.017 12 .017zm0 2.16c3.203 0 3.585.009 4.849.07 1.171.054 1.805.244 2.227.408.561.217.96.477 1.382.896.419.42.679.821.896 1.381.164.422.354 1.057.408 2.227.061 1.264.07 1.645.07 4.849 0 3.203-.009 3.585-.07 4.849-.054 1.171-.244 1.805-.408 2.227-.217.561-.477.96-.896 1.382-.42.419-.821.679-1.381.896-.422.164-1.057.354-2.227.408-1.264.061-1.645.07-4.849.07-3.203 0-3.585-.009-4.849-.07-1.171-.054-1.805-.244-2.227-.408-.561-.217-.96-.477-1.382-.896-.419-.42-.679-.821-.896-1.381-.164-.422-.354-1.057-.408-2.227-.061-1.264-.07-1.645-.07-4.849 0-3.203.009-3.585.07-4.849.054-1.171.244-1.805.408-2.227.217-.561.477-.96.896-1.382.42-.419.821-.679 1.381-.896.422-.164 1.057-.354 2.227-.408 1.264-.061 1.645-.07 4.849-.07zM5.838 12a6.162 6.162 0 1 1 12.324 0 6.162 6.162 0 0 1-12.324 0zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm4.965-10.322a1.44 1.44 0 1 1 2.881.001 1.44 1.44 0 0 1-2.881-.001z"/>
                </svg>
              </Link>

              {/* WhatsApp */}
              <Link
                href="https://wa.me/17876774900"
                target="_blank"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/85 transition hover:-translate-y-0.5 hover:border-[#d4af37] hover:text-[#d4af37]"
                aria-label="WhatsApp"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.05.549 4.062 1.591 5.82L0 24l6.305-1.591C8.938 23.451 10.95 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.84 0-3.635-.47-5.196-1.354l-.372-.187-3.832.973.973-3.832-.187-.372C1.47 15.635 1 13.84 1 12c0-6.075 4.925-11 11-11s11 4.925 11 11-4.925 11-11 11zm5.894-8.221c-.322-.161-1.905-.942-2.212-1.049-.307-.107-.53-.16-.753.16-.223.32-.865 1.049-1.061 1.266-.196.217-.392.243-.715.08-.322-.161-1.36-.502-2.591-1.599-.958-.852-1.605-1.905-1.792-2.228-.187-.322-.02-.496.14-.656.144-.144.322-.376.483-.564.161-.188.215-.322.322-.537.107-.215.053-.403-.027-.564-.08-.161-.753-1.756-1.031-2.403-.271-.636-.544-.55-.753-.56-.196-.008-.42-.008-.644-.008-.223 0-.587.08-.894.403-.307.322-1.171 1.143-1.171 2.789 0 1.646 1.199 3.236 1.366 3.453.167.217 2.354 3.6 5.701 5.049.797.342 1.417.544 1.901.696.798.255 1.527.219 2.103.133.643-.096 1.98-.81 2.258-1.592.278-.782.278-1.45.195-1.592-.083-.141-.307-.224-.644-.383z"/>
                </svg>
              </Link>
            </div>
          </div>

          {/* NAV */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#d4af37]">
              Navegación
            </p>

            <nav className="mt-6 flex flex-col gap-4 text-sm text-white/75">
              <Link href="/" className="transition hover:text-white">
                Inicio
              </Link>
              <Link href="/listados" className="transition hover:text-white">
                Listados
              </Link>
              <Link href="/testimonios" className="transition hover:text-white">
                Testimonios
              </Link>
              <Link href="/about" className="transition hover:text-white">
                Sobre mí
              </Link>
              <Link href="/contact" className="transition hover:text-white">
                Contacto
              </Link>
            </nav>
          </div>

          {/* SERVICIOS */}
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

          {/* CONTACTO */}
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
