import assert from "node:assert/strict";
import test from "node:test";
import {
  AzureTranslationHttpError,
  AzureTranslationProvider,
} from "../lib/i18n/translations/azure-provider.ts";
import { createAzureTranslationTransport } from "../lib/i18n/translations/azure-transport.ts";
import {
  readTranslationWorkerConfig,
  resolveConfiguredTranslationProvider,
} from "../lib/i18n/translations/provider-registry.ts";
import { TranslationProviderError } from "../lib/i18n/translations/provider.ts";

const request = {
  sourceLocale: "es-PR",
  targetLocale: "en-US",
  entityType: "property",
  fieldKey: "description",
  sourceText: "Casa Borikí\nVista al mar en Ponce.",
  correlationId: "azure-fixture",
};

test("Azure registry is explicit, validated, and never falls back to Google", async () => {
  const config = readTranslationWorkerConfig({
    TRANSLATION_WORKER_ENABLED: "true",
    TRANSLATION_PROVIDER: "azure-translator",
    AZURE_TRANSLATOR_ENDPOINT: "https://api.cognitive.microsofttranslator.com",
    AZURE_TRANSLATOR_REGION: "eastus",
    AZURE_TRANSLATOR_KEY: "fixture-key",
  });
  assert.equal(config.providerId, "azure-translator");
  const provider = resolveConfiguredTranslationProvider({
    config,
    azureTransport: {
      async translate() {
        throw new AzureTranslationHttpError(429, null);
      },
    },
  });
  await assert.rejects(
    provider.translate(request),
    (error) =>
      error instanceof TranslationProviderError &&
      error.safeCode === "azure_rate_limited"
  );
  assert.throws(
    () => readTranslationWorkerConfig({
      TRANSLATION_WORKER_ENABLED: "true",
      TRANSLATION_PROVIDER: "google-cloud-translation",
    }),
    (error) => error.safeCode === "provider_selection_invalid"
  );
  assert.throws(
    () => readTranslationWorkerConfig({ TRANSLATION_PROVIDER: "arbitrary" }),
    (error) => error.safeCode === "provider_selection_invalid"
  );
});

test("Azure adapter maps Borikí locales and normalizes provider metadata", async () => {
  let received;
  const provider = new AzureTranslationProvider({
    async translate(input) {
      received = input;
      return {
        translatedText: "Borikí home\nOcean view in Ponce.",
        requestId: "azure-request-1",
        serviceVersion: "azure-translator-v3-test",
      };
    },
  });
  const result = await provider.translate(request);
  assert.deepEqual(
    [received.sourceLanguageCode, received.targetLanguageCode],
    ["es", "en"]
  );
  assert.equal(received.text, request.sourceText);
  assert.equal(result.providerId, "azure-translator");
  assert.equal(result.providerRequestId, "azure-request-1");
  assert.equal(result.providerVersion, "azure-translator-v3-test");
  assert.match(result.translatedText, /\n/);
});

test("Azure adapter deterministically preserves approved Borikí terminology", async () => {
  const sourceText = [
    "Responsable del listado",
    "Casa expandible de dos niveles con marquesina.",
    "Finca de 5 cuerdas opcionada.",
  ].join("\n");
  let providerText;
  const provider = new AzureTranslationProvider({
    async translate(input) {
      providerText = input.text;
      return {
        translatedText: input.text,
        requestId: "terminology-request",
        serviceVersion: "test",
      };
    },
  });
  const result = await provider.translate({ ...request, sourceText });
  assert.doesNotMatch(
    providerText,
    /Responsable|expandible|niveles|marquesina|cuerdas|opcionada/iu
  );
  assert.equal(
    result.translatedText,
    [
      "Listing representative",
      "Expandable home de two levels con carport.",
      "Finca de 5 cuerdas under option.",
    ].join("\n")
  );
  assert.doesNotMatch(result.translatedText, /acre|split-level/iu);
});

test("Azure adapter protects property-under-contract wording in isolation and context", async () => {
  const provider = new AzureTranslationProvider({
    async translate(input) {
      return {
        translatedText: input.text,
        requestId: "under-contract-terminology-request",
        serviceVersion: "test",
      };
    },
  });

  const standalone = await provider.translate({
    ...request,
    sourceText: "Propiedad bajo contrato",
  });
  assert.equal(standalone.translatedText, "Property under contract");

  const embedded = await provider.translate({
    ...request,
    sourceText:
      "Prueba interna Azure. Propiedad bajo contrato con marquesina y terreno de 2 cuerdas.",
  });
  assert.equal(
    embedded.translatedText,
    "Prueba interna Azure. Property under contract con carport y terreno de 2 cuerdas."
  );
  assert.doesNotMatch(embedded.translatedText, /contract property|acre/iu);
});

test("Azure adapter protects generic bajo contrato wording and numeric cuerda measurements", async () => {
  let providerText;
  const provider = new AzureTranslationProvider({
    async translate(input) {
      providerText = input.text;
      return {
        translatedText: input.text,
        requestId: "generic-terminology-request",
        serviceVersion: "test",
      };
    },
  });

  const result = await provider.translate({
    ...request,
    sourceText: "Bajo contrato: finca de 2 cuerdas y lote de 1 cuerda.",
  });
  assert.doesNotMatch(providerText, /bajo contrato|\b2 cuerdas\b|\b1 cuerda\b/iu);
  assert.equal(
    result.translatedText,
    "Under contract: finca de 2 cuerdas y lote de 1 cuerda."
  );
  assert.doesNotMatch(result.translatedText, /acre/iu);
});

test("Azure terminology protection fails closed when the provider changes a token", async () => {
  const provider = new AzureTranslationProvider({
    async translate() {
      return {
        translatedText: "Listing owner",
        requestId: null,
        serviceVersion: "test",
      };
    },
  });
  await assert.rejects(
    provider.translate({ ...request, sourceText: "Responsable del listado" }),
    (error) =>
      error instanceof TranslationProviderError &&
      error.safeCode === "azure_terminology_protection_failed"
  );
});

test("Azure REST transport preserves formatting and sends server-only headers", async () => {
  let received;
  const transport = createAzureTranslationTransport({
    endpoint: "https://api.cognitive.microsofttranslator.com/",
    region: "eastus",
    key: "fixture-key",
    requestTimeoutMs: 1_000,
    fetchImpl: async (url, init) => {
      received = { url: String(url), init };
      return new Response(
        JSON.stringify([
          { translations: [{ text: "Line one\nLine two", to: "en" }] },
        ]),
        { status: 200, headers: { "x-requestid": "request-2" } }
      );
    },
  });
  const result = await transport.translate({
    sourceLanguageCode: "es",
    targetLanguageCode: "en",
    text: "Línea uno\nLínea dos",
    correlationId: "trace-2",
  });
  const url = new URL(received.url);
  assert.equal(url.pathname, "/translate");
  assert.equal(url.searchParams.get("api-version"), "3.0");
  assert.equal(url.searchParams.get("from"), "es");
  assert.equal(url.searchParams.get("to"), "en");
  assert.equal(
    received.init.headers["Ocp-Apim-Subscription-Region"],
    "eastus"
  );
  assert.equal(received.init.headers["X-ClientTraceId"], "trace-2");
  assert.deepEqual(JSON.parse(received.init.body), [
    { Text: "Línea uno\nLínea dos" },
  ]);
  assert.equal(result.translatedText, "Line one\nLine two");
  assert.equal(result.requestId, "request-2");
});

for (const [status, providerCode, kind, safeCode] of [
  [403, 403001, "permanent", "azure_quota_exceeded"],
  [401, null, "configuration", "azure_authentication_failed"],
  [429, null, "retryable", "azure_rate_limited"],
  [503, null, "retryable", "azure_unavailable"],
  [400, null, "permanent", "azure_request_rejected"],
]) {
  test(`Azure error ${status}/${providerCode ?? "none"} is fail-closed`, async () => {
    const provider = new AzureTranslationProvider({
      async translate() {
        throw new AzureTranslationHttpError(status, providerCode);
      },
    });
    await assert.rejects(
      provider.translate(request),
      (error) =>
        error instanceof TranslationProviderError &&
        error.kind === kind &&
        error.safeCode === safeCode &&
        !error.message.includes(request.sourceText)
    );
  });
}

test("Azure rejects unsupported locales, empty source, and protected-brand loss", async () => {
  const provider = new AzureTranslationProvider({
    async translate() {
      return {
        translatedText: "Home in Ponce",
        requestId: null,
        serviceVersion: "test",
      };
    },
  });
  await assert.rejects(
    provider.translate({ ...request, targetLocale: "es-PR" }),
    (error) => error.safeCode === "azure_locale_unsupported"
  );
  await assert.rejects(
    provider.translate({ ...request, sourceText: "   " }),
    (error) => error.safeCode === "azure_source_empty"
  );
  await assert.rejects(
    provider.translate(request),
    (error) => error.safeCode === "azure_brand_protection_failed"
  );
});
