import {
  CURRENT_TRANSLATION_HASH_VERSION,
  hashPropertyTranslationSource,
  hashTestimonialTranslationSource,
} from "@/lib/i18n/translations/hash";
import type { TranslationQueryExecutor } from "@/lib/i18n/translations/repository";
import type {
  PropertyTranslationField,
  TestimonialTranslationField,
  TranslationStatus,
} from "@/lib/i18n/translations/types";

export const TRANSLATION_JOB_PRIORITIES = {
  manualRegeneration: 25,
  highlightedProperty: 50,
  activeTestimonial: 75,
  standard: 100,
} as const;

type TranslationRow = {
  id: string;
  source_hash: string;
  translated_source_hash: string | null;
  translated_value: string | null;
  status: TranslationStatus;
  protected_from_automation: boolean;
};

export type TranslationIntentResult = {
  fieldKey: PropertyTranslationField | TestimonialTranslationField;
  outcome: "created" | "changed" | "unchanged" | "empty";
  jobQueued: boolean;
};

type SourceIntent = {
  entityType: "property" | "testimonial";
  ownerId: string;
  fieldKey: PropertyTranslationField | TestimonialTranslationField;
  sourceText: string | null;
  priority: number;
};

function hashSource(input: SourceIntent) {
  return input.entityType === "property"
    ? hashPropertyTranslationSource(
        input.fieldKey as PropertyTranslationField,
        input.sourceText || ""
      )
    : hashTestimonialTranslationSource(
        input.fieldKey as TestimonialTranslationField,
        input.sourceText || ""
      );
}

async function appendEvent(
  transaction: TranslationQueryExecutor,
  input: {
    translationId: string;
    jobId?: string | null;
    eventType: "created" | "source_changed" | "job_queued";
    previousSourceHash?: string | null;
    newSourceHash: string;
    previousTranslatedSourceHash?: string | null;
    newTranslatedSourceHash?: string | null;
    previousStatus?: TranslationStatus | null;
    newStatus?: TranslationStatus | null;
    previousValue?: string | null;
    newValue?: string | null;
  }
) {
  await transaction.unsafe(
    `INSERT INTO public.translation_revision_events (
       translation_id, job_id, event_type,
       previous_source_hash, new_source_hash,
       previous_translated_source_hash, new_translated_source_hash,
       previous_status, new_status, previous_value, new_value
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11
     )`,
    [
      input.translationId,
      input.jobId ?? null,
      input.eventType,
      input.previousSourceHash ?? null,
      input.newSourceHash,
      input.previousTranslatedSourceHash ?? null,
      input.newTranslatedSourceHash ?? null,
      input.previousStatus ?? null,
      input.newStatus ?? null,
      input.previousValue ?? null,
      input.newValue ?? null,
    ]
  );
}

async function ensureQueuedJob(
  transaction: TranslationQueryExecutor,
  input: {
    translationId: string;
    sourceHash: string;
    priority: number;
    status: TranslationStatus;
  }
) {
  const rows = await transaction.unsafe<{ id: string }>(
    `INSERT INTO public.translation_jobs (
       translation_id, source_hash, priority
     ) VALUES ($1::uuid, $2, $3)
     ON CONFLICT (translation_id, source_hash)
       WHERE status IN ('queued', 'processing')
     DO NOTHING
     RETURNING id::text`,
    [input.translationId, input.sourceHash, input.priority]
  );
  const job = rows[0];
  if (!job) return false;
  await appendEvent(transaction, {
    translationId: input.translationId,
    jobId: job.id,
    eventType: "job_queued",
    newSourceHash: input.sourceHash,
    newStatus: input.status,
  });
  return true;
}

async function syncSourceIntent(
  transaction: TranslationQueryExecutor,
  input: SourceIntent
): Promise<TranslationIntentResult> {
  if (input.sourceText === null || input.sourceText.length === 0) {
    return { fieldKey: input.fieldKey, outcome: "empty", jobQueued: false };
  }

  const ownerColumn =
    input.entityType === "property" ? "property_id" : "testimonial_id";
  const sourceHash = hashSource(input);
  let rows = await transaction.unsafe<TranslationRow>(
    `SELECT id::text, source_hash, translated_source_hash, translated_value,
            status, protected_from_automation
       FROM public.content_translations
      WHERE ${ownerColumn} = $1::uuid
        AND target_locale = 'en-US'
        AND field_key = $2
      FOR UPDATE`,
    [input.ownerId, input.fieldKey]
  );
  let current = rows[0];

  if (!current) {
    const inserted = await transaction.unsafe<TranslationRow>(
      `INSERT INTO public.content_translations (
         ${ownerColumn}, target_locale, field_key, source_hash, hash_version,
         status
       ) VALUES ($1::uuid, 'en-US', $2, $3, $4, 'pending')
       ON CONFLICT (${ownerColumn}, target_locale, field_key)
         WHERE ${ownerColumn} IS NOT NULL
       DO NOTHING
       RETURNING id::text, source_hash, translated_source_hash,
                 translated_value, status, protected_from_automation`,
      [
        input.ownerId,
        input.fieldKey,
        sourceHash,
        CURRENT_TRANSLATION_HASH_VERSION,
      ]
    );
    current = inserted[0];
    if (!current) {
      rows = await transaction.unsafe<TranslationRow>(
        `SELECT id::text, source_hash, translated_source_hash,
                translated_value, status, protected_from_automation
           FROM public.content_translations
          WHERE ${ownerColumn} = $1::uuid
            AND target_locale = 'en-US'
            AND field_key = $2
          FOR UPDATE`,
        [input.ownerId, input.fieldKey]
      );
      current = rows[0];
    } else {
      await appendEvent(transaction, {
        translationId: current.id,
        eventType: "created",
        newSourceHash: sourceHash,
        newStatus: "pending",
      });
      const jobQueued = await ensureQueuedJob(transaction, {
        translationId: current.id,
        sourceHash,
        priority: input.priority,
        status: "pending",
      });
      return { fieldKey: input.fieldKey, outcome: "created", jobQueued };
    }
  }

  if (!current) throw new Error("Translation intent could not be locked.");
  if (current.source_hash === sourceHash) {
    return { fieldKey: input.fieldKey, outcome: "unchanged", jobQueued: false };
  }

  const nextStatus: TranslationStatus =
    current.protected_from_automation ||
    (current.translated_value !== null &&
      current.translated_value.trim().length > 0)
      ? "stale"
      : "pending";
  const updated = await transaction.unsafe<TranslationRow>(
    `UPDATE public.content_translations
        SET source_hash = $2,
            hash_version = $3,
            status = $4,
            lock_version = lock_version + 1,
            updated_at = now()
      WHERE id = $1::uuid
        AND source_hash = $5
      RETURNING id::text, source_hash, translated_source_hash,
                translated_value, status, protected_from_automation`,
    [
      current.id,
      sourceHash,
      CURRENT_TRANSLATION_HASH_VERSION,
      nextStatus,
      current.source_hash,
    ]
  );
  if (!updated[0]) {
    throw new Error("Translation source changed concurrently.");
  }
  await appendEvent(transaction, {
    translationId: current.id,
    eventType: "source_changed",
    previousSourceHash: current.source_hash,
    newSourceHash: sourceHash,
    previousTranslatedSourceHash: current.translated_source_hash,
    newTranslatedSourceHash: current.translated_source_hash,
    previousStatus: current.status,
    newStatus: nextStatus,
    previousValue: current.translated_value,
    newValue: current.translated_value,
  });
  const jobQueued = current.protected_from_automation
    ? false
    : await ensureQueuedJob(transaction, {
        translationId: current.id,
        sourceHash,
        priority: input.priority,
        status: nextStatus,
      });
  return { fieldKey: input.fieldKey, outcome: "changed", jobQueued };
}

export async function syncPropertyTranslationIntents(
  transaction: TranslationQueryExecutor,
  input: {
    propertyId: string;
    title: string;
    description: string | null;
    highlighted: boolean;
  }
) {
  const priority = input.highlighted
    ? TRANSLATION_JOB_PRIORITIES.highlightedProperty
    : TRANSLATION_JOB_PRIORITIES.standard;
  const title = await syncSourceIntent(transaction, {
      entityType: "property",
      ownerId: input.propertyId,
      fieldKey: "title",
      sourceText: input.title,
      priority,
    });
  const description = await syncSourceIntent(transaction, {
      entityType: "property",
      ownerId: input.propertyId,
      fieldKey: "description",
      sourceText: input.description,
      priority,
    });
  return [title, description];
}

export async function syncTestimonialTranslationIntent(
  transaction: TranslationQueryExecutor,
  input: {
    testimonialId: string;
    body: string;
    active: boolean;
  }
) {
  return syncSourceIntent(transaction, {
    entityType: "testimonial",
    ownerId: input.testimonialId,
    fieldKey: "body",
    sourceText: input.body,
    priority: input.active
      ? TRANSLATION_JOB_PRIORITIES.activeTestimonial
      : TRANSLATION_JOB_PRIORITIES.standard,
  });
}
