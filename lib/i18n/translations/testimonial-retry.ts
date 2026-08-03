import { hashTestimonialTranslationSource } from "@/lib/i18n/translations/hash";
import {
  isProductionDatabaseConfiguration,
  PRODUCTION_READ_ONLY_DRY_RUN_FLAG,
} from "@/lib/i18n/translations/cli-safety";
import type {
  TranslationDatabase,
  TranslationQueryExecutor,
} from "@/lib/i18n/translations/repository";

export const PRODUCTION_SINGLE_TESTIMONIAL_RETRY_FLAG =
  "--allow-production-single-testimonial-retry";
export const PROVIDER_EMPTY_RESULT_RETRY_CONFIRMATION_FLAG =
  "--confirm-existing-provider-empty-result-job";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RuntimeEnvironment = Partial<
  Pick<
    NodeJS.ProcessEnv,
    | "VERCEL_ENV"
    | "NODE_ENV"
    | "TRANSLATION_WORKER_ENABLED"
    | "MULTILINGUAL_ENABLED"
  >
>;

export type TestimonialRetryCliOptions = {
  testimonialId: string;
  apply: boolean;
  confirmedLocal: boolean;
  allowProductionReadOnlyDryRun: boolean;
  allowProductionSingleRetry: boolean;
  confirmedProviderEmptyResultJob: boolean;
};

export type TestimonialRetryInspection = {
  eligible: boolean;
  entityCount: 1;
  fieldCount: 1;
  existingTranslationRows: number;
  newTranslationRowsWouldCreate: 0;
  failedJobsMatched: number;
  activeJobsPresent: boolean;
  jobsWouldRequeue: 0 | 1;
  replacementJobsWouldCreate: 0;
  revisionEventsWouldCreate: 0 | 1;
  writesApplied: 0;
  providerCalled: false;
};

type SourceRow = { id: string; body: string };
type TranslationRow = {
  id: string;
  source_hash: string;
  translated_source_hash: string | null;
  translated_value: string | null;
  status: string;
  origin: string;
  review_status: string;
  protected_from_automation: boolean;
  regeneration_authorized_at: string | Date | null;
};
type JobRow = {
  id: string;
  source_hash: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error_code: string | null;
};

export class TestimonialRetryError extends Error {
  constructor(readonly safeCode: string) {
    super(safeCode);
    this.name = "TestimonialRetryError";
  }
}

function fail(code: string): never {
  throw new TestimonialRetryError(code);
}

export function parseTestimonialRetryCliArgs(
  args: string[]
): TestimonialRetryCliOptions {
  let testimonialId: string | null = null;
  let apply = false;
  let explicitDryRun = false;
  let confirmedLocal = false;
  let allowProductionReadOnlyDryRun = false;
  let allowProductionSingleRetry = false;
  let confirmedProviderEmptyResultJob = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--testimonial-id") {
      if (testimonialId !== null) fail("testimonial_id_supplied_more_than_once");
      const value = args[index + 1];
      if (!value || value.startsWith("--")) fail("testimonial_id_required");
      testimonialId = value;
      index += 1;
    } else if (argument.startsWith("--testimonial-id=")) {
      if (testimonialId !== null) fail("testimonial_id_supplied_more_than_once");
      testimonialId = argument.slice("--testimonial-id=".length);
    } else if (argument === "--apply") {
      apply = true;
    } else if (argument === "--dry-run") {
      explicitDryRun = true;
    } else if (argument === "--confirm-local") {
      confirmedLocal = true;
    } else if (argument === PRODUCTION_READ_ONLY_DRY_RUN_FLAG) {
      allowProductionReadOnlyDryRun = true;
    } else if (argument === PRODUCTION_SINGLE_TESTIMONIAL_RETRY_FLAG) {
      allowProductionSingleRetry = true;
    } else if (argument === PROVIDER_EMPTY_RESULT_RETRY_CONFIRMATION_FLAG) {
      confirmedProviderEmptyResultJob = true;
    } else {
      fail("unsupported_argument");
    }
  }

  if (!testimonialId) fail("testimonial_id_required");
  if (!UUID_PATTERN.test(testimonialId)) fail("testimonial_id_invalid");
  if (apply && explicitDryRun) fail("conflicting_modes");
  if (apply && allowProductionReadOnlyDryRun) fail("conflicting_production_flags");
  if (
    !apply &&
    (allowProductionSingleRetry || confirmedProviderEmptyResultJob)
  ) {
    fail("apply_confirmation_without_apply");
  }

  return {
    testimonialId: testimonialId.toLowerCase(),
    apply,
    confirmedLocal,
    allowProductionReadOnlyDryRun,
    allowProductionSingleRetry,
    confirmedProviderEmptyResultJob,
  };
}

export function assertTestimonialRetryCliIsSafe(input: {
  databaseUrl: string;
  options: TestimonialRetryCliOptions;
  environment?: RuntimeEnvironment;
}) {
  const environment = input.environment ?? process.env;
  const production = isProductionDatabaseConfiguration({
    databaseUrl: input.databaseUrl,
    environment,
  });
  const url = new URL(input.databaseUrl);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

  if (!input.options.apply) {
    if (production && !input.options.allowProductionReadOnlyDryRun) {
      fail("production_dry_run_confirmation_required");
    }
    return { productionReadOnlyDryRun: production };
  }

  if (production) {
    if (!input.options.allowProductionSingleRetry) {
      fail("production_single_retry_authorization_required");
    }
    if (!input.options.confirmedProviderEmptyResultJob) {
      fail("provider_empty_result_confirmation_required");
    }
    if (environment.TRANSLATION_WORKER_ENABLED !== "false") {
      fail("worker_must_be_explicitly_disabled");
    }
    if (environment.MULTILINGUAL_ENABLED !== "false") {
      fail("multilingual_mode_must_be_explicitly_disabled");
    }
    return { productionApply: true };
  }

  if (environment.TRANSLATION_WORKER_ENABLED === "true") {
    fail("worker_must_be_disabled");
  }
  if (environment.MULTILINGUAL_ENABLED === "true") {
    fail("multilingual_mode_must_be_disabled");
  }
  if (!input.options.confirmedLocal || !localHosts.has(url.hostname)) {
    fail("local_apply_confirmation_required");
  }
  return { productionApply: false };
}

async function loadState(
  executor: TranslationQueryExecutor,
  testimonialId: string,
  lock: boolean
) {
  const sources = await executor.unsafe<SourceRow>(
    `SELECT id::text, texto AS body
       FROM public.testimonios
      WHERE id = $1::uuid
      ${lock ? "FOR UPDATE" : ""}`,
    [testimonialId]
  );
  const source = sources[0];
  if (!source) fail("testimonial_not_found");
  if (!source.body.trim()) fail("testimonial_body_empty");

  const translations = await executor.unsafe<TranslationRow>(
    `SELECT id::text, source_hash, translated_source_hash, translated_value,
            status, origin, review_status, protected_from_automation,
            regeneration_authorized_at
       FROM public.content_translations
      WHERE testimonial_id = $1::uuid
        AND property_id IS NULL
        AND target_locale = 'en-US'
        AND field_key = 'body'
      ${lock ? "FOR UPDATE" : ""}`,
    [testimonialId]
  );
  const translation = translations[0] ?? null;
  const jobs = translation
    ? await executor.unsafe<JobRow>(
        `SELECT id::text, source_hash, status, attempts, max_attempts,
                last_error_code
           FROM public.translation_jobs
          WHERE translation_id = $1::uuid
          ORDER BY created_at, id
          ${lock ? "FOR UPDATE" : ""}`,
        [translation.id]
      )
    : [];
  return { source, translations, translation, jobs };
}

function inspectLoadedState(
  state: Awaited<ReturnType<typeof loadState>>
): TestimonialRetryInspection {
  const currentHash = hashTestimonialTranslationSource(
    "body",
    state.source.body
  );
  const activeJobs = state.jobs.filter((job) =>
    ["queued", "processing"].includes(job.status)
  );
  const failedJobs = state.jobs.filter(
    (job) =>
      job.status === "failed" &&
      job.source_hash === currentHash &&
      job.last_error_code === "provider_empty_result" &&
      job.attempts < job.max_attempts
  );
  const translation = state.translation;
  const eligible =
    state.translations.length === 1 &&
    translation !== null &&
    translation.source_hash === currentHash &&
    translation.translated_source_hash === null &&
    !translation.translated_value?.trim() &&
    translation.status === "failed" &&
    translation.origin === "machine" &&
    translation.review_status === "unreviewed" &&
    translation.protected_from_automation === false &&
    translation.regeneration_authorized_at === null &&
    activeJobs.length === 0 &&
    failedJobs.length === 1;

  return {
    eligible,
    entityCount: 1,
    fieldCount: 1,
    existingTranslationRows: state.translations.length,
    newTranslationRowsWouldCreate: 0,
    failedJobsMatched: failedJobs.length,
    activeJobsPresent: activeJobs.length > 0,
    jobsWouldRequeue: eligible ? 1 : 0,
    replacementJobsWouldCreate: 0,
    revisionEventsWouldCreate: eligible ? 1 : 0,
    writesApplied: 0,
    providerCalled: false,
  };
}

export async function inspectSingleTestimonialFailedJobRetry(
  database: TranslationQueryExecutor,
  testimonialId: string
) {
  return inspectLoadedState(await loadState(database, testimonialId, false));
}

export async function applySingleTestimonialFailedJobRetry(
  database: TranslationDatabase,
  testimonialId: string
) {
  return database.begin(async (transaction) => {
    const state = await loadState(transaction, testimonialId, true);
    const inspection = inspectLoadedState(state);
    if (!inspection.eligible || !state.translation) {
      fail("testimonial_retry_not_eligible");
    }
    const currentHash = hashTestimonialTranslationSource(
      "body",
      state.source.body
    );
    const failedJob = state.jobs.find(
      (job) =>
        job.status === "failed" &&
        job.source_hash === currentHash &&
        job.last_error_code === "provider_empty_result" &&
        job.attempts < job.max_attempts
    );
    if (!failedJob) fail("provider_empty_result_job_not_found");

    const translationRows = await transaction.unsafe<{ id: string }>(
      `UPDATE public.content_translations
          SET status = 'pending',
              lock_version = lock_version + 1,
              updated_at = now()
        WHERE id = $1::uuid
          AND source_hash = $2
          AND status = 'failed'
          AND translated_value IS NULL
          AND translated_source_hash IS NULL
          AND origin = 'machine'
          AND review_status = 'unreviewed'
          AND protected_from_automation = false
          AND regeneration_authorized_at IS NULL
        RETURNING id::text`,
      [state.translation.id, currentHash]
    );
    if (translationRows.length !== 1) fail("translation_retry_race");

    const jobRows = await transaction.unsafe<{ id: string }>(
      `UPDATE public.translation_jobs
          SET status = 'queued',
              available_at = now(),
              locked_at = NULL,
              locked_by = NULL,
              started_at = NULL,
              completed_at = NULL,
              provider = NULL,
              provider_model = NULL,
              provider_version = NULL,
              last_error_code = NULL,
              last_error_message = NULL,
              updated_at = now()
        WHERE id = $1::uuid
          AND translation_id = $2::uuid
          AND source_hash = $3
          AND status = 'failed'
          AND last_error_code = 'provider_empty_result'
          AND attempts < max_attempts
        RETURNING id::text`,
      [failedJob.id, state.translation.id, currentHash]
    );
    if (jobRows.length !== 1) fail("job_retry_race");

    await transaction.unsafe(
      `INSERT INTO public.translation_revision_events (
         translation_id, job_id, event_type,
         previous_source_hash, new_source_hash,
         previous_translated_source_hash, new_translated_source_hash,
         previous_status, new_status
       ) VALUES (
         $1::uuid, $2::uuid, 'job_queued',
         $3, $3, NULL, NULL, 'failed', 'pending'
       )`,
      [state.translation.id, failedJob.id, currentHash]
    );

    return {
      eligible: true,
      entityCount: 1 as const,
      fieldCount: 1 as const,
      translationRowsCreated: 0 as const,
      jobsRequeued: 1 as const,
      replacementJobsCreated: 0 as const,
      revisionEventsCreated: 1 as const,
      writesApplied: 3 as const,
      providerCalled: false as const,
    };
  });
}

export function safeTestimonialRetryErrorCode(error: unknown) {
  return error instanceof TestimonialRetryError
    ? error.safeCode
    : "testimonial_retry_failed";
}
