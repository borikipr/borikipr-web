"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { usePublicLocale } from "@/components/PublicLocaleProvider";
import {
  DEFAULT_LOCALE,
  ENGLISH_LOCALE,
  type AppLocale,
} from "@/lib/i18n/locales";
import {
  getEquivalentRoute,
  getRouteLocale,
  isStaticLocalePreviewRoute,
} from "@/lib/i18n/routing";

const options: ReadonlyArray<{ locale: AppLocale; flag: string }> = [
  { locale: DEFAULT_LOCALE, flag: "🇵🇷" },
  { locale: ENGLISH_LOCALE, flag: "🇺🇸" },
];

export default function LanguageSelector() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { dictionary } = usePublicLocale();
  const query = searchParams.toString();
  const currentHref = `${pathname}${query ? `?${query}` : ""}`;
  const currentLocale = getRouteLocale(pathname);

  if (!currentLocale || !isStaticLocalePreviewRoute(pathname)) return null;

  return (
    <nav
      aria-label={dictionary.language.selectorLabel}
      className="flex max-w-full flex-wrap items-center gap-2"
      data-language-selector
    >
      {options.map((option) => {
        const href = getEquivalentRoute(currentHref, option.locale);
        if (!href) return null;

        const isCurrent = option.locale === currentLocale;
        const language =
          option.locale === DEFAULT_LOCALE
            ? dictionary.language.spanish
            : dictionary.language.english;
        const shortCode =
          option.locale === DEFAULT_LOCALE
            ? dictionary.language.spanishShort
            : dictionary.language.englishShort;

        return (
          <Link
            key={option.locale}
            href={href}
            hrefLang={option.locale}
            lang={option.locale}
            aria-current={isCurrent ? "page" : undefined}
            aria-label={`${language} (${shortCode})`}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${
              isCurrent
                ? "border-[#d4af37] bg-[#d4af37]/10"
                : "border-current/20"
            }`}
          >
            <span aria-hidden="true">{option.flag}</span>
            <span>{language}</span>
            <span aria-hidden="true">({shortCode})</span>
          </Link>
        );
      })}
    </nav>
  );
}
