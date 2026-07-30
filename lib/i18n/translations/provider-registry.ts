import type { TranslationProvider } from "@/lib/i18n/translations/provider";
import { TranslationProviderError } from "@/lib/i18n/translations/provider";
import type { GoogleTranslationTransport } from "@/lib/i18n/translations/google-provider";
import { GoogleCloudTranslationProvider } from "@/lib/i18n/translations/google-provider";

export type TranslationWorkerConfig = {
  enabled: boolean;
  providerId: "google-cloud-translation" | null;
  batchSize: number;
  concurrency: number;
  lockTimeoutMs: number;
  requestTimeoutMs: number;
  workerIdPrefix: string;
};

function integerSetting(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string
) {
  const parsed = value ? Number(value) : fallback;
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new TranslationProviderError(
      "configuration",
      "worker_configuration_invalid",
      `${label} is invalid.`
    );
  }
  return parsed;
}

export function readTranslationWorkerConfig(
  env: NodeJS.ProcessEnv = process.env
): TranslationWorkerConfig {
  const provider = env.TRANSLATION_PROVIDER?.trim() || null;
  if (provider !== null && provider !== "google-cloud-translation") {
    throw new TranslationProviderError(
      "configuration",
      "provider_selection_invalid",
      "Translation provider selection is invalid."
    );
  }
  return {
    enabled: env.TRANSLATION_WORKER_ENABLED === "true",
    providerId: provider,
    batchSize: integerSetting(
      env.TRANSLATION_WORKER_BATCH_SIZE,
      10,
      1,
      50,
      "Translation worker batch size"
    ),
    concurrency: integerSetting(
      env.TRANSLATION_WORKER_CONCURRENCY,
      2,
      1,
      5,
      "Translation worker concurrency"
    ),
    lockTimeoutMs: integerSetting(
      env.TRANSLATION_WORKER_LOCK_TIMEOUT_MS,
      10 * 60_000,
      60_000,
      60 * 60_000,
      "Translation worker lock timeout"
    ),
    requestTimeoutMs: integerSetting(
      env.TRANSLATION_PROVIDER_TIMEOUT_MS,
      30_000,
      1_000,
      120_000,
      "Translation provider timeout"
    ),
    workerIdPrefix:
      env.TRANSLATION_WORKER_ID?.trim().slice(0, 60) || "borikipr",
  };
}

export function resolveTranslationProvider(input: {
  config: TranslationWorkerConfig;
  env?: NodeJS.ProcessEnv;
  injectedProvider?: TranslationProvider;
  googleTransport?: GoogleTranslationTransport;
}) {
  if (!input.config.enabled) {
    throw new TranslationProviderError(
      "configuration",
      "worker_disabled",
      "Translation worker is disabled."
    );
  }
  if (input.injectedProvider) return input.injectedProvider;
  if (input.config.providerId !== "google-cloud-translation") {
    throw new TranslationProviderError(
      "configuration",
      "provider_not_configured",
      "Translation provider is not configured."
    );
  }
  const env = input.env ?? process.env;
  if (!input.googleTransport) {
    throw new TranslationProviderError(
      "configuration",
      "google_transport_disabled",
      "Google Cloud official transport is not installed or injected."
    );
  }
  return new GoogleCloudTranslationProvider({
    projectId: env.GOOGLE_CLOUD_PROJECT_ID?.trim() || "",
    location: env.GOOGLE_CLOUD_TRANSLATION_LOCATION?.trim() || "global",
    transport: input.googleTransport,
  });
}
