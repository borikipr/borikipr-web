import type {
  TranslationDatabase,
  TranslationQueryExecutor,
} from "@/lib/i18n/translations/repository";
import type { TranslationUsageProviderId } from "@/lib/i18n/translations/provider";

export const TRANSLATION_USAGE_LIMITS = Object.freeze({
  dailyCharacters: 10_000,
  monthlyCharacters: 250_000,
  dailyAttempts: 20,
  monthlyAttempts: 100,
  maximumSourceCharacters: 5_000,
  productionBatchSize: 1,
  productionConcurrency: 1,
  maximumAutomaticAttempts: 2,
});

export type TranslationBudgetReason =
  | "daily_characters"
  | "monthly_characters"
  | "daily_attempts"
  | "monthly_attempts"
  | "source_too_large"
  | "usage_unavailable";

export class TranslationUsageBudgetError extends Error {
  constructor(
    readonly reason: TranslationBudgetReason,
    readonly retryAt: Date | null,
    message: string
  ) {
    super(message);
    this.name = "TranslationUsageBudgetError";
  }
}

type UsageRow = {
  attempted_characters: string | number;
  provider_attempts: string | number;
};

function utcDayStart(now: Date) {
  return now.toISOString().slice(0, 10);
}

function utcMonthStart(now: Date) {
  return `${now.toISOString().slice(0, 7)}-01`;
}

function nextUtcDay(now: Date) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
}

function nextUtcMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

async function reserveBucket(
  transaction: TranslationQueryExecutor,
  input: {
    provider: TranslationUsageProviderId;
    periodKind: "day" | "month";
    periodStart: string;
    characters: number;
    characterCap: number;
    attemptCap: number;
    now: Date;
    retryAt: Date;
  }
) {
  const current = await transaction.unsafe<UsageRow>(
    `SELECT
       COALESCE(SUM(attempted_characters), 0) AS attempted_characters,
       COALESCE(SUM(provider_attempts), 0) AS provider_attempts
       FROM public.translation_provider_usage_buckets
      WHERE period_kind = $1 AND period_start = $2::date`,
    [input.periodKind, input.periodStart]
  );
  const characters = Number(current[0]?.attempted_characters ?? 0);
  const attempts = Number(current[0]?.provider_attempts ?? 0);
  const period = input.periodKind === "day" ? "daily" : "monthly";
  const reason: TranslationBudgetReason | null =
    characters + input.characters > input.characterCap
      ? `${period}_characters`
      : attempts + 1 > input.attemptCap
        ? `${period}_attempts`
        : null;
  if (reason) {
    throw new TranslationUsageBudgetError(
      reason,
      input.retryAt,
      "Translation usage limit reached."
    );
  }

  await transaction.unsafe<UsageRow>(
    `INSERT INTO public.translation_provider_usage_buckets (
       provider, period_kind, period_start,
       attempted_characters, provider_attempts, updated_at
     ) VALUES ($1, $2, $3::date, $4, 1, $5::timestamptz)
     ON CONFLICT (provider, period_kind, period_start)
     DO UPDATE SET
       attempted_characters = translation_provider_usage_buckets.attempted_characters
         + EXCLUDED.attempted_characters,
       provider_attempts = translation_provider_usage_buckets.provider_attempts + 1,
       updated_at = EXCLUDED.updated_at
     RETURNING attempted_characters, provider_attempts`,
    [
      input.provider,
      input.periodKind,
      input.periodStart,
      input.characters,
      input.now.toISOString(),
    ]
  );
}

export function countUnicodeCharacters(value: string) {
  return [...value].length;
}

export async function reserveTranslationProviderUsage(
  database: TranslationDatabase,
  input: {
    provider: TranslationUsageProviderId;
    sourceText: string;
    now: Date;
  }
) {
  const characters = countUnicodeCharacters(input.sourceText);
  if (characters > TRANSLATION_USAGE_LIMITS.maximumSourceCharacters) {
    throw new TranslationUsageBudgetError(
      "source_too_large",
      null,
      "Translation source exceeds the approved character limit."
    );
  }
  if (characters <= 0) {
    throw new TranslationUsageBudgetError(
      "usage_unavailable",
      null,
      "Translation source length is invalid."
    );
  }

  try {
    await database.begin(async (transaction) => {
      await transaction.unsafe(
        "SELECT pg_advisory_xact_lock(2401001)"
      );
      await reserveBucket(transaction, {
        provider: input.provider,
        periodKind: "day",
        periodStart: utcDayStart(input.now),
        characters,
        characterCap: TRANSLATION_USAGE_LIMITS.dailyCharacters,
        attemptCap: TRANSLATION_USAGE_LIMITS.dailyAttempts,
        now: input.now,
        retryAt: nextUtcDay(input.now),
      });
      await reserveBucket(transaction, {
        provider: input.provider,
        periodKind: "month",
        periodStart: utcMonthStart(input.now),
        characters,
        characterCap: TRANSLATION_USAGE_LIMITS.monthlyCharacters,
        attemptCap: TRANSLATION_USAGE_LIMITS.monthlyAttempts,
        now: input.now,
        retryAt: nextUtcMonth(input.now),
      });
    });
  } catch (error) {
    if (error instanceof TranslationUsageBudgetError) throw error;
    throw new TranslationUsageBudgetError(
      "usage_unavailable",
      new Date(input.now.getTime() + 15 * 60_000),
      "Translation usage accounting is unavailable."
    );
  }
  return { characters, attempts: 1 } as const;
}

export type TranslationUsageStatus = {
  available: boolean;
  charactersToday: number;
  charactersMonth: number;
  attemptsToday: number;
  attemptsMonth: number;
  queuedJobs: number;
  processingJobs: number;
  failedJobs: number;
  pausedByBudgetJobs: number;
};

export async function getTranslationUsageStatus(
  database: TranslationDatabase,
  now = new Date()
): Promise<TranslationUsageStatus> {
  const rows = await database.unsafe<{
    characters_today: string | number;
    characters_month: string | number;
    attempts_today: string | number;
    attempts_month: string | number;
    queued_jobs: string | number;
    processing_jobs: string | number;
    failed_jobs: string | number;
    paused_jobs: string | number;
  }>(
    `SELECT
       COALESCE((SELECT attempted_characters
         FROM (SELECT SUM(attempted_characters) AS attempted_characters
                 FROM public.translation_provider_usage_buckets
                WHERE period_kind = 'day' AND period_start = $1::date) usage_day), 0) AS characters_today,
       COALESCE((SELECT attempted_characters
         FROM (SELECT SUM(attempted_characters) AS attempted_characters
                 FROM public.translation_provider_usage_buckets
                WHERE period_kind = 'month' AND period_start = $2::date) usage_month), 0) AS characters_month,
       COALESCE((SELECT provider_attempts
         FROM (SELECT SUM(provider_attempts) AS provider_attempts
                 FROM public.translation_provider_usage_buckets
                WHERE period_kind = 'day' AND period_start = $1::date) attempts_day), 0) AS attempts_today,
       COALESCE((SELECT provider_attempts
         FROM (SELECT SUM(provider_attempts) AS provider_attempts
                 FROM public.translation_provider_usage_buckets
                WHERE period_kind = 'month' AND period_start = $2::date) attempts_month), 0) AS attempts_month,
       COUNT(*) FILTER (WHERE status = 'queued') AS queued_jobs,
       COUNT(*) FILTER (WHERE status = 'processing') AS processing_jobs,
       COUNT(*) FILTER (WHERE status = 'failed') AS failed_jobs,
       COUNT(*) FILTER (
         WHERE status = 'queued' AND last_error_code LIKE 'translation_budget_%'
       ) AS paused_jobs
     FROM public.translation_jobs`,
    [utcDayStart(now), utcMonthStart(now)]
  );
  const row = rows[0];
  return {
    available: true,
    charactersToday: Number(row?.characters_today ?? 0),
    charactersMonth: Number(row?.characters_month ?? 0),
    attemptsToday: Number(row?.attempts_today ?? 0),
    attemptsMonth: Number(row?.attempts_month ?? 0),
    queuedJobs: Number(row?.queued_jobs ?? 0),
    processingJobs: Number(row?.processing_jobs ?? 0),
    failedJobs: Number(row?.failed_jobs ?? 0),
    pausedByBudgetJobs: Number(row?.paused_jobs ?? 0),
  };
}
