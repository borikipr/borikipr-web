import {
  classifyTranslationProviderError,
  type TranslationProvider,
} from "@/lib/i18n/translations/provider";
import {
  readTranslationWorkerConfig,
  resolveConfiguredTranslationProvider,
} from "@/lib/i18n/translations/provider-registry";
import type { AzureTranslationTransport } from "@/lib/i18n/translations/azure-provider";
import type { TranslationDatabase } from "@/lib/i18n/translations/repository";
import { createTranslationWorkerRepository } from "@/lib/i18n/translations/worker-repository";
import { processTranslationJobs } from "@/lib/i18n/translations/worker";

export type TranslationWorkerInvocationResult =
  | { ok: false; state: "disabled" | "configuration_error"; errorCode: string }
  | {
      ok: true;
      state: "processed";
      summary: Awaited<ReturnType<typeof processTranslationJobs>>;
      health: Awaited<
        ReturnType<
          ReturnType<typeof createTranslationWorkerRepository>["getOperationalHealth"]
        >
      >;
    };

export async function runConfiguredTranslationWorker(input: {
  database: TranslationDatabase;
  env?: NodeJS.ProcessEnv;
  injectedProvider?: TranslationProvider;
  azureTransport?: AzureTranslationTransport;
  now?: () => Date;
  logger?: Parameters<typeof processTranslationJobs>[0]["logger"];
  onTranslationPublished?: Parameters<
    typeof processTranslationJobs
  >[0]["onTranslationPublished"];
}): Promise<TranslationWorkerInvocationResult> {
  try {
    const config = readTranslationWorkerConfig(input.env);
    if (!config.enabled) {
      return { ok: false, state: "disabled", errorCode: "worker_disabled" };
    }
    const provider = resolveConfiguredTranslationProvider({
      config,
      injectedProvider: input.injectedProvider,
      azureTransport: input.azureTransport,
    });
    const summary = await processTranslationJobs({
      database: input.database,
      provider,
      config,
      now: input.now,
      logger: input.logger,
      onTranslationPublished: input.onTranslationPublished,
    });
    const now = input.now?.() ?? new Date();
    const health = await createTranslationWorkerRepository(
      input.database
    ).getOperationalHealth({
      now,
      lockTimeoutMs: config.lockTimeoutMs,
    });
    return { ok: true, state: "processed", summary, health };
  } catch (error) {
    const safe = classifyTranslationProviderError(error);
    if (safe.kind !== "configuration") throw error;
    return {
      ok: false,
      state: "configuration_error",
      errorCode: safe.code,
    };
  }
}
