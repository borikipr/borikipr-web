import {
  AzureTranslationHttpError,
  type AzureTranslationTransport,
} from "@/lib/i18n/translations/azure-provider";

type AzureTranslationResponse = Array<{
  translations?: Array<{ text?: unknown; to?: unknown }>;
}>;

function normalizeEndpoint(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Azure Translator endpoint is invalid.");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Azure Translator endpoint must use HTTPS.");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function providerErrorCode(body: unknown) {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    body.error &&
    typeof body.error === "object" &&
    "code" in body.error
  ) {
    const code = Number(body.error.code);
    return Number.isInteger(code) ? code : null;
  }
  return null;
}

function requestId(headers: Headers) {
  const value = headers.get("x-requestid") ?? headers.get("x-request-id");
  return value && value.length <= 200 ? value : null;
}

export function createAzureTranslationTransport(input: {
  endpoint: string;
  region: string;
  key: string;
  requestTimeoutMs: number;
  fetchImpl?: typeof fetch;
}): AzureTranslationTransport {
  const endpoint = normalizeEndpoint(input.endpoint);
  const region = input.region.trim();
  const key = input.key.trim();
  if (!/^[a-z0-9-]{2,40}$/i.test(region)) {
    throw new Error("Azure Translator region is invalid.");
  }
  if (!key || key.length > 512) {
    throw new Error("Azure Translator key is invalid.");
  }
  const fetchImpl = input.fetchImpl ?? fetch;

  return {
    async translate(request) {
      const timeout = AbortSignal.timeout(input.requestTimeoutMs);
      const signal = request.signal
        ? AbortSignal.any([request.signal, timeout])
        : timeout;
      const url = new URL(`${endpoint}/translate`);
      url.searchParams.set("api-version", "3.0");
      url.searchParams.set("from", request.sourceLanguageCode);
      url.searchParams.set("to", request.targetLanguageCode);
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "Ocp-Apim-Subscription-Key": key,
          "Ocp-Apim-Subscription-Region": region,
          "X-ClientTraceId": request.correlationId,
        },
        body: JSON.stringify([{ Text: request.text }]),
        signal,
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | AzureTranslationResponse
        | { error?: unknown }
        | null;
      if (!response.ok) {
        throw new AzureTranslationHttpError(
          response.status,
          providerErrorCode(body)
        );
      }
      const translatedText = Array.isArray(body)
        ? body[0]?.translations?.[0]?.text
        : null;
      if (typeof translatedText !== "string") {
        throw new AzureTranslationHttpError(502, null);
      }
      return {
        translatedText,
        requestId: requestId(response.headers),
        serviceVersion: "azure-translator-v3",
      };
    },
  };
}
