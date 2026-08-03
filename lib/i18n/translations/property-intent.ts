import {
  isProductionDatabaseConfiguration,
  PRODUCTION_READ_ONLY_DRY_RUN_FLAG,
} from "@/lib/i18n/translations/cli-safety";
import type {
  TranslationDatabase,
  TranslationQueryExecutor,
} from "@/lib/i18n/translations/repository";
import { syncPropertyTranslationIntents } from "@/lib/i18n/translations/source-intents";

export const PRODUCTION_SINGLE_PROPERTY_INTENT_FLAG =
  "--allow-production-single-property-intent";
export const SINGLE_PROPERTY_CONFIRMATION_FLAG =
  "--confirm-exactly-one-property-title-and-description";

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

export type PropertyIntentCliOptions = {
  propertyId: string;
  apply: boolean;
  confirmedLocal: boolean;
  allowProductionReadOnlyDryRun: boolean;
  allowProductionSingleIntent: boolean;
  confirmedExactlyTwoFields: boolean;
};

export class PropertyIntentError extends Error {
  constructor(readonly safeCode: string) {
    super(safeCode);
    this.name = "PropertyIntentError";
  }
}

function fail(code: string): never {
  throw new PropertyIntentError(code);
}

export function parsePropertyIntentCliArgs(args: string[]): PropertyIntentCliOptions {
  let propertyId: string | null = null;
  let apply = false;
  let explicitDryRun = false;
  let confirmedLocal = false;
  let allowProductionReadOnlyDryRun = false;
  let allowProductionSingleIntent = false;
  let confirmedExactlyTwoFields = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--property-id") {
      if (propertyId !== null) fail("property_id_supplied_more_than_once");
      const value = args[index + 1];
      if (!value || value.startsWith("--")) fail("property_id_required");
      propertyId = value;
      index += 1;
    } else if (argument.startsWith("--property-id=")) {
      if (propertyId !== null) fail("property_id_supplied_more_than_once");
      propertyId = argument.slice("--property-id=".length);
    } else if (argument === "--apply") {
      apply = true;
    } else if (argument === "--dry-run") {
      explicitDryRun = true;
    } else if (argument === "--confirm-local") {
      confirmedLocal = true;
    } else if (argument === PRODUCTION_READ_ONLY_DRY_RUN_FLAG) {
      allowProductionReadOnlyDryRun = true;
    } else if (argument === PRODUCTION_SINGLE_PROPERTY_INTENT_FLAG) {
      allowProductionSingleIntent = true;
    } else if (argument === SINGLE_PROPERTY_CONFIRMATION_FLAG) {
      confirmedExactlyTwoFields = true;
    } else {
      fail("unsupported_argument");
    }
  }

  if (!propertyId) fail("property_id_required");
  if (!UUID_PATTERN.test(propertyId)) fail("property_id_invalid");
  if (apply && explicitDryRun) fail("conflicting_modes");
  if (apply && allowProductionReadOnlyDryRun) fail("conflicting_production_flags");
  if (!apply && (allowProductionSingleIntent || confirmedExactlyTwoFields)) {
    fail("apply_confirmation_without_apply");
  }

  return {
    propertyId: propertyId.toLowerCase(),
    apply,
    confirmedLocal,
    allowProductionReadOnlyDryRun,
    allowProductionSingleIntent,
    confirmedExactlyTwoFields,
  };
}

export function assertPropertyIntentCliIsSafe(input: {
  databaseUrl: string;
  options: PropertyIntentCliOptions;
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
    if (!input.options.confirmedExactlyTwoFields) {
      fail("exactly_two_fields_confirmation_required");
    }
    if (environment.TRANSLATION_WORKER_ENABLED !== "false") {
      fail("worker_must_be_explicitly_disabled");
    }
    if (environment.MULTILINGUAL_ENABLED !== "false") {
      fail("multilingual_mode_must_be_explicitly_disabled");
    }
    return { productionApply: true };
  }

  if (environment.TRANSLATION_WORKER_ENABLED === "true") fail("worker_must_be_disabled");
  if (environment.MULTILINGUAL_ENABLED === "true") fail("multilingual_mode_must_be_disabled");
  if (!input.options.confirmedLocal || !localHosts.has(url.hostname)) {
    fail("local_apply_confirmation_required");
  }
  return { productionApply: false };
}

type PropertySource = {
  id: string;
  title: string;
  description: string;
  highlighted: boolean;
};

async function inspect(
  executor: TranslationQueryExecutor,
  propertyId: string,
  lock: boolean
) {
  const sources = await executor.unsafe<PropertySource>(
    `SELECT id::text, titulo AS title, descripcion AS description,
            destacado AS highlighted
       FROM public.propiedades
      WHERE id = $1::uuid
      ${lock ? "FOR UPDATE" : ""}`,
    [propertyId]
  );
  const source = sources[0];
  if (!source) fail("property_not_found");
  if (!source.title.trim()) fail("property_title_empty");
  if (!source.description?.trim()) fail("property_description_empty");

  const rows = await executor.unsafe<{
    field_key: string;
    active_job: boolean;
  }>(
    `SELECT ct.field_key,
            EXISTS (
              SELECT 1 FROM public.translation_jobs tj
               WHERE tj.translation_id = ct.id
                 AND tj.status IN ('queued', 'processing')
            ) AS active_job
       FROM public.content_translations ct
      WHERE ct.property_id = $1::uuid
        AND ct.target_locale = 'en-US'
        AND ct.field_key IN ('title', 'description')
      ${lock ? "FOR UPDATE" : ""}`,
    [propertyId]
  );
  if (rows.some((row) => row.active_job)) fail("property_active_job_present");
  if (rows.length !== 0) fail("property_translation_already_exists");

  return {
    source,
    report: {
      eligible: true,
      entityCount: 1 as const,
      fieldCount: 2 as const,
      fields: ["title", "description"] as const,
      existingTranslationRows: 0 as const,
      rowsWouldCreate: 2 as const,
      jobsWouldQueue: 2 as const,
      revisionEventsWouldCreate: 4 as const,
      writesApplied: 0 as const,
      providerCalled: false as const,
    },
  };
}

export async function inspectSinglePropertyTranslationIntent(
  executor: TranslationQueryExecutor,
  propertyId: string
) {
  return (await inspect(executor, propertyId, false)).report;
}

async function scopedCounts(executor: TranslationQueryExecutor, propertyId: string) {
  const rows = await executor.unsafe<{
    translations: number;
    jobs: number;
    events: number;
  }>(
    `SELECT
       (SELECT count(*)::int FROM public.content_translations
         WHERE property_id = $1::uuid AND target_locale = 'en-US'
           AND field_key IN ('title', 'description')) AS translations,
       (SELECT count(*)::int FROM public.translation_jobs tj
          JOIN public.content_translations ct ON ct.id = tj.translation_id
         WHERE ct.property_id = $1::uuid AND ct.target_locale = 'en-US'
           AND ct.field_key IN ('title', 'description')) AS jobs,
       (SELECT count(*)::int FROM public.translation_revision_events tre
          JOIN public.content_translations ct ON ct.id = tre.translation_id
         WHERE ct.property_id = $1::uuid AND ct.target_locale = 'en-US'
           AND ct.field_key IN ('title', 'description')) AS events`,
    [propertyId]
  );
  return rows[0];
}

export async function applySinglePropertyTranslationIntent(
  database: TranslationDatabase,
  propertyId: string
) {
  return database.begin(async (transaction) => {
    const before = await inspect(transaction, propertyId, true);
    const countsBefore = await scopedCounts(transaction, propertyId);
    const results = await syncPropertyTranslationIntents(transaction, {
      propertyId,
      title: before.source.title,
      description: before.source.description,
      highlighted: before.source.highlighted,
    });
    const countsAfter = await scopedCounts(transaction, propertyId);
    const translationsCreated = countsAfter.translations - countsBefore.translations;
    const jobsCreated = countsAfter.jobs - countsBefore.jobs;
    const revisionEventsCreated = countsAfter.events - countsBefore.events;

    if (
      results.length !== 2 ||
      results[0]?.fieldKey !== "title" ||
      results[1]?.fieldKey !== "description" ||
      results.some((result) => result.outcome !== "created" || !result.jobQueued) ||
      translationsCreated !== 2 ||
      jobsCreated !== 2 ||
      revisionEventsCreated !== 4
    ) {
      fail("property_intent_cardinality_mismatch");
    }

    return {
      eligible: true,
      entityCount: 1 as const,
      fieldCount: 2 as const,
      translationsCreated,
      jobsCreated,
      revisionEventsCreated,
      writesApplied: translationsCreated + jobsCreated + revisionEventsCreated,
      providerCalled: false as const,
    };
  });
}

export function safePropertyIntentErrorCode(error: unknown) {
  return error instanceof PropertyIntentError
    ? error.safeCode
    : "property_intent_failed";
}
