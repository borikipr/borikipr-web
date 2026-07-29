"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  DEFAULT_LOCALE,
  ENGLISH_LOCALE,
  type AppLocale,
} from "@/lib/i18n/locales";
import {
  getEquivalentRoute,
  getRouteLocale,
} from "@/lib/i18n/routing";

type Props = {
  enabled?: boolean;
};

const options: ReadonlyArray<{
  locale: AppLocale;
  flag: string;
  language: string;
  shortCode: string;
}> = [
  {
    locale: DEFAULT_LOCALE,
    flag: "🇵🇷",
    language: "Español",
    shortCode: "ES",
  },
  {
    locale: ENGLISH_LOCALE,
    flag: "🇺🇸",
    language: "English",
    shortCode: "EN",
  },
];

export default function LanguageSelector({ enabled = false }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!enabled) return null;

  const query = searchParams.toString();
  const currentHref = `${pathname}${query ? `?${query}` : ""}`;
  const currentLocale = getRouteLocale(pathname);

  if (!currentLocale) return null;

  return (
    <nav
      aria-label="Seleccionar idioma / Select language"
      className="flex max-w-full flex-wrap items-center gap-2"
      data-language-selector
    >
      {options.map((option) => {
        const href = getEquivalentRoute(currentHref, option.locale);
        if (!href) return null;

        const isCurrent = option.locale === currentLocale;

        return (
          <Link
            key={option.locale}
            href={href}
            hrefLang={option.locale}
            lang={option.locale}
            aria-current={isCurrent ? "page" : undefined}
            aria-label={`${option.language} (${option.shortCode})`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-current/20 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span aria-hidden="true">{option.flag}</span>
            <span>{option.language}</span>
            <span aria-hidden="true">({option.shortCode})</span>
          </Link>
        );
      })}
    </nav>
  );
}
