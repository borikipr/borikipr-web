import {
  isConfiguredTranslationProviderId,
  TranslationProviderError,
  type ConfiguredTranslationProviderId,
  type TranslationProvider,
} from "@/lib/i18n/translations/provider";
import {
  AzureTranslationProvider,
  type AzureTranslationTransport,
} from "@/lib/i18n/translations/azure-provider";
import { createAzureTranslationTransport } from "@/lib/i18n/translations/azure-transport";
import { TRANSLATION_USAGE_LIMITS } from "@/lib/i18n/translations/usage-budget";

export type TranslationWorkerConfig = {
  enabled: boolean;
  providerId: ConfiguredTranslationProviderId | null;
  batchSize: number;
  concurrency: number;
  lockTimeoutMs: number;
  requestTimeoutMs: number;
  workerIdPrefix: string;
  maximumAutomaticAttempts: number;
  maximumSourceCharacters: number;
  azureEndpoint: string | null;
  azureRegion: string | null;
  azureKey: string | null;
  vercelEnvironment: string | null;
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
  if (provider !== null && !isConfiguredTranslationProviderId(provider)) {
    throw new TranslationProviderError(
      "configuration",
      "provider_selection_invalid",
      "Translation provider selection is invalid."
    );
  }
  const production =
    env.VERCEL_ENV === "production" || env.APP_ENV === "production";
  const batchSize = integerSetting(
    env.TRANSLATION_WORKER_BATCH_SIZE,
    TRANSLATION_USAGE_LIMITS.productionBatchSize,
    1,
    production ? 1 : 50,
    "Translation worker batch size"
  );
  const concurrency = integerSetting(
    env.TRANSLATION_WORKER_CONCURRENCY,
    TRANSLATION_USAGE_LIMITS.productionConcurrency,
    1,
    production ? 1 : 5,
    "Translation worker concurrency"
  );
  return {
    enabled: env.TRANSLATION_WORKER_ENABLED === "true",
    providerId: provider,
    batchSize,
    concurrency,
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
    maximumAutomaticAttempts:
      TRANSLATION_USAGE_LIMITS.maximumAutomaticAttempts,
    maximumSourceCharacters: TRANSLATION_USAGE_LIMITS.maximumSourceCharacters,
    azureEndpoint: env.AZURE_TRANSLATOR_ENDPOINT?.trim() || null,
    azureRegion: env.AZURE_TRANSLATOR_REGION?.trim() || null,
    azureKey: env.AZURE_TRANSLATOR_KEY?.trim() || null,
    vercelEnvironment: env.VERCEL_ENV?.trim() || null,
  };
}

export function resolveTranslationProvider(input: {
  config: TranslationWorkerConfig;
  env?: NodeJS.ProcessEnv;
  injectedProvider?: TranslationProvider;
  azureTransport?: AzureTranslationTransport;
}) {
  if (!input.config.enabled) {
    throw new TranslationProviderError(
      "configuration",
      "worker_disabled",
      "Translation worker is disabled."
    );
  }
  if (input.injectedProvider) return input.injectedProvider;
  if (input.config.providerId === "azure-translator") {
    if (!input.azureTransport) {
      throw new TranslationProviderError(
        "configuration",
        "azure_transport_disabled",
        "Azure Translator transport is not installed or injected."
      );
    }
    return new AzureTranslationProvider(input.azureTransport);
  }
  throw new TranslationProviderError(
    "configuration",
    "provider_not_configured",
    "Translation provider is not configured."
  );
}

export function resolveConfiguredTranslationProvider(input: {
  config: TranslationWorkerConfig;
  injectedProvider?: TranslationProvider;
  azureTransport?: AzureTranslationTransport;
}) {
  if (!input.config.enabled) {
    throw new TranslationProviderError(
      "configuration",
      "worker_disabled",
      "Translation worker is disabled."
    );
  }
  if (input.injectedProvider) return input.injectedProvider;
  if (input.config.providerId === "azure-translator") {
    if (
      !input.config.azureEndpoint ||
      !input.config.azureRegion ||
      !input.config.azureKey
    ) {
      throw new TranslationProviderError(
        "configuration",
        "azure_configuration_missing",
        "Azure Translator configuration is incomplete."
      );
    }
    try {
      const transport =
        input.azureTransport ??
        createAzureTranslationTransport({
          endpoint: input.config.azureEndpoint,
          region: input.config.azureRegion,
          key: input.config.azureKey,
          requestTimeoutMs: input.config.requestTimeoutMs,
        });
      return new AzureTranslationProvider(transport);
    } catch (error) {
      if (error instanceof TranslationProviderError) throw error;
      throw new TranslationProviderError(
        "configuration",
        "azure_configuration_invalid",
        error instanceof Error
          ? error.message
          : "Azure Translator configuration is invalid."
      );
    }
  }
  throw new TranslationProviderError(
    "configuration",
    "provider_not_configured",
    "Translation provider is not configured."
  );
}
