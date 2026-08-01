import type { GoogleTranslationTransport } from "@/lib/i18n/translations/google-provider";
import type { GoogleAuthenticationConfig } from "@/lib/i18n/translations/google-auth-config";

type TranslateTextResponse = {
  translations?: Array<{ translatedText?: string | null }>;
  glossaryTranslations?: Array<{ translatedText?: string | null }>;
};

export type OfficialGoogleTranslationClient = {
  translateText(
    request: Record<string, unknown>,
    options: { timeout: number }
  ): Promise<[TranslateTextResponse, unknown?, unknown?]> & {
    cancel?: () => void;
  };
};

type ClientFactory = () => Promise<OfficialGoogleTranslationClient>;

function readRequestId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || !("get" in metadata)) {
    return null;
  }
  const get = (metadata as { get?: unknown }).get;
  if (typeof get !== "function") return null;
  try {
    const value = get.call(metadata, "x-request-id");
    const first = Array.isArray(value) ? value[0] : value;
    return typeof first === "string" && first.length <= 200 ? first : null;
  } catch {
    return null;
  }
}

function abortError() {
  return new DOMException("Translation request was cancelled.", "AbortError");
}

export function createOfficialGoogleTranslationTransport(input: {
  requestTimeoutMs: number;
  glossaryId?: string | null;
  authentication?: GoogleAuthenticationConfig;
  clientFactory?: ClientFactory;
}): GoogleTranslationTransport {
  if (
    input.glossaryId &&
    !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(input.glossaryId)
  ) {
    throw new Error("Google Translation glossary ID is invalid.");
  }
  let clientPromise: Promise<OfficialGoogleTranslationClient> | null = null;
  const factory: ClientFactory =
    input.clientFactory ??
    (async () => {
      // Kept inside the first explicit provider call: imports and builds do not
      // instantiate the SDK or trigger Application Default Credentials lookup.
      const { createOfficialGoogleClient } = await import(
        "@/lib/i18n/translations/google-client"
      );
      return createOfficialGoogleClient({
        authentication: input.authentication ?? { mode: "adc" },
      });
    });

  return {
    async translate(request) {
      if (request.signal?.aborted) throw abortError();
      clientPromise ??= factory();
      const client = await clientPromise;
      if (request.signal?.aborted) throw abortError();

      const parent = `projects/${request.projectId}/locations/${request.location}`;
      const call = client.translateText(
        {
          parent,
          contents: request.contents,
          mimeType: request.mimeType,
          sourceLanguageCode: request.sourceLanguageCode,
          targetLanguageCode: request.targetLanguageCode,
          ...(input.glossaryId
            ? {
                glossaryConfig: {
                  glossary: `${parent}/glossaries/${input.glossaryId}`,
                },
              }
            : {}),
        },
        { timeout: input.requestTimeoutMs }
      );
      const onAbort = () => call.cancel?.();
      request.signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const [response, , metadata] = await call;
        if (request.signal?.aborted) throw abortError();
        return {
          translations: (
            response.glossaryTranslations ?? response.translations ?? []
          ).map((translation) => ({
            translatedText: translation.translatedText ?? undefined,
          })),
          requestId: readRequestId(metadata),
          serviceVersion: "google-cloud-translation-v3",
        };
      } catch (error) {
        if (request.signal?.aborted) throw abortError();
        throw error;
      } finally {
        request.signal?.removeEventListener("abort", onAbort);
      }
    },
  };
}
