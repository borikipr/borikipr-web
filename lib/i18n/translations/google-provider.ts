import {
  TranslationProviderError,
  validateProviderResult,
  type TranslationProvider,
  type TranslationProviderRequest,
  type TranslationProviderResult,
} from "@/lib/i18n/translations/provider";

export type GoogleTranslationTransport = {
  translate(input: {
    projectId: string;
    location: string;
    sourceLanguageCode: "es";
    targetLanguageCode: "en";
    contents: string[];
    mimeType: "text/plain";
    signal?: AbortSignal;
  }): Promise<{
    translations: Array<{ translatedText?: string }>;
    requestId?: string | null;
    serviceVersion?: string | null;
  }>;
};

export class GoogleCloudTranslationProvider implements TranslationProvider {
  readonly id = "google-cloud-translation";
  readonly implementationVersion = "adapter-boundary-v1";
  readonly model = "translation-advanced-v3";

  constructor(
    private readonly config: {
      projectId: string;
      location: string;
      transport: GoogleTranslationTransport;
    }
  ) {
    if (!config.projectId.trim()) {
      throw new TranslationProviderError(
        "configuration",
        "google_project_missing",
        "Google Cloud project ID is not configured."
      );
    }
    if (!config.location.trim()) {
      throw new TranslationProviderError(
        "configuration",
        "google_location_missing",
        "Google Cloud translation location is not configured."
      );
    }
  }

  async translate(
    request: TranslationProviderRequest
  ): Promise<TranslationProviderResult> {
    if (request.sourceLocale !== "es-PR" || request.targetLocale !== "en-US") {
      throw new TranslationProviderError(
        "permanent",
        "google_locale_unsupported",
        "Configured Google adapter does not support the requested locale pair."
      );
    }
    try {
      const response = await this.config.transport.translate({
        projectId: this.config.projectId,
        location: this.config.location,
        sourceLanguageCode: "es",
        targetLanguageCode: "en",
        contents: [request.sourceText],
        mimeType: "text/plain",
        signal: request.signal,
      });
      return validateProviderResult({
        translatedText: response.translations[0]?.translatedText ?? "",
        providerId: this.id,
        providerModel: this.model,
        providerVersion:
          response.serviceVersion ?? this.implementationVersion,
        providerRequestId: response.requestId ?? null,
        usage: { characters: request.sourceText.length },
      });
    } catch (error) {
      if (error instanceof TranslationProviderError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      const status =
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof error.status === "number"
          ? error.status
          : null;
      if (status === 401 || status === 403) {
        throw new TranslationProviderError(
          "configuration",
          "google_authentication_failed",
          "Google Cloud Translation authentication is not configured correctly."
        );
      }
      if (status !== null && status >= 400 && status < 500 && status !== 429) {
        throw new TranslationProviderError(
          "permanent",
          "google_request_rejected",
          "Google Cloud Translation rejected the translation request."
        );
      }
      throw new TranslationProviderError(
        "retryable",
        status === 429 ? "google_rate_limited" : "google_unavailable",
        "Google Cloud Translation is temporarily unavailable."
      );
    }
  }
}
