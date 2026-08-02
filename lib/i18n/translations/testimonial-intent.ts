import { hashTestimonialTranslationSource } from "@/lib/i18n/translations/hash";
import {
  isProductionDatabaseConfiguration,
  PRODUCTION_READ_ONLY_DRY_RUN_FLAG,
} from "@/lib/i18n/translations/cli-safety";
import type {
  TranslationDatabase,
  TranslationQueryExecutor,
} from "@/lib/i18n/translations/repository";
import { syncTestimonialTranslationIntent } from "@/lib/i18n/translations/source-intents";

export const PRODUCTION_SINGLE_TESTIMONIAL_INTENT_FLAG =
  "--allow-production-single-testimonial-intent";
export const SINGLE_TESTIMONIAL_CONFIRMATION_FLAG =
  "--confirm-exactly-one-testimonial-body";

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

export type TestimonialIntentCliOptions = {
  testimonialId: string;
  apply: boolean;
  confirmedLocal: boolean;
  allowProductionReadOnlyDryRun: boolean;
  allowProductionSingleIntent: boolean;
  confirmedExactlyOneBody: boolean;
};

export type TestimonialIntentState =
  | "missing"
  | "current"
  | "stale"
  | "manual"
  | "reviewed"
  | "protected"
  | "active_job";

export type TestimonialIntentInspection = {
  eligible: boolean;
  entityCount: 1;
  fieldCount: 1;
  existingTranslationState: TestimonialIntentState;
  activeJobPresent: boolean;
  rowsWouldCreate: 0 | 1;
  jobsWouldQueue: 0 | 1;
  revisionEventsWouldCreate: 0 | 2;
  writesApplied: 0;
  providerCalled: false;
};

type TestimonialSourceRow = {
  id: string;
  body: string;
  active: boolean;
};

type ExistingTranslationRow = {
  id: string;
  source_hash: string;
  status: string;
  origin: "machine" | "manual";
  review_status: "unreviewed" | "reviewed";
  protected_from_automation: boolean;
};

export class TestimonialIntentError extends Error {
  constructor(readonly safeCode: string) {
    super(safeCode);
    this.name = "TestimonialIntentError";
  }
}

function fail(code: string): never {
  throw new TestimonialIntentError(code);
}

export function parseTestimonialIntentCliArgs(
  args: string[]
): TestimonialIntentCliOptions {
  let testimonialId: string | null = null;
  let apply = false;
  let explicitDryRun = false;
  let confirmedLocal = false;
  let allowProductionReadOnlyDryRun = false;
  let allowProductionSingleIntent = false;
  let confirmedExactlyOneBody = false;

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
    } else if (argument === PRODUCTION_SINGLE_TESTIMONIAL_INTENT_FLAG) {
      allowProductionSingleIntent = true;
    } else if (argument === SINGLE_TESTIMONIAL_CONFIRMATION_FLAG) {
      confirmedExactlyOneBody = true;
    } else {
      fail("unsupported_argument");
    }
  }

  if (!testimonialId) fail("testimonial_id_required");
  if (!UUID_PATTERN.test(testimonialId)) fail("testimonial_id_invalid");
  if (apply && explicitDryRun) fail("conflicting_modes");
  if (apply && allowProductionReadOnlyDryRun) fail("conflicting_production_flags");
  if (!apply && (allowProductionSingleIntent || confirmedExactlyOneBody)) {
    fail("apply_confirmation_without_apply");
  }

  return {
    testimonialId: testimonialId.toLowerCase(),
    apply,
    confirmedLocal,
    allowProductionReadOnlyDryRun,
    allowProductionSingleIntent,
    confirmedExactlyOneBody,
  };
}

export function assertTestimonialIntentCliIsSafe(input: {
  databaseUrl: string;
  options: TestimonialIntentCliOptions;
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
    if (!input.options.allowProductionSingleIntent) {
      fail("production_single_intent_authorization_required");
    }
    if (!input.options.confirmedExactlyOneBody) {
      fail("exactly_one_body_confirmation_required");
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

async function readSource(
  executor: TranslationQueryExecutor,
  testimonialId: string,
  lock: boolean
) {
  const rows = await executor.unsafe<TestimonialSourceRow>(
    `SELECT id::text, texto AS body, activo AS active
       FROM public.testimonios
      WHERE id = $1::uuid
      ${lock ? "FOR UPDATE" : ""}`,
    [testimonialId]
  );
  const source = rows[0];
  if (!source) fail("testimonial_not_found");
  if (!source.body.trim()) fail("testimonial_body_empty");
  return source;
}

async function inspectWithinExecutor(
  executor: TranslationQueryExecutor,
  testimonialId: string,
  lock: boolean
): Promise<{
  source: TestimonialSourceRow;
  translation: ExistingTranslationRow | null;
  inspection: TestimonialIntentInspection;
}> {
  const source = await readSource(executor, testimonialId, lock);
  const translations = await executor.unsafe<ExistingTranslationRow>(
    `SELECT id::text, source_hash, status, origin, review_status,
            protected_from_automation
       FROM public.content_translations
      WHERE testimonial_id = $1::uuid
        AND target_locale = 'en-US'
        AND field_key = 'body'
      ${lock ? "FOR UPDATE" : ""}`,
    [testimonialId]
  );
  const translation = translations[0] ?? null;
  let activeJobPresent = false;
  if (translation) {
    const jobs = await executor.unsafe<{ active: boolean }>(
      `SELECT EXISTS (
         SELECT 1
           FROM public.translation_jobs
          WHERE translation_id = $1::uuid
            AND status IN ('queued', 'processing')
       ) AS active`,
      [translation.id]
    );
    activeJobPresent = jobs[0]?.active === true;
  }

  const currentHash = hashTestimonialTranslationSource("body", source.body);
  let state: TestimonialIntentState = "missing";
  if (activeJobPresent) state = "active_job";
  else if (translation?.origin === "manual") state = "manual";
  else if (translation?.review_status === "reviewed") state = "reviewed";
  else if (translation?.protected_from_automation) state = "protected";
  else if (translation?.source_hash === currentHash) state = "current";
  else if (translation) state = "stale";

  const eligible = state === "missing" || state === "stale";
  return {
    source,
    translation,
    inspection: {
      eligible,
      entityCount: 1,
      fieldCount: 1,
      existingTranslationState: state,
      activeJobPresent,
      rowsWouldCreate: eligible && !translation ? 1 : 0,
      jobsWouldQueue: eligible ? 1 : 0,
      revisionEventsWouldCreate: eligible ? 2 : 0,
      writesApplied: 0,
      providerCalled: false,
    },
  };
}

export async function inspectSingleTestimonialTranslationIntent(
  database: TranslationQueryExecutor,
  testimonialId: string
) {
  return (await inspectWithinExecutor(database, testimonialId, false)).inspection;
}

async function scopedCounts(
  executor: TranslationQueryExecutor,
  testimonialId: string
) {
  const rows = await executor.unsafe<{
    translations: number;
    jobs: number;
    events: number;
  }>(
    `SELECT
       (SELECT count(*)::int
          FROM public.content_translations
         WHERE testimonial_id = $1::uuid
           AND target_locale = 'en-US'
           AND field_key = 'body') AS translations,
       (SELECT count(*)::int
          FROM public.translation_jobs tj
          JOIN public.content_translations ct ON ct.id = tj.translation_id
         WHERE ct.testimonial_id = $1::uuid
           AND ct.target_locale = 'en-US'
           AND ct.field_key = 'body') AS jobs,
       (SELECT count(*)::int
          FROM public.translation_revision_events tre
          JOIN public.content_translations ct ON ct.id = tre.translation_id
         WHERE ct.testimonial_id = $1::uuid
           AND ct.target_locale = 'en-US'
           AND ct.field_key = 'body') AS events`,
    [testimonialId]
  );
  return rows[0];
}

export async function applySingleTestimonialTranslationIntent(
  database: TranslationDatabase,
  testimonialId: string
) {
  return database.begin(async (transaction) => {
    const before = await inspectWithinExecutor(transaction, testimonialId, true);
    if (!before.inspection.eligible) {
      fail(`testimonial_intent_not_eligible_${before.inspection.existingTranslationState}`);
    }
    const countsBefore = await scopedCounts(transaction, testimonialId);
    const result = await syncTestimonialTranslationIntent(transaction, {
      testimonialId,
      body: before.source.body,
      active: before.source.active,
    });
    const countsAfter = await scopedCounts(transaction, testimonialId);
    const translationsCreated = countsAfter.translations - countsBefore.translations;
    const jobsCreated = countsAfter.jobs - countsBefore.jobs;
    const revisionEventsCreated = countsAfter.events - countsBefore.events;
    const expectedTranslations = before.translation ? 0 : 1;

    if (
      result.fieldKey !== "body" ||
      !result.jobQueued ||
      !["created", "changed"].includes(result.outcome) ||
      translationsCreated !== expectedTranslations ||
      jobsCreated !== 1 ||
      revisionEventsCreated !== 2
    ) {
      fail("testimonial_intent_cardinality_mismatch");
    }

    return {
      eligible: true,
      entityCount: 1 as const,
      fieldCount: 1 as const,
      translationsCreated,
      jobsCreated,
      revisionEventsCreated,
      writesApplied:
        translationsCreated + jobsCreated + revisionEventsCreated,
      providerCalled: false as const,
    };
  });
}

export function safeTestimonialIntentErrorCode(error: unknown) {
  return error instanceof TestimonialIntentError
    ? error.safeCode
    : "testimonial_intent_failed";
}
