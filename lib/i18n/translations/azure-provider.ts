import {
  TranslationProviderError,
  validateProviderResult,
  type TranslationProvider,
  type TranslationProviderRequest,
  type TranslationProviderResult,
} from "@/lib/i18n/translations/provider";
import { protectBorikiTerminology } from "@/lib/i18n/translations/boriki-terminology";

export type AzureTranslationTransportRequest = {
  sourceLanguageCode: "es";
  targetLanguageCode: "en";
  text: string;
  correlationId: string;
  signal?: AbortSignal;
};

export type AzureTranslationTransportResponse = {
  translatedText: string;
  requestId: string | null;
  serviceVersion: string;
};

export type AzureTranslationTransport = {
  translate(
    request: AzureTranslationTransportRequest
  ): Promise<AzureTranslationTransportResponse>;
};

export class AzureTranslationHttpError extends Error {
  constructor(
    readonly status: number,
    readonly providerCode: number | null
  ) {
    super("Azure Translator request failed.");
    this.name = "AzureTranslationHttpError";
  }
}

const PROTECTED_TERMS = [
  "Borikí",
  "BorikiPR",
  "Erickson Real Estate",
  "Ivonne Erickson",
] as const;

export class AzureTranslationProvider implements TranslationProvider {
  readonly id = "azure-translator";
  readonly implementationVersion = "azure-adapter-v1";
  readonly model = "azure-translator-standard";

  constructor(private readonly transport: AzureTranslationTransport) {}

  async translate(
    request: TranslationProviderRequest
  ): Promise<TranslationProviderResult> {
    if (request.sourceLocale !== "es-PR" || request.targetLocale !== "en-US") {
      throw new TranslationProviderError(
        "permanent",
        "azure_locale_unsupported",
        "Configured Azure adapter does not support the requested locale pair."
      );
    }
    if (!request.sourceText.trim()) {
      throw new TranslationProviderError(
        "permanent",
        "azure_source_empty",
        "Azure Translator source text is empty."
      );
    }

    try {
      const terminology = protectBorikiTerminology(request.sourceText);
      const response = await this.transport.translate({
        sourceLanguageCode: "es",
        targetLanguageCode: "en",
        text: terminology.providerText,
        correlationId: request.correlationId,
        signal: request.signal,
      });
      const result = validateProviderResult({
        translatedText: terminology.restore(response.translatedText),
        providerId: this.id,
        providerModel: this.model,
        providerVersion: response.serviceVersion || this.implementationVersion,
        providerRequestId: response.requestId,
        usage: { characters: [...request.sourceText].length },
      });
      for (const term of PROTECTED_TERMS) {
        if (
          request.sourceText.includes(term) &&
          !result.translatedText.includes(term)
        ) {
          throw new TranslationProviderError(
            "permanent",
            "azure_brand_protection_failed",
            "Azure Translator did not preserve protected brand text."
          );
        }
      }
      return result;
    } catch (error) {
      if (error instanceof TranslationProviderError) throw error;
      if (
        error instanceof Error &&
        error.message === "boriki_terminology_token_missing"
      ) {
        throw new TranslationProviderError(
          "permanent",
          "azure_terminology_protection_failed",
          "Azure Translator did not preserve protected Borikí terminology."
        );
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new TranslationProviderError(
          "cancelled",
          "azure_request_cancelled",
          "Azure Translator request was cancelled."
        );
      }
      if (error instanceof AzureTranslationHttpError) {
        if (error.providerCode === 403001) {
          throw new TranslationProviderError(
            "permanent",
            "azure_quota_exceeded",
            "Azure Translator free quota is exhausted."
          );
        }
        if (error.status === 401 || error.status === 403) {
          throw new TranslationProviderError(
            "configuration",
            "azure_authentication_failed",
            "Azure Translator authentication is not configured correctly."
          );
        }
        if (
          error.status === 408 ||
          error.status === 429 ||
          error.status >= 500
        ) {
          throw new TranslationProviderError(
            "retryable",
            error.status === 429 ? "azure_rate_limited" : "azure_unavailable",
            "Azure Translator is temporarily unavailable."
          );
        }
        throw new TranslationProviderError(
          "permanent",
          "azure_request_rejected",
          "Azure Translator rejected the translation request."
        );
      }
      throw new TranslationProviderError(
        "retryable",
        "azure_unavailable",
        "Azure Translator is temporarily unavailable."
      );
    }
  }
}
