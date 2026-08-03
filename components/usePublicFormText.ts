"use client";

import { useCallback } from "react";
import { usePublicLocale } from "@/components/PublicLocaleProvider";
import { getPublicFormText, hasEnglishPublicFormText } from "@/lib/i18n/public-form-copy";
import { ENGLISH_LOCALE } from "@/lib/i18n/locales";

export function usePublicFormText() {
  const { locale } = usePublicLocale();
  return useCallback(
    (spanish: string) => getPublicFormText(locale, spanish),
    [locale]
  );
}

export function usePublicFormError() {
  const { locale } = usePublicLocale();
  return useCallback(
    (serverMessage: unknown, spanishFallback: string) => {
      const message = typeof serverMessage === "string" ? serverMessage : "";
      if (locale !== ENGLISH_LOCALE) return message || spanishFallback;
      return hasEnglishPublicFormText(message)
        ? getPublicFormText(locale, message)
        : getPublicFormText(locale, spanishFallback);
    },
    [locale]
  );
}
