import type {
  TranslationEntityType,
  TranslationField,
  TranslationTargetLocale,
} from "@/lib/i18n/translations/types";

export type TranslationProviderErrorKind =
  | "retryable"
  | "permanent"
  | "configuration"
  | "cancelled";

export class TranslationProviderError extends Error {
  readonly kind: TranslationProviderErrorKind;
  readonly safeCode: string;

  constructor(
    kind: TranslationProviderErrorKind,
    safeCode: string,
    safeMessage: string
  ) {
    super(safeMessage);
    this.name = "TranslationProviderError";
    this.kind = kind;
    this.safeCode = safeCode;
  }
}

export type TranslationProviderRequest = {
  sourceLocale: "es-PR";
  targetLocale: TranslationTargetLocale;
  entityType: TranslationEntityType;
  fieldKey: TranslationField;
  sourceText: string;
  correlationId: string;
  signal?: AbortSignal;
};

export type TranslationProviderResult = {
  translatedText: string;
  providerId: string;
  providerModel: string | null;
  providerVersion: string | null;
  providerRequestId: string | null;
  usage: { characters?: number } | null;
};

export interface TranslationProvider {
  readonly id: string;
  readonly implementationVersion: string;
  readonly model: string | null;
  translate(
    request: TranslationProviderRequest
  ): Promise<TranslationProviderResult>;
}

const SAFE_MESSAGE_MAX_LENGTH = 240;

export function classifyTranslationProviderError(error: unknown): {
  kind: TranslationProviderErrorKind;
  code: string;
  message: string;
} {
  if (error instanceof TranslationProviderError) {
    return {
      kind: error.kind,
      code: error.safeCode,
      message: error.message.slice(0, SAFE_MESSAGE_MAX_LENGTH),
    };
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      kind: "retryable",
      code: "provider_timeout",
      message: "Translation provider request timed out.",
    };
  }
  return {
    kind: "retryable",
    code: "provider_unavailable",
    message: "Translation provider is temporarily unavailable.",
  };
}

export function validateProviderResult(
  result: TranslationProviderResult
): TranslationProviderResult {
  if (!result.translatedText.trim()) {
    throw new TranslationProviderError(
      "permanent",
      "provider_empty_result",
      "Translation provider returned an empty result."
    );
  }
  return result;
}
