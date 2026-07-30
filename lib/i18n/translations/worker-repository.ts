import {
  hashPropertyTranslationSource,
  hashTestimonialTranslationSource,
} from "@/lib/i18n/translations/hash";
import type {
  TranslationDatabase,
  TranslationQueryExecutor,
} from "@/lib/i18n/translations/repository";
import {
  isPropertyTranslationField,
  isTestimonialTranslationField,
  isTranslationTargetLocale,
  type TranslationEntityType,
  type TranslationField,
  type TranslationStatus,
  type TranslationTargetLocale,
} from "@/lib/i18n/translations/types";

export type ClaimedTranslationJob = {
  jobId: string;
  translationId: string;
  sourceHash: string;
  attempts: number;
  maxAttempts: number;
  workerId: string;
};

export type TranslationJobContext = ClaimedTranslationJob & {
  entityType: TranslationEntityType;
  fieldKey: TranslationField;
  targetLocale: TranslationTargetLocale;
  sourceText: string;
  translationStatus: TranslationStatus;
  translatedValue: string | null;
  translatedSourceHash: string | null;
  protectedFromAutomation: boolean;
  sourceExists: boolean;
};

type ContextRow = {
  job_id: string;
  translation_id: string;
  source_hash: string;
  attempts: number;
  max_attempts: number;
  locked_by: string;
  property_id: string | null;
  testimonial_id: string | null;
  target_locale: string;
  field_key: string;
  translation_status: TranslationStatus;
  translated_value: string | null;
  translated_source_hash: string | null;
  protected_from_automation: boolean;
  source_text: string | null;
  source_exists: boolean;
};

function mapContext(row: ContextRow): TranslationJobContext {
  const entityType: TranslationEntityType = row.property_id
    ? "property"
    : "testimonial";
  if (!isTranslationTargetLocale(row.target_locale)) {
    throw new Error("Unsupported translation target locale.");
  }
  if (
    (entityType === "property" &&
      !isPropertyTranslationField(row.field_key)) ||
    (entityType === "testimonial" &&
      !isTestimonialTranslationField(row.field_key))
  ) {
    throw new Error("Unsupported translation source field.");
  }
  return {
    jobId: row.job_id,
    translationId: row.translation_id,
    sourceHash: row.source_hash,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    workerId: row.locked_by,
    entityType,
    fieldKey: row.field_key as TranslationField,
    targetLocale: row.target_locale,
    sourceText: row.source_text ?? "",
    translationStatus: row.translation_status,
    translatedValue: row.translated_value,
    translatedSourceHash: row.translated_source_hash,
    protectedFromAutomation: row.protected_from_automation,
    sourceExists: row.source_exists,
  };
}

const CONTEXT_SELECT = `
  SELECT
    tj.id::text AS job_id,
    tj.translation_id::text,
    tj.source_hash,
    tj.attempts,
    tj.max_attempts,
    tj.locked_by,
    ct.property_id::text,
    ct.testimonial_id::text,
    ct.target_locale,
    ct.field_key,
    ct.status AS translation_status,
    ct.translated_value,
    ct.translated_source_hash,
    ct.protected_from_automation,
    CASE
      WHEN ct.property_id IS NOT NULL AND ct.field_key = 'title'
        THEN p.titulo
      WHEN ct.property_id IS NOT NULL AND ct.field_key = 'description'
        THEN p.descripcion
      WHEN ct.testimonial_id IS NOT NULL AND ct.field_key = 'body'
        THEN t.texto
      ELSE NULL
    END AS source_text,
    CASE
      WHEN ct.property_id IS NOT NULL THEN p.id IS NOT NULL
      ELSE t.id IS NOT NULL
    END AS source_exists
  FROM public.translation_jobs tj
  JOIN public.content_translations ct ON ct.id = tj.translation_id
  LEFT JOIN public.propiedades p ON p.id = ct.property_id
  LEFT JOIN public.testimonios t ON t.id = ct.testimonial_id
`;

async function loadContextWithExecutor(
  executor: TranslationQueryExecutor,
  input: { jobId: string; workerId: string; lock?: boolean }
) {
  const rows = await executor.unsafe<ContextRow>(
    `${CONTEXT_SELECT}
      WHERE tj.id = $1::uuid
        AND tj.status = 'processing'
        AND tj.locked_by = $2
      ${input.lock ? "FOR UPDATE OF tj, ct" : ""}
    `,
    [input.jobId, input.workerId]
  );
  return rows[0] ? mapContext(rows[0]) : null;
}

export function computeContextSourceHash(context: TranslationJobContext) {
  if (context.entityType === "property") {
    if (!isPropertyTranslationField(context.fieldKey)) {
      throw new Error("Unsupported property translation field.");
    }
    return hashPropertyTranslationSource(context.fieldKey, context.sourceText);
  }
  if (!isTestimonialTranslationField(context.fieldKey)) {
    throw new Error("Unsupported testimonial translation field.");
  }
  return hashTestimonialTranslationSource(context.fieldKey, context.sourceText);
}

function fallbackStatus(context: TranslationJobContext): TranslationStatus {
  return context.translatedValue?.trim() ? "stale" : "pending";
}

export function createTranslationWorkerRepository(
  database: TranslationDatabase
) {
  async function countEligible(now: Date) {
    const rows = await database.unsafe<{ count: number }>(
      `SELECT count(*)::integer AS count
         FROM public.translation_jobs
        WHERE status = 'queued'
          AND available_at <= $1::timestamptz
          AND attempts < max_attempts`,
      [now.toISOString()]
    );
    return rows[0]?.count ?? 0;
  }

  async function claimEligible(input: {
    workerId: string;
    limit: number;
    now: Date;
  }) {
    return database.begin(async (transaction) => {
      const rows = await transaction.unsafe<{
        job_id: string;
        translation_id: string;
        source_hash: string;
        attempts: number;
        max_attempts: number;
      }>(
        `WITH candidates AS (
           SELECT id
             FROM public.translation_jobs
            WHERE status = 'queued'
              AND available_at <= $1::timestamptz
              AND attempts < max_attempts
            ORDER BY priority ASC, available_at ASC, created_at ASC
            LIMIT $2
            FOR UPDATE SKIP LOCKED
         )
         UPDATE public.translation_jobs tj
            SET status = 'processing',
                attempts = attempts + 1,
                locked_at = $1::timestamptz,
                locked_by = $3,
                started_at = COALESCE(started_at, $1::timestamptz),
                updated_at = $1::timestamptz
           FROM candidates
          WHERE tj.id = candidates.id
         RETURNING tj.id::text AS job_id, tj.translation_id::text,
                   tj.source_hash, tj.attempts, tj.max_attempts`,
        [input.now.toISOString(), input.limit, input.workerId]
      );
      if (rows.length) {
        await transaction.unsafe(
          `UPDATE public.content_translations ct
              SET status = 'processing',
                  lock_version = lock_version + 1,
                  updated_at = $2::timestamptz
             FROM public.translation_jobs tj
            WHERE tj.translation_id = ct.id
              AND tj.id = ANY($1::uuid[])
              AND tj.source_hash = ct.source_hash
              AND ct.protected_from_automation = false
              AND ct.status IN ('pending', 'stale', 'failed')`,
          [rows.map((row) => row.job_id), input.now.toISOString()]
        );
      }
      return rows.map(
        (row): ClaimedTranslationJob => ({
          jobId: row.job_id,
          translationId: row.translation_id,
          sourceHash: row.source_hash,
          attempts: row.attempts,
          maxAttempts: row.max_attempts,
          workerId: input.workerId,
        })
      );
    });
  }

  async function loadClaimedContext(input: {
    jobId: string;
    workerId: string;
  }) {
    return loadContextWithExecutor(database, input);
  }

  async function cancelClaimed(input: {
    jobId: string;
    workerId: string;
    now: Date;
  }) {
    return database.begin(async (transaction) => {
      const context = await loadContextWithExecutor(transaction, {
        jobId: input.jobId,
        workerId: input.workerId,
        lock: true,
      });
      if (!context) return false;
      await transaction.unsafe(
        `UPDATE public.translation_jobs
            SET status = 'cancelled',
                completed_at = $3::timestamptz,
                locked_at = NULL,
                locked_by = NULL,
                updated_at = $3::timestamptz
          WHERE id = $1::uuid
            AND status = 'processing'
            AND locked_by = $2`,
        [input.jobId, input.workerId, input.now.toISOString()]
      );
      if (context.sourceHash === computeContextSourceHash(context)) {
        await transaction.unsafe(
          `UPDATE public.content_translations
              SET status = $2,
                  lock_version = lock_version + 1,
                  updated_at = $3::timestamptz
            WHERE id = $1::uuid
              AND source_hash = $4`,
          [
            context.translationId,
            fallbackStatus(context),
            input.now.toISOString(),
            context.sourceHash,
          ]
        );
      }
      return true;
    });
  }

  async function completeSuccess(input: {
    jobId: string;
    workerId: string;
    sourceHash: string;
    translatedText: string;
    providerId: string;
    providerModel: string | null;
    providerVersion: string | null;
    now: Date;
  }) {
    return database.begin(async (transaction) => {
      const context = await loadContextWithExecutor(transaction, {
        jobId: input.jobId,
        workerId: input.workerId,
        lock: true,
      });
      if (
        !context ||
        !context.sourceExists ||
        !context.sourceText ||
        context.protectedFromAutomation ||
        context.sourceHash !== input.sourceHash ||
        computeContextSourceHash(context) !== input.sourceHash ||
        !input.translatedText.trim()
      ) {
        return false;
      }
      const translated = await transaction.unsafe<{ id: string }>(
        `UPDATE public.content_translations
            SET translated_value = $3,
                translated_source_hash = $2,
                status = 'ready',
                origin = 'machine',
                review_status = 'unreviewed',
                protected_from_automation = false,
                provider = $4,
                provider_model = $5,
                provider_version = $6,
                generated_at = $7::timestamptz,
                lock_version = lock_version + 1,
                updated_at = $7::timestamptz
          WHERE id = $1::uuid
            AND source_hash = $2
            AND protected_from_automation = false
            AND status = 'processing'
          RETURNING id::text`,
        [
          context.translationId,
          input.sourceHash,
          input.translatedText,
          input.providerId,
          input.providerModel,
          input.providerVersion,
          input.now.toISOString(),
        ]
      );
      if (!translated[0]) return false;
      const job = await transaction.unsafe<{ id: string }>(
        `UPDATE public.translation_jobs
            SET status = 'succeeded',
                completed_at = $3::timestamptz,
                locked_at = NULL,
                locked_by = NULL,
                last_error_code = NULL,
                last_error_message = NULL,
                provider = $4,
                provider_model = $5,
                provider_version = $6,
                updated_at = $3::timestamptz
          WHERE id = $1::uuid
            AND status = 'processing'
            AND locked_by = $2
          RETURNING id::text`,
        [
          input.jobId,
          input.workerId,
          input.now.toISOString(),
          input.providerId,
          input.providerModel,
          input.providerVersion,
        ]
      );
      if (!job[0]) throw new Error("Claim ownership changed during completion.");
      await transaction.unsafe(
        `INSERT INTO public.translation_revision_events (
           translation_id, job_id, event_type,
           previous_source_hash, new_source_hash,
           previous_translated_source_hash, new_translated_source_hash,
           previous_status, new_status
         ) VALUES (
           $1::uuid, $2::uuid, 'generation_succeeded',
           $3, $3, $4, $3, $5, 'ready'
         )`,
        [
          context.translationId,
          input.jobId,
          input.sourceHash,
          context.translatedSourceHash,
          context.translationStatus,
        ]
      );
      return true;
    });
  }

  async function completeFailure(input: {
    jobId: string;
    workerId: string;
    retry: boolean;
    availableAt: Date;
    errorCode: string;
    errorMessage: string;
    now: Date;
  }) {
    return database.begin(async (transaction) => {
      const context = await loadContextWithExecutor(transaction, {
        jobId: input.jobId,
        workerId: input.workerId,
        lock: true,
      });
      if (!context) return false;
      const shouldRetry = input.retry && context.attempts < context.maxAttempts;
      const nextJobStatus = shouldRetry ? "queued" : "failed";
      await transaction.unsafe(
        `UPDATE public.translation_jobs
            SET status = $3,
                available_at = $4::timestamptz,
                completed_at = CASE WHEN $3 = 'failed' THEN $5::timestamptz ELSE NULL END,
                locked_at = NULL,
                locked_by = NULL,
                last_error_code = $6,
                last_error_message = $7,
                updated_at = $5::timestamptz
          WHERE id = $1::uuid
            AND status = 'processing'
            AND locked_by = $2`,
        [
          input.jobId,
          input.workerId,
          nextJobStatus,
          input.availableAt.toISOString(),
          input.now.toISOString(),
          input.errorCode,
          input.errorMessage,
        ]
      );
      const nextTranslationStatus: TranslationStatus =
        context.translatedValue?.trim()
          ? "stale"
          : shouldRetry
            ? "pending"
            : "failed";
      await transaction.unsafe(
        `UPDATE public.content_translations
            SET status = $2,
                lock_version = lock_version + 1,
                updated_at = $3::timestamptz
          WHERE id = $1::uuid
            AND source_hash = $4
            AND protected_from_automation = false`,
        [
          context.translationId,
          nextTranslationStatus,
          input.now.toISOString(),
          context.sourceHash,
        ]
      );
      await transaction.unsafe(
        `INSERT INTO public.translation_revision_events (
           translation_id, job_id, event_type,
           previous_source_hash, new_source_hash,
           previous_translated_source_hash, new_translated_source_hash,
           previous_status, new_status
         ) VALUES (
           $1::uuid, $2::uuid, 'generation_failed',
           $3, $3, $4, $4, $5, $6
         )`,
        [
          context.translationId,
          input.jobId,
          context.sourceHash,
          context.translatedSourceHash,
          context.translationStatus,
          nextTranslationStatus,
        ]
      );
      return true;
    });
  }

  async function recoverStaleLocks(input: {
    now: Date;
    lockTimeoutMs: number;
    limit: number;
  }) {
    return database.begin(async (transaction) => {
      const stale = await transaction.unsafe<{ id: string; locked_by: string }>(
        `SELECT id::text, locked_by
           FROM public.translation_jobs
          WHERE status = 'processing'
            AND locked_at < $1::timestamptz
          ORDER BY locked_at ASC
          LIMIT $2
          FOR UPDATE SKIP LOCKED`,
        [
          new Date(input.now.getTime() - input.lockTimeoutMs).toISOString(),
          input.limit,
        ]
      );
      const summary = { recovered: 0, requeued: 0, failed: 0, cancelled: 0 };
      for (const row of stale) {
        const context = await loadContextWithExecutor(transaction, {
          jobId: row.id,
          workerId: row.locked_by,
          lock: true,
        });
        if (!context) continue;
        const obsolete =
          !context.sourceExists ||
          !context.sourceText ||
          context.protectedFromAutomation ||
          computeContextSourceHash(context) !== context.sourceHash;
        const nextStatus = obsolete
          ? "cancelled"
          : context.attempts >= context.maxAttempts
            ? "failed"
            : "queued";
        await transaction.unsafe(
          `UPDATE public.translation_jobs
              SET status = $2,
                  available_at = $3::timestamptz,
                  completed_at = CASE
                    WHEN $2 IN ('failed', 'cancelled') THEN $3::timestamptz
                    ELSE NULL
                  END,
                  locked_at = NULL,
                  locked_by = NULL,
                  updated_at = $3::timestamptz
            WHERE id = $1::uuid
              AND status = 'processing'`,
          [row.id, nextStatus, input.now.toISOString()]
        );
        if (context.sourceHash === computeContextSourceHash(context)) {
          const translationStatus =
            context.protectedFromAutomation || context.translatedValue?.trim()
              ? "stale"
              : nextStatus === "failed"
                ? "failed"
                : "pending";
          await transaction.unsafe(
            `UPDATE public.content_translations
                SET status = $2,
                    lock_version = lock_version + 1,
                    updated_at = $3::timestamptz
              WHERE id = $1::uuid
                AND source_hash = $4`,
            [
              context.translationId,
              translationStatus,
              input.now.toISOString(),
              context.sourceHash,
            ]
          );
        }
        summary.recovered += 1;
        if (nextStatus === "queued") summary.requeued += 1;
        if (nextStatus === "failed") summary.failed += 1;
        if (nextStatus === "cancelled") summary.cancelled += 1;
      }
      return summary;
    });
  }

  return {
    countEligible,
    claimEligible,
    loadClaimedContext,
    cancelClaimed,
    completeSuccess,
    completeFailure,
    recoverStaleLocks,
  };
}
