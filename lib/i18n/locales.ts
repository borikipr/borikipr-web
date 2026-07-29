export const SUPPORTED_LOCALES = ["es-PR", "en-US"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "es-PR";
export const ENGLISH_LOCALE: AppLocale = "en-US";

export function isSupportedLocale(value: string): value is AppLocale {
  return SUPPORTED_LOCALES.includes(value as AppLocale);
}

export function isMultilingualEnabled(
  value = process.env.MULTILINGUAL_ENABLED
) {
  return value?.trim().toLowerCase() === "true";
}
