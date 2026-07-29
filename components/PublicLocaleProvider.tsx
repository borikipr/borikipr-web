"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { getDictionary, type DictionaryShape } from "@/lib/i18n/get-dictionary";
import {
  DEFAULT_LOCALE,
  ENGLISH_LOCALE,
  type AppLocale,
} from "@/lib/i18n/locales";
import { getRouteLocale } from "@/lib/i18n/routing";

type PublicLocaleContextValue = {
  locale: AppLocale;
  dictionary: DictionaryShape;
  multilingualEnabled: boolean;
};

const defaultValue: PublicLocaleContextValue = {
  locale: DEFAULT_LOCALE,
  dictionary: getDictionary(DEFAULT_LOCALE),
  multilingualEnabled: false,
};

const PublicLocaleContext =
  createContext<PublicLocaleContextValue>(defaultValue);

export default function PublicLocaleProvider({
  children,
  multilingualEnabled,
}: {
  children: ReactNode;
  multilingualEnabled: boolean;
}) {
  const pathname = usePathname();
  const locale =
    (multilingualEnabled &&
      (getRouteLocale(pathname) ||
        (pathname === "/en" || pathname.startsWith("/en/")
          ? ENGLISH_LOCALE
          : DEFAULT_LOCALE))) ||
    DEFAULT_LOCALE;

  useLayoutEffect(() => {
    if (!multilingualEnabled) return;
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.lang = "es";
    };
  }, [locale, multilingualEnabled]);

  const value = useMemo(
    () => ({
      locale,
      dictionary: getDictionary(locale),
      multilingualEnabled,
    }),
    [locale, multilingualEnabled]
  );

  return (
    <PublicLocaleContext.Provider value={value}>
      {children}
    </PublicLocaleContext.Provider>
  );
}

export function usePublicLocale() {
  return useContext(PublicLocaleContext);
}
