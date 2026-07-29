export const SUPPORTED_LOCALES = ["es-PR", "en-US"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "es-PR";
export const ENGLISH_LOCALE: AppLocale = "en-US";
export const PUBLIC_LOCALE_REQUEST_HEADER = "x-boriki-public-locale";

export function isSupportedLocale(value: string): value is AppLocale {
  return SUPPORTED_LOCALES.includes(value as AppLocale);
}

export function isMultilingualEnabled(
  value = process.env.MULTILINGUAL_ENABLED
) {
  return value?.trim().toLowerCase() === "true";
}

export function getPublicRequestLocale(
  pathname: string,
  multilingualEnabled = isMultilingualEnabled()
): AppLocale | null {
  if (
    !multilingualEnabled ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api" ||
    pathname.startsWith("/api/")
  ) {
    return null;
  }

  return pathname === "/en" || pathname.startsWith("/en/")
    ? ENGLISH_LOCALE
    : DEFAULT_LOCALE;
}
