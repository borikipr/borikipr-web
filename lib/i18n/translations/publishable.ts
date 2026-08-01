import type { TranslationStatus } from "@/lib/i18n/translations/types";

export type PublishableTranslationCandidate = {
  status: TranslationStatus;
  translatedValue: string | null;
  sourceHash: string;
  translatedSourceHash: string | null;
};

export function isPublishableTranslation(
  candidate: PublishableTranslationCandidate | null | undefined
): candidate is PublishableTranslationCandidate & {
  translatedValue: string;
  translatedSourceHash: string;
} {
  return Boolean(
    candidate?.status === "ready" &&
      candidate.translatedValue !== null &&
      candidate.translatedValue.trim() !== "" &&
      candidate.translatedSourceHash !== null &&
      candidate.sourceHash === candidate.translatedSourceHash
  );
}

export function getTranslatedValueOrSpanishFallback(
  candidate: PublishableTranslationCandidate | null | undefined,
  spanishFallback: string
) {
  if (isPublishableTranslation(candidate)) {
    return candidate.translatedValue;
  }

  return spanishFallback;
}
