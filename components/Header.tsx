"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { trackAnalyticsEvent } from "@/lib/analytics";
import LanguageSelector from "@/components/LanguageSelector";
import { usePublicLocale } from "@/components/PublicLocaleProvider";
import { getEquivalentRoute } from "@/lib/i18n/routing";

type HeaderProps = {
  transparent?: boolean;
};

function LanguageSelectorFallback() {
  return (
    <span
      aria-hidden="true"
      className="block min-h-11 min-w-52 max-w-full"
      data-language-selector-fallback
    />
  );
}

function GuardedLanguageSelector() {
  return (
    <Suspense fallback={<LanguageSelectorFallback />}>
      <LanguageSelector />
    </Suspense>
  );
}

export default function Header({ transparent = false }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { locale, dictionary, multilingualEnabled } = usePublicLocale();
  const localizedHref = (href: string) =>
    getEquivalentRoute(href, locale) ?? href;

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

  const logoClass = isTransparent
    ? "w-[166px] sm:w-[205px] lg:w-[190px]"
    : "w-[166px] sm:w-[205px] lg:w-[190px]";
  const logoSizes = "(min-width: 1024px) 190px, (min-width: 640px) 205px, 166px";
  const logoImage = (
    <>
      <Image
        src="/logo-erickson.png"
        alt="Ivonne Erickson Real Estate"
        width={180}
        height={60}
        priority
        sizes={logoSizes}
        className={`site-logo-primary h-auto w-full transition-opacity duration-300 ${
          isTransparent ? "opacity-0" : "opacity-100"
        }`}
      />
      <Image
        src="/logo-erickson-light.png"
        alt=""
        aria-hidden="true"
        width={180}
        height={60}
        priority
        sizes={logoSizes}
        className={`site-logo-secondary absolute inset-0 h-auto w-full transition-opacity duration-300 ${
          isTransparent ? "opacity-100" : "opacity-0"
        }`}
      />
    </>
  );
  const logoContainerClass = `relative block shrink-0 ${logoClass}`;
  const logoHitAreaClass =
    "absolute left-[32%] top-[29%] h-[42%] w-[36%] cursor-pointer";

  return (
    <>
      <style>
        {`
          @media (prefers-color-scheme: dark) and (max-width: 1023px) {
            .site-logo-primary {
              opacity: 0;
            }

            .site-logo-secondary {
              opacity: 1;
            }
          }
        `}
      </style>

      <header
        className={`fixed left-0 top-0 z-50 w-full transition-all duration-300 ${
          isTransparent
            ? "bg-gradient-to-b from-black/60 via-black/30 to-transparent"
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
              {multilingualEnabled && <GuardedLanguageSelector />}
              <Link
                href="https://wa.me/17876774900"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackAnalyticsEvent("whatsapp_click", {
                    source_route: "header_desktop",
                  })
                }
                className="font-medium text-white transition hover:text-[#d4af37]"
              >
                WhatsApp: (787) 677-4900
              </Link>
            </div>
          </div>
        </div>

        <div className="section-shell">
          <div className="flex h-[84px] items-center justify-between">
            <span className={logoContainerClass}>
              {logoImage}
              <Link
                href={localizedHref("/")}
                aria-label={dictionary.navigation.homeAriaLabel}
                className={logoHitAreaClass}
              />
            </span>

            <nav
              className={`hidden items-center gap-6 text-sm font-medium lg:flex xl:gap-8 ${desktopText}`}
            >
              <Link href={localizedHref("/")} className="transition hover:text-[#d4af37]">
                {dictionary.navigation.home}
              </Link>

              <Link
                href={localizedHref("/listados")}
                className="transition hover:text-[#d4af37]"
              >
                {dictionary.navigation.listings}
              </Link>

              <Link
                href={localizedHref("/about")}
                className="transition hover:text-[#d4af37]"
              >
                {dictionary.navigation.about}
              </Link>

              <Link
                href={localizedHref("/testimonios")}
                className="transition hover:text-[#d4af37]"
              >
                {dictionary.navigation.testimonials}
              </Link>

              <Link
                href={localizedHref("/contact")}
                className="transition hover:text-[#d4af37]"
              >
                {dictionary.navigation.contact}
              </Link>

              <Link href={localizedHref("/contact")} className="btn-primary ml-2 px-5 py-2.5">
                {dictionary.navigation.consultation}
              </Link>
            </nav>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition lg:hidden ${mobileButtonStyle}`}
              aria-label={dictionary.navigation.openMenu}
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
              {dictionary.navigation.menu}
            </p>
            <p className="mt-1 text-sm text-[#4d4d4d]">
              Erickson Real Estate
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d9d9d9] text-[#11518b] transition hover:bg-[#f7f7f7]"
            aria-label={dictionary.navigation.closeMenu}
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
            href={localizedHref("/")}
            onClick={() => setMenuOpen(false)}
            className="border-b border-[#f1f1f1] py-4 transition hover:text-[#11518b]"
          >
            {dictionary.navigation.home}
          </Link>

          <Link
            href={localizedHref("/listados")}
            onClick={() => setMenuOpen(false)}
            className="border-b border-[#f1f1f1] py-4 transition hover:text-[#11518b]"
          >
            {dictionary.navigation.listings}
          </Link>

          <Link
            href={localizedHref("/about")}
            onClick={() => setMenuOpen(false)}
            className="border-b border-[#f1f1f1] py-4 transition hover:text-[#11518b]"
          >
            {dictionary.navigation.about}
          </Link>

          <Link
            href={localizedHref("/testimonios")}
            onClick={() => setMenuOpen(false)}
            className="border-b border-[#f1f1f1] py-4 transition hover:text-[#11518b]"
          >
            {dictionary.navigation.testimonials}
          </Link>

          <Link
            href={localizedHref("/contact")}
            onClick={() => setMenuOpen(false)}
            className="border-b border-[#f1f1f1] py-4 transition hover:text-[#11518b]"
          >
            {dictionary.navigation.contact}
          </Link>

          {multilingualEnabled && (
            <div className="border-b border-[#f1f1f1] py-4">
              <GuardedLanguageSelector />
            </div>
          )}

          <Link
            href="https://wa.me/17876774900"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackAnalyticsEvent("whatsapp_click", {
                source_route: "header_mobile_menu",
              });
              setMenuOpen(false);
            }}
            className="btn-secondary mt-6 justify-center"
          >
            WhatsApp
          </Link>

          <Link
            href={localizedHref("/contact")}
            onClick={() => setMenuOpen(false)}
            className="btn-primary mt-4 justify-center"
          >
            {dictionary.navigation.scheduleConsultation}
          </Link>
        </nav>
      </aside>
    </>
  );
}
