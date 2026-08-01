import { randomUUID } from "node:crypto";
import {
  classifyTranslationProviderError,
  validateProviderResult,
  type TranslationProvider,
} from "@/lib/i18n/translations/provider";
import {
  computeContextSourceHash,
  createTranslationWorkerRepository,
  type ClaimedTranslationJob,
} from "@/lib/i18n/translations/worker-repository";
import type { TranslationDatabase } from "@/lib/i18n/translations/repository";
import type { TranslationWorkerConfig } from "@/lib/i18n/translations/provider-registry";

const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  12 * 60 * 60_000,
] as const;
const JITTER_RATIO = 0.2;

export type TranslationWorkerSummary = {
  eligible: number;
  claimed: number;
  succeeded: number;
  retried: number;
  failed: number;
  cancelled: number;
  skippedProtected: number;
  skippedObsolete: number;
  configurationErrors: number;
  staleLocksRecovered: number;
  durationMs: number;
};

type WorkerLogger = (
  event: string,
  details: Record<string, string | number | boolean | null>
) => void;

export function calculateTranslationRetryAt(input: {
  attempt: number;
  now: Date;
  random?: () => number;
}) {
  const base =
    RETRY_DELAYS_MS[
      Math.min(Math.max(input.attempt - 1, 0), RETRY_DELAYS_MS.length - 1)
    ];
  const random = input.random ?? Math.random;
  const jitter = (random() * 2 - 1) * JITTER_RATIO;
  return new Date(input.now.getTime() + Math.round(base * (1 + jitter)));
}

async function translateWithTimeout(input: {
  provider: TranslationProvider;
  request: Parameters<TranslationProvider["translate"]>[0];
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    return await input.provider.translate({
      ...input.request,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function runBounded<T>(
  items: T[],
  concurrency: number,
  operation: (item: T) => Promise<void>
) {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      await operation(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
}

export async function getTranslationWorkerDryRun(
  database: TranslationDatabase,
  now = new Date()
) {
  const repository = createTranslationWorkerRepository(database);
  return {
    eligible: await repository.countEligible(now),
    dryRun: true as const,
  };
}

export async function processTranslationJobs(input: {
  database: TranslationDatabase;
  provider: TranslationProvider;
  config: TranslationWorkerConfig;
  now?: () => Date;
  random?: () => number;
  logger?: WorkerLogger;
}) {
  if (!input.config.enabled) {
    throw new Error("Translation worker is disabled.");
  }
  const startedAt = (input.now ?? (() => new Date()))();
  const repository = createTranslationWorkerRepository(input.database);
  const workerId = `${input.config.workerIdPrefix}-${randomUUID()}`;
  const log: WorkerLogger = input.logger ?? (() => undefined);
  const recovery = await repository.recoverStaleLocks({
    now: startedAt,
    lockTimeoutMs: input.config.lockTimeoutMs,
    limit: input.config.batchSize,
  });
  const eligible = await repository.countEligible(startedAt);
  const claimed = await repository.claimEligible({
    workerId,
    limit: input.config.batchSize,
    now: startedAt,
  });
  const summary: TranslationWorkerSummary = {
    eligible,
    claimed: claimed.length,
    succeeded: 0,
    retried: 0,
    failed: 0,
    cancelled: 0,
    skippedProtected: 0,
    skippedObsolete: 0,
    configurationErrors: 0,
    staleLocksRecovered: recovery.recovered,
    durationMs: 0,
  };

  async function processClaim(job: ClaimedTranslationJob) {
    const jobStarted = Date.now();
    const context = await repository.loadClaimedContext({
      jobId: job.jobId,
      workerId,
    });
    if (!context) {
      summary.cancelled += 1;
      return;
    }
    const protectedTranslation =
      context.protectedFromAutomation ||
      (context.origin === "manual" && !context.regenerationAuthorizedAt);
    const obsolete =
      !context.sourceExists ||
      !context.sourceText ||
      context.translationStatus !== "processing" ||
      computeContextSourceHash(context) !== context.sourceHash;
    if (protectedTranslation || obsolete) {
      await repository.cancelClaimed({
        jobId: job.jobId,
        workerId,
        now: (input.now ?? (() => new Date()))(),
      });
      summary.cancelled += 1;
      if (protectedTranslation) summary.skippedProtected += 1;
      else summary.skippedObsolete += 1;
      log("translation_job_cancelled", {
        jobId: job.jobId,
        translationId: job.translationId,
        entityType: context.entityType,
        fieldKey: context.fieldKey,
        attempt: job.attempts,
        result: protectedTranslation ? "protected" : "obsolete",
        durationMs: Date.now() - jobStarted,
      });
      return;
    }

    try {
      const result = validateProviderResult(
        await translateWithTimeout({
          provider: input.provider,
          timeoutMs: input.config.requestTimeoutMs,
          request: {
            sourceLocale: "es-PR",
            targetLocale: context.targetLocale,
            entityType: context.entityType,
            fieldKey: context.fieldKey,
            sourceText: context.sourceText,
            correlationId: job.jobId,
          },
        })
      );
      const completed = await repository.completeSuccess({
        jobId: job.jobId,
        workerId,
        sourceHash: context.sourceHash,
        translatedText: result.translatedText,
        providerId: result.providerId,
        providerModel: result.providerModel,
        providerVersion: result.providerVersion,
        now: (input.now ?? (() => new Date()))(),
      });
      if (!completed) {
        await repository.cancelClaimed({
          jobId: job.jobId,
          workerId,
          now: (input.now ?? (() => new Date()))(),
        });
        summary.cancelled += 1;
        summary.skippedObsolete += 1;
        return;
      }
      summary.succeeded += 1;
      log("translation_job_succeeded", {
        jobId: job.jobId,
        translationId: job.translationId,
        entityType: context.entityType,
        fieldKey: context.fieldKey,
        attempt: job.attempts,
        provider: result.providerId,
        durationMs: Date.now() - jobStarted,
      });
    } catch (error) {
      const failure = classifyTranslationProviderError(error);
      const now = (input.now ?? (() => new Date()))();
      const retry =
        failure.kind === "retryable" && job.attempts < job.maxAttempts;
      await repository.completeFailure({
        jobId: job.jobId,
        workerId,
        retry,
        availableAt: retry
          ? calculateTranslationRetryAt({
              attempt: job.attempts,
              now,
              random: input.random,
            })
          : now,
        errorCode: failure.code,
        errorMessage: failure.message,
        now,
      });
      if (retry) summary.retried += 1;
      else summary.failed += 1;
      if (failure.kind === "configuration") summary.configurationErrors += 1;
      log("translation_job_failed", {
        jobId: job.jobId,
        translationId: job.translationId,
        entityType: context.entityType,
        fieldKey: context.fieldKey,
        attempt: job.attempts,
        result: retry ? "retry" : "failed",
        errorCode: failure.code,
        durationMs: Date.now() - jobStarted,
      });
    }
  }

  await runBounded(claimed, input.config.concurrency, processClaim);
  summary.durationMs = Date.now() - startedAt.getTime();
  return summary;
}
