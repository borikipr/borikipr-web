import type { TranslationStatus } from "@/lib/i18n/translations/types";

export type PublishableTranslationCandidate = {
  status: TranslationStatus;
  translatedValue: string | null;
  sourceHash: string;
  translatedSourceHash: string | null;
};

export function getTranslatedValueOrSpanishFallback(
  candidate: PublishableTranslationCandidate | null | undefined,
  spanishFallback: string
) {
  if (
    candidate?.status === "ready" &&
    candidate.translatedValue !== null &&
    candidate.translatedValue.trim() !== "" &&
    candidate.translatedSourceHash !== null &&
    candidate.sourceHash === candidate.translatedSourceHash
  ) {
    return candidate.translatedValue;
  }

  return spanishFallback;
}
