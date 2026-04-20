"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type HeaderProps = {
  transparent?: boolean;
};

export default function Header({ transparent = false }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const isTransparent = transparent && !scrolled;
  const desktopText = isTransparent ? "text-white" : "text-[#4d4d4d]";
  const mobileButtonStyle = isTransparent
    ? "border-white/30 bg-black/10 text-white backdrop-blur-sm"
    : "border-[#d9d9d9] bg-white text-[#11518b]";

  return (
    <>
      <header
        className={`fixed left-0 top-0 z-50 w-full transition-all duration-300 ${
          isTransparent
            ? "bg-transparent"
            : "border-b border-[#e8e8e8] bg-white/95 backdrop-blur-md"
        }`}
      >
        <div
          className={`hidden lg:block transition-all duration-300 ${
            isTransparent
              ? "border-b border-white/10 bg-black/10 backdrop-blur-sm"
              : "border-b border-[#eeeeee] bg-[#0d1b2a]"
          }`}
        >
          <div className="section-shell flex h-10 items-center justify-between text-xs">
            <div
              className={`flex items-center gap-5 ${
                isTransparent ? "text-white/85" : "text-white/75"
              }`}
            >
              <span>Puerto Rico Real Estate</span>
              <span className="h-1 w-1 rounded-full bg-[#d4af37]" />
              <span>Licencia C-25961</span>
            </div>

            <div className="flex items-center gap-5">
              <Link
                href="https://wa.me/17876774900"
                target="_blank"
                className="font-medium text-white transition hover:text-[#d4af37]"
              >
                WhatsApp: (787) 677-4900
              </Link>
            </div>
          </div>
        </div>

        <div className="section-shell">
          <div className="flex h-[84px] items-center justify-between">
            <Link href="/" className="shrink-0">
              <Image
                src="/logo-erickson.png"
                alt="Ivonne Erickson Real Estate"
                width={180}
                height={60}
                priority
                style={{ width: "auto", height: "auto" }}
                className="w-[160px] sm:w-[165px] lg:w-[180px]"
              />
            </Link>

            <nav
              className={`hidden items-center gap-6 text-sm font-medium lg:flex xl:gap-8 ${desktopText}`}
            >
              <Link href="/" className="transition hover:text-[#d4af37]">
                Inicio
              </Link>

              <Link
                href="/listados"
                className="transition hover:text-[#d4af37]"
              >
                Listados
              </Link>

              <Link
                href="/about"
                className="transition hover:text-[#d4af37]"
              >
                Sobre mí
              </Link>

              <Link
                href="/testimonios"
                className="transition hover:text-[#d4af37]"
              >
                Testimonios
              </Link>

              <Link
                href="/contact"
                className="transition hover:text-[#d4af37]"
              >
                Contacto
              </Link>

              <Link href="/contact" className="btn-primary ml-2 px-5 py-2.5">
                Consulta
              </Link>
            </nav>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition lg:hidden ${mobileButtonStyle}`}
              aria-label="Abrir menú"
            >
              <div className="flex flex-col gap-[4px]">
                <span className="block h-[2px] w-4 rounded-full bg-current" />
                <span className="block h-[2px] w-4 rounded-full bg-current" />
                <span className="block h-[2px] w-4 rounded-full bg-current" />
              </div>
            </button>
          </div>
        </div>

        <div
          className={`h-[2px] transition ${
            isTransparent ? "bg-transparent" : "bg-[#d4af37]"
          }`}
        />
      </header>

      <div
        className={`fixed inset-0 z-[100] lg:hidden transition-all duration-300 ${
          menuOpen
            ? "pointer-events-auto bg-black/45 opacity-100"
            : "pointer-events-none bg-black/0 opacity-0"
        }`}
        onClick={() => setMenuOpen(false)}
      />

      <aside
        className={`fixed right-0 top-0 z-[110] h-full w-[88%] max-w-[380px] transform bg-white shadow-2xl transition-transform duration-300 lg:hidden ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#ededed] px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#d4af37]">
              Navegación
            </p>
            <p className="mt-1 text-sm text-[#4d4d4d]">
              Erickson Real Estate
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d9d9d9] text-[#11518b] transition hover:bg-[#f7f7f7]"
            aria-label="Cerrar menú"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-[#f1f1f1] px-6 py-4 text-sm text-[#4d4d4d]">
          <p className="font-medium text-[#000000]">Licencia C-25961</p>
          <p className="mt-1">Puerto Rico</p>
        </div>

        <nav className="flex flex-col px-6 py-6 text-[15px] font-medium text-[#2f2f2f]">
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="border-b border-[#f1f1f1] py-4 transition hover:text-[#11518b]"
          >
            Inicio
          </Link>

          <Link
            href="/listados"
            onClick={() => setMenuOpen(false)}
            className="border-b border-[#f1f1f1] py-4 transition hover:text-[#11518b]"
          >
            Listados
          </Link>

          <Link
            href="/about"
            onClick={() => setMenuOpen(false)}
            className="border-b border-[#f1f1f1] py-4 transition hover:text-[#11518b]"
          >
            Sobre mí
          </Link>

          <Link
            href="/testimonios"
            onClick={() => setMenuOpen(false)}
            className="border-b border-[#f1f1f1] py-4 transition hover:text-[#11518b]"
          >
            Testimonios
          </Link>

          <Link
            href="/contact"
            onClick={() => setMenuOpen(false)}
            className="border-b border-[#f1f1f1] py-4 transition hover:text-[#11518b]"
          >
            Contacto
          </Link>

          <Link
            href="https://wa.me/17876774900"
            target="_blank"
            onClick={() => setMenuOpen(false)}
            className="btn-secondary mt-6 justify-center"
          >
            WhatsApp
          </Link>

          <Link
            href="/contact"
            onClick={() => setMenuOpen(false)}
            className="btn-primary mt-4 justify-center"
          >
            Agendar consulta
          </Link>
        </nav>
      </aside>
    </>
  );
}