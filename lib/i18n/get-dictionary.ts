import enUS from "@/locales/en-US";
import esPR from "@/locales/es-PR";
import {
  DEFAULT_LOCALE,
  type AppLocale,
  isSupportedLocale,
} from "@/lib/i18n/locales";

type WidenStrings<T> = {
  [Key in keyof T]: T[Key] extends string
    ? string
    : T[Key] extends object
      ? WidenStrings<T[Key]>
      : T[Key];
};

export type DictionaryShape = WidenStrings<typeof esPR>;

const dictionaries = {
  "es-PR": esPR,
  "en-US": enUS,
} satisfies Record<AppLocale, DictionaryShape>;

export function getDictionary(locale: AppLocale): DictionaryShape {
  return dictionaries[locale];
}

export function getDictionaryForUnknownLocale(
  locale: string | null | undefined
): DictionaryShape {
  if (!locale) return dictionaries[DEFAULT_LOCALE];

  if (!isSupportedLocale(locale)) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`Unsupported locale: ${locale}`);
    }
    return dictionaries[DEFAULT_LOCALE];
  }

  return dictionaries[locale];
}
