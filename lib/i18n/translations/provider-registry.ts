import type { TranslationProvider } from "@/lib/i18n/translations/provider";
import { TranslationProviderError } from "@/lib/i18n/translations/provider";
import type { GoogleTranslationTransport } from "@/lib/i18n/translations/google-provider";
import { GoogleCloudTranslationProvider } from "@/lib/i18n/translations/google-provider";
import { createOfficialGoogleTranslationTransport } from "@/lib/i18n/translations/google-transport";
import {
  assertGoogleAuthenticationConfig,
  buildGoogleWorkloadIdentityAudience,
  type GoogleAuthenticationConfig,
} from "@/lib/i18n/translations/google-auth-config";
import { TRANSLATION_USAGE_LIMITS } from "@/lib/i18n/translations/usage-budget";

export type TranslationWorkerConfig = {
  enabled: boolean;
  providerId: "google-cloud-translation" | null;
  batchSize: number;
  concurrency: number;
  lockTimeoutMs: number;
  requestTimeoutMs: number;
  workerIdPrefix: string;
  maximumAutomaticAttempts: number;
  maximumSourceCharacters: number;
  googleProjectId: string | null;
  googleLocation: string;
  googleGlossaryId: string | null;
  googleAuthentication: GoogleAuthenticationConfig;
  vercelEnvironment: string | null;
};

function readGoogleAuthenticationConfig(
  env: NodeJS.ProcessEnv
): GoogleAuthenticationConfig {
  const requestedMode = env.GOOGLE_CLOUD_AUTH_MODE?.trim();
  if (
    requestedMode &&
    requestedMode !== "adc" &&
    requestedMode !== "vercel-wif"
  ) {
    throw new TranslationProviderError(
      "configuration",
      "google_auth_mode_invalid",
      "Google Cloud authentication mode is invalid."
    );
  }
  const mode: "adc" | "vercel-wif" =
    (requestedMode as "adc" | "vercel-wif" | undefined) ??
    (env.VERCEL_ENV ? "vercel-wif" : "adc");
  if (mode === "adc") return { mode };
  const projectNumber = env.GOOGLE_CLOUD_PROJECT_NUMBER?.trim() || "";
  const serviceAccountEmail =
    env.GOOGLE_CLOUD_SERVICE_ACCOUNT_EMAIL?.trim() || "";
  const workloadIdentityPoolId =
    env.GOOGLE_CLOUD_WORKLOAD_IDENTITY_POOL_ID?.trim() || "";
  const workloadIdentityProviderId =
    env.GOOGLE_CLOUD_WORKLOAD_IDENTITY_PROVIDER_ID?.trim() || "";
  const workloadIdentityAudience =
    env.GOOGLE_CLOUD_WORKLOAD_IDENTITY_AUDIENCE?.trim() ||
    buildGoogleWorkloadIdentityAudience({
      projectNumber,
      poolId: workloadIdentityPoolId,
      providerId: workloadIdentityProviderId,
    });
  return {
    mode,
    projectNumber,
    serviceAccountEmail,
    workloadIdentityPoolId,
    workloadIdentityProviderId,
    workloadIdentityAudience,
  };
}

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
    googleProjectId: env.GOOGLE_CLOUD_PROJECT_ID?.trim() || null,
    googleLocation:
      env.GOOGLE_CLOUD_TRANSLATION_LOCATION?.trim() || "global",
    googleGlossaryId: env.GOOGLE_CLOUD_TRANSLATION_GLOSSARY_ID?.trim() || null,
    googleAuthentication: readGoogleAuthenticationConfig(env),
    vercelEnvironment: env.VERCEL_ENV?.trim() || null,
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
  if (!input.googleTransport) {
    throw new TranslationProviderError(
      "configuration",
      "google_transport_disabled",
      "Google Cloud official transport is not installed or injected."
    );
  }
  return new GoogleCloudTranslationProvider({
    projectId: input.config.googleProjectId ?? "",
    location: input.config.googleLocation,
    transport: input.googleTransport,
  });
}

export function resolveConfiguredTranslationProvider(input: {
  config: TranslationWorkerConfig;
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
  if (!input.config.googleProjectId) {
    throw new TranslationProviderError(
      "configuration",
      "google_project_missing",
      "Google Cloud project ID is not configured."
    );
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/.test(input.config.googleProjectId)) {
    throw new TranslationProviderError(
      "configuration",
      "google_project_invalid",
      "Google Cloud project ID is invalid."
    );
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/.test(input.config.googleLocation)) {
    throw new TranslationProviderError(
      "configuration",
      "google_location_invalid",
      "Google Cloud translation location is invalid."
    );
  }
  if (
    input.config.googleGlossaryId &&
    !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(input.config.googleGlossaryId)
  ) {
    throw new TranslationProviderError(
      "configuration",
      "google_glossary_invalid",
      "Google Cloud Translation glossary ID is invalid."
    );
  }
  try {
    if (
      input.config.vercelEnvironment &&
      input.config.googleAuthentication.mode === "adc"
    ) {
      throw new Error("ADC mode is not permitted in a Vercel runtime.");
    }
    assertGoogleAuthenticationConfig(input.config.googleAuthentication);
  } catch (error) {
    throw new TranslationProviderError(
      "configuration",
      "google_authentication_configuration_invalid",
      error instanceof Error ? error.message : "Google authentication configuration is invalid."
    );
  }
  const transport =
    input.googleTransport ??
    createOfficialGoogleTranslationTransport({
      requestTimeoutMs: input.config.requestTimeoutMs,
      glossaryId: input.config.googleGlossaryId,
      authentication: input.config.googleAuthentication,
    });
  return new GoogleCloudTranslationProvider({
    projectId: input.config.googleProjectId,
    location: input.config.googleLocation,
    transport,
  });
}
