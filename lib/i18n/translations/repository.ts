import type { Sql, TransactionSql } from "postgres";
import {
  assertTranslationFieldForEntity,
  assertTranslationTargetLocale,
  isPropertyTranslationField,
  isTestimonialTranslationField,
  isTranslationJobStatus,
  isTranslationOrigin,
  isTranslationReviewStatus,
  isTranslationRevisionEventType,
  isTranslationStatus,
  type PropertyTranslationField,
  type TestimonialTranslationField,
  type TranslationEntityType,
  type TranslationField,
  type TranslationJobStatus,
  type TranslationOrigin,
  type TranslationReviewStatus,
  type TranslationRevisionEventType,
  type TranslationStatus,
  type TranslationTargetLocale,
} from "@/lib/i18n/translations/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

export type TranslationQueryExecutor = {
  unsafe<Row extends Record<string, unknown>>(
    query: string,
    parameters?: unknown[]
  ): Promise<Row[]>;
};

export type TranslationDatabase = TranslationQueryExecutor & {
  begin<Result>(
    callback: (transaction: TranslationQueryExecutor) => Promise<Result>
  ): Promise<Result>;
};

export function createPostgresTranslationDatabase(
  database: Sql
): TranslationDatabase {
  const executor = (
    source: Sql | TransactionSql
  ): TranslationQueryExecutor => ({
    unsafe: (query, parameters = []) =>
      source.unsafe(query, parameters as never[]),
  });

  return {
    ...executor(database),
    begin: async (callback) => {
      const result = await database.begin(async (transaction) => ({
        value: await callback(executor(transaction)),
      }));
      return result.value;
    },
  };
}

export type ContentTranslation = {
  id: string;
  entityType: TranslationEntityType;
  ownerId: string;
  targetLocale: TranslationTargetLocale;
  fieldKey: TranslationField;
  translatedValue: string | null;
  sourceHash: string;
  translatedSourceHash: string | null;
  hashVersion: number;
  status: TranslationStatus;
  origin: TranslationOrigin;
  reviewStatus: TranslationReviewStatus;
  protectedFromAutomation: boolean;
  regenerationAuthorizedAt: string | null;
  provider: string | null;
  providerModel: string | null;
  providerVersion: string | null;
  lockVersion: number;
  generatedAt: string | null;
  manuallyEditedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TranslationJob = {
  id: string;
  translationId: string;
  sourceHash: string;
  status: TranslationJobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  provider: string | null;
  providerModel: string | null;
  providerVersion: string | null;
  availableAt: string;
  lockedAt: string | null;
  lockedBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TranslationRevisionEvent = {
  id: string;
  translationId: string;
  jobId: string | null;
  eventType: TranslationRevisionEventType;
  previousSourceHash: string | null;
  newSourceHash: string | null;
  previousTranslatedSourceHash: string | null;
  newTranslatedSourceHash: string | null;
  previousStatus: TranslationStatus | null;
  newStatus: TranslationStatus | null;
  previousValue: string | null;
  newValue: string | null;
  actorAdminId: string | null;
  createdAt: string;
};

type TranslationRow = {
  id: string;
  property_id: string | null;
  testimonial_id: string | null;
  target_locale: string;
  field_key: string;
  translated_value: string | null;
  source_hash: string;
  translated_source_hash: string | null;
  hash_version: number;
  status: string;
  origin: string;
  review_status: string;
  protected_from_automation: boolean;
  regeneration_authorized_at: string | Date | null;
  provider: string | null;
  provider_model: string | null;
  provider_version: string | null;
  lock_version: number;
  generated_at: string | Date | null;
  manually_edited_at: string | Date | null;
  reviewed_at: string | Date | null;
  reviewed_by: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type JobRow = {
  id: string;
  translation_id: string;
  source_hash: string;
  status: string;
  priority: number;
  attempts: number;
  max_attempts: number;
  provider: string | null;
  provider_model: string | null;
  provider_version: string | null;
  available_at: string | Date;
  locked_at: string | Date | null;
  locked_by: string | null;
  started_at: string | Date | null;
  completed_at: string | Date | null;
  last_error_code: string | null;
  last_error_message: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type RevisionRow = {
  id: string;
  translation_id: string;
  job_id: string | null;
  event_type: string;
  previous_source_hash: string | null;
  new_source_hash: string | null;
  previous_translated_source_hash: string | null;
  new_translated_source_hash: string | null;
  previous_status: string | null;
  new_status: string | null;
  previous_value: string | null;
  new_value: string | null;
  actor_admin_id: string | null;
  created_at: string | Date;
};

const TRANSLATION_COLUMNS = `
  id::text, property_id::text, testimonial_id::text, target_locale, field_key,
  translated_value, source_hash, translated_source_hash, hash_version, status,
  origin, review_status, protected_from_automation, provider, provider_model,
  provider_version, lock_version, regeneration_authorized_at,
  generated_at, manually_edited_at, reviewed_at,
  reviewed_by::text, created_at, updated_at
`;

const JOB_COLUMNS = `
  id::text, translation_id::text, source_hash, status, priority, attempts,
  max_attempts, provider, provider_model, provider_version, available_at,
  locked_at, locked_by, started_at, completed_at, last_error_code,
  last_error_message, created_at, updated_at
`;

function iso(value: string | Date | null) {
  return value === null ? null : new Date(value).toISOString();
}

function assertUuid(value: string, label: string) {
  if (!UUID_PATTERN.test(value)) throw new Error(`${label} must be a UUID.`);
}

function assertHash(value: string, label: string) {
  if (!HASH_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 hash.`);
  }
}

function assertNonEmpty(value: string, label: string) {
  if (value.trim() === "") throw new Error(`${label} must not be empty.`);
}

function mapTranslation(row: TranslationRow): ContentTranslation {
  const hasProperty = row.property_id !== null;
  const hasTestimonial = row.testimonial_id !== null;
  if (hasProperty === hasTestimonial) {
    throw new Error("Translation row has an invalid owner.");
  }
  const entityType: TranslationEntityType = hasProperty
    ? "property"
    : "testimonial";
  assertTranslationTargetLocale(row.target_locale);
  assertTranslationFieldForEntity(entityType, row.field_key);
  if (!isTranslationStatus(row.status)) {
    throw new Error("Translation row has an invalid status.");
  }
  if (!isTranslationOrigin(row.origin)) {
    throw new Error("Translation row has an invalid origin.");
  }
  if (!isTranslationReviewStatus(row.review_status)) {
    throw new Error("Translation row has an invalid review status.");
  }

  return {
    id: row.id,
    entityType,
    ownerId: row.property_id ?? row.testimonial_id ?? "",
    targetLocale: row.target_locale,
    fieldKey: row.field_key,
    translatedValue: row.translated_value,
    sourceHash: row.source_hash,
    translatedSourceHash: row.translated_source_hash,
    hashVersion: row.hash_version,
    status: row.status,
    origin: row.origin,
    reviewStatus: row.review_status,
    protectedFromAutomation: row.protected_from_automation,
    regenerationAuthorizedAt: iso(row.regeneration_authorized_at),
    provider: row.provider,
    providerModel: row.provider_model,
    providerVersion: row.provider_version,
    lockVersion: row.lock_version,
    generatedAt: iso(row.generated_at),
    manuallyEditedAt: iso(row.manually_edited_at),
    reviewedAt: iso(row.reviewed_at),
    reviewedBy: row.reviewed_by,
    createdAt: iso(row.created_at) ?? "",
    updatedAt: iso(row.updated_at) ?? "",
  };
}

function mapJob(row: JobRow): TranslationJob {
  if (!isTranslationJobStatus(row.status)) {
    throw new Error("Translation job row has an invalid status.");
  }
  return {
    id: row.id,
    translationId: row.translation_id,
    sourceHash: row.source_hash,
    status: row.status,
    priority: row.priority,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    provider: row.provider,
    providerModel: row.provider_model,
    providerVersion: row.provider_version,
    availableAt: iso(row.available_at) ?? "",
    lockedAt: iso(row.locked_at),
    lockedBy: row.locked_by,
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    createdAt: iso(row.created_at) ?? "",
    updatedAt: iso(row.updated_at) ?? "",
  };
}

function optionalStatus(value: string | null) {
  if (value === null) return null;
  if (!isTranslationStatus(value)) {
    throw new Error("Revision row has an invalid translation status.");
  }
  return value;
}

function mapRevision(row: RevisionRow): TranslationRevisionEvent {
  if (!isTranslationRevisionEventType(row.event_type)) {
    throw new Error("Revision row has an invalid event type.");
  }
  return {
    id: row.id,
    translationId: row.translation_id,
    jobId: row.job_id,
    eventType: row.event_type,
    previousSourceHash: row.previous_source_hash,
    newSourceHash: row.new_source_hash,
    previousTranslatedSourceHash: row.previous_translated_source_hash,
    newTranslatedSourceHash: row.new_translated_source_hash,
    previousStatus: optionalStatus(row.previous_status),
    newStatus: optionalStatus(row.new_status),
    previousValue: row.previous_value,
    newValue: row.new_value,
    actorAdminId: row.actor_admin_id,
    createdAt: iso(row.created_at) ?? "",
  };
}

function validateOwnerIds(ownerIds: readonly string[]) {
  for (const ownerId of ownerIds) assertUuid(ownerId, "Owner ID");
}

export function createTranslationRepository(database: TranslationDatabase) {
  async function fetchPropertyTranslations(
    propertyIds: readonly string[],
    targetLocale: TranslationTargetLocale,
    fieldKeys: readonly PropertyTranslationField[] = [
      "title",
      "description",
    ]
  ) {
    assertTranslationTargetLocale(targetLocale);
    validateOwnerIds(propertyIds);
    for (const fieldKey of fieldKeys) {
      if (!isPropertyTranslationField(fieldKey)) {
        throw new Error("Invalid property translation field.");
      }
    }
    if (propertyIds.length === 0 || fieldKeys.length === 0) return [];
    const rows = await database.unsafe<TranslationRow>(
      `SELECT ${TRANSLATION_COLUMNS}
         FROM public.content_translations
        WHERE property_id = ANY($1::uuid[])
          AND target_locale = $2
          AND field_key = ANY($3::text[])
        ORDER BY property_id, field_key`,
      [[...propertyIds], targetLocale, [...fieldKeys]]
    );
    return rows.map(mapTranslation);
  }

  async function fetchTestimonialTranslations(
    testimonialIds: readonly string[],
    targetLocale: TranslationTargetLocale,
    fieldKeys: readonly TestimonialTranslationField[] = ["body"]
  ) {
    assertTranslationTargetLocale(targetLocale);
    validateOwnerIds(testimonialIds);
    for (const fieldKey of fieldKeys) {
      if (!isTestimonialTranslationField(fieldKey)) {
        throw new Error("Invalid testimonial translation field.");
      }
    }
    if (testimonialIds.length === 0 || fieldKeys.length === 0) return [];
    const rows = await database.unsafe<TranslationRow>(
      `SELECT ${TRANSLATION_COLUMNS}
         FROM public.content_translations
        WHERE testimonial_id = ANY($1::uuid[])
          AND target_locale = $2
          AND field_key = ANY($3::text[])
        ORDER BY testimonial_id, field_key`,
      [[...testimonialIds], targetLocale, [...fieldKeys]]
    );
    return rows.map(mapTranslation);
  }

  async function fetchTranslationById(id: string) {
    assertUuid(id, "Translation ID");
    const rows = await database.unsafe<TranslationRow>(
      `SELECT ${TRANSLATION_COLUMNS}
         FROM public.content_translations
        WHERE id = $1::uuid
        LIMIT 1`,
      [id]
    );
    return rows[0] ? mapTranslation(rows[0]) : null;
  }

  async function findActiveJob(translationId: string, sourceHash: string) {
    assertUuid(translationId, "Translation ID");
    assertHash(sourceHash, "Source hash");
    const rows = await database.unsafe<JobRow>(
      `SELECT ${JOB_COLUMNS}
         FROM public.translation_jobs
        WHERE translation_id = $1::uuid
          AND source_hash = $2
          AND status IN ('queued', 'processing')
        LIMIT 1`,
      [translationId, sourceHash]
    );
    return rows[0] ? mapJob(rows[0]) : null;
  }

  async function listRevisionEvents(
    translationId: string,
    order: "asc" | "desc" = "desc"
  ) {
    assertUuid(translationId, "Translation ID");
    const direction = order === "asc" ? "ASC" : "DESC";
    const rows = await database.unsafe<RevisionRow>(
      `SELECT id::text, translation_id::text, job_id::text, event_type,
              previous_source_hash, new_source_hash,
              previous_translated_source_hash, new_translated_source_hash,
              previous_status, new_status, previous_value, new_value,
              actor_admin_id::text, created_at
         FROM public.translation_revision_events
        WHERE translation_id = $1::uuid
        ORDER BY created_at ${direction}, id ${direction}`,
      [translationId]
    );
    return rows.map(mapRevision);
  }

  async function ensureTranslation(input: {
    entityType: TranslationEntityType;
    ownerId: string;
    targetLocale: TranslationTargetLocale;
    fieldKey: TranslationField;
    sourceHash: string;
    hashVersion: number;
  }) {
    assertUuid(input.ownerId, "Owner ID");
    assertTranslationTargetLocale(input.targetLocale);
    assertTranslationFieldForEntity(input.entityType, input.fieldKey);
    assertHash(input.sourceHash, "Source hash");
    if (!Number.isInteger(input.hashVersion) || input.hashVersion <= 0) {
      throw new Error("Hash version must be a positive integer.");
    }
    const ownerColumn =
      input.entityType === "property" ? "property_id" : "testimonial_id";
    const conflictPredicate =
      input.entityType === "property"
        ? "property_id IS NOT NULL"
        : "testimonial_id IS NOT NULL";
    const rows = await database.unsafe<TranslationRow>(
      `INSERT INTO public.content_translations (
         ${ownerColumn}, target_locale, field_key, source_hash, hash_version
       ) VALUES ($1::uuid, $2, $3, $4, $5)
       ON CONFLICT (${ownerColumn}, target_locale, field_key)
         WHERE ${conflictPredicate}
       DO UPDATE SET ${ownerColumn} = EXCLUDED.${ownerColumn}
       RETURNING ${TRANSLATION_COLUMNS}`,
      [
        input.ownerId,
        input.targetLocale,
        input.fieldKey,
        input.sourceHash,
        input.hashVersion,
      ]
    );
    return mapTranslation(rows[0]);
  }

  async function updateSourceHashAndLifecycle(input: {
    translationId: string;
    sourceHash: string;
    hashVersion: number;
    expectedLockVersion?: number;
  }) {
    assertUuid(input.translationId, "Translation ID");
    assertHash(input.sourceHash, "Source hash");
    if (!Number.isInteger(input.hashVersion) || input.hashVersion <= 0) {
      throw new Error("Hash version must be a positive integer.");
    }
    if (
      input.expectedLockVersion !== undefined &&
      (!Number.isInteger(input.expectedLockVersion) ||
        input.expectedLockVersion < 0)
    ) {
      throw new Error("Expected lock version must be non-negative.");
    }
    const rows = await database.unsafe<TranslationRow>(
      `UPDATE public.content_translations
          SET source_hash = $2,
              hash_version = $3,
              status = CASE
                WHEN protected_from_automation THEN 'stale'
                ELSE 'pending'
              END,
              lock_version = lock_version + 1,
              updated_at = now()
        WHERE id = $1::uuid
          AND source_hash <> $2
          AND ($4::integer IS NULL OR lock_version = $4)
      RETURNING ${TRANSLATION_COLUMNS}`,
      [
        input.translationId,
        input.sourceHash,
        input.hashVersion,
        input.expectedLockVersion ?? null,
      ]
    );
    return rows[0] ? mapTranslation(rows[0]) : null;
  }

  async function markTranslationStale(input: {
    translationId: string;
    sourceHash: string;
  }) {
    assertUuid(input.translationId, "Translation ID");
    assertHash(input.sourceHash, "Source hash");
    const rows = await database.unsafe<TranslationRow>(
      `UPDATE public.content_translations
          SET source_hash = $2,
              status = 'stale',
              lock_version = lock_version + 1,
              updated_at = now()
        WHERE id = $1::uuid
      RETURNING ${TRANSLATION_COLUMNS}`,
      [input.translationId, input.sourceHash]
    );
    return rows[0] ? mapTranslation(rows[0]) : null;
  }

  async function enqueueTranslationJob(input: {
    translationId: string;
    sourceHash: string;
    priority?: number;
    maxAttempts?: number;
    provider?: string | null;
    providerModel?: string | null;
    providerVersion?: string | null;
  }) {
    assertUuid(input.translationId, "Translation ID");
    assertHash(input.sourceHash, "Source hash");
    const priority = input.priority ?? 100;
    const maxAttempts = input.maxAttempts ?? 5;
    if (!Number.isInteger(priority) || priority < 0) {
      throw new Error("Job priority must be non-negative.");
    }
    if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
      throw new Error("Maximum attempts must be positive.");
    }

    return database.begin(async (transaction) => {
      const inserted = await transaction.unsafe<JobRow>(
        `INSERT INTO public.translation_jobs (
           translation_id, source_hash, priority, max_attempts,
           provider, provider_model, provider_version
         ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (translation_id, source_hash)
           WHERE status IN ('queued', 'processing')
         DO NOTHING
         RETURNING ${JOB_COLUMNS}`,
        [
          input.translationId,
          input.sourceHash,
          priority,
          maxAttempts,
          input.provider ?? null,
          input.providerModel ?? null,
          input.providerVersion ?? null,
        ]
      );
      let row = inserted[0];
      if (!row) {
        const existing = await transaction.unsafe<JobRow>(
          `SELECT ${JOB_COLUMNS}
             FROM public.translation_jobs
            WHERE translation_id = $1::uuid
              AND source_hash = $2
              AND status IN ('queued', 'processing')
            LIMIT 1`,
          [input.translationId, input.sourceHash]
        );
        row = existing[0];
      } else {
        await transaction.unsafe<RevisionRow>(
          `INSERT INTO public.translation_revision_events (
             translation_id, job_id, event_type, new_source_hash
           ) VALUES ($1::uuid, $2::uuid, 'job_queued', $3)
           RETURNING id::text, translation_id::text, job_id::text, event_type,
             previous_source_hash, new_source_hash,
             previous_translated_source_hash, new_translated_source_hash,
             previous_status, new_status, previous_value, new_value,
             actor_admin_id::text, created_at`,
          [input.translationId, row.id, input.sourceHash]
        );
      }
      if (!row) throw new Error("Translation job could not be ensured.");
      return mapJob(row);
    });
  }

  async function appendRevisionEvent(input: {
    translationId: string;
    jobId?: string | null;
    eventType: TranslationRevisionEventType;
    previousSourceHash?: string | null;
    newSourceHash?: string | null;
    previousTranslatedSourceHash?: string | null;
    newTranslatedSourceHash?: string | null;
    previousStatus?: TranslationStatus | null;
    newStatus?: TranslationStatus | null;
    previousValue?: string | null;
    newValue?: string | null;
    actorAdminId?: string | null;
  }) {
    assertUuid(input.translationId, "Translation ID");
    if (input.jobId) assertUuid(input.jobId, "Translation job ID");
    if (input.actorAdminId) assertUuid(input.actorAdminId, "Admin ID");
    if (!isTranslationRevisionEventType(input.eventType)) {
      throw new Error("Invalid revision event type.");
    }
    for (const [label, hash] of [
      ["Previous source hash", input.previousSourceHash],
      ["New source hash", input.newSourceHash],
      ["Previous translated source hash", input.previousTranslatedSourceHash],
      ["New translated source hash", input.newTranslatedSourceHash],
    ] as const) {
      if (hash !== undefined && hash !== null) assertHash(hash, label);
    }
    const rows = await database.unsafe<RevisionRow>(
      `INSERT INTO public.translation_revision_events (
         translation_id, job_id, event_type,
         previous_source_hash, new_source_hash,
         previous_translated_source_hash, new_translated_source_hash,
         previous_status, new_status, previous_value, new_value, actor_admin_id
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::uuid
       )
       RETURNING id::text, translation_id::text, job_id::text, event_type,
         previous_source_hash, new_source_hash,
         previous_translated_source_hash, new_translated_source_hash,
         previous_status, new_status, previous_value, new_value,
         actor_admin_id::text, created_at`,
      [
        input.translationId,
        input.jobId ?? null,
        input.eventType,
        input.previousSourceHash ?? null,
        input.newSourceHash ?? null,
        input.previousTranslatedSourceHash ?? null,
        input.newTranslatedSourceHash ?? null,
        input.previousStatus ?? null,
        input.newStatus ?? null,
        input.previousValue ?? null,
        input.newValue ?? null,
        input.actorAdminId ?? null,
      ]
    );
    return mapRevision(rows[0]);
  }

  async function updateTranslationOptimistically(input: {
    translationId: string;
    expectedLockVersion: number;
    translatedValue: string | null;
    translatedSourceHash: string | null;
    status: TranslationStatus;
    origin: TranslationOrigin;
    reviewStatus: TranslationReviewStatus;
    protectedFromAutomation: boolean;
    reviewedBy?: string | null;
  }) {
    assertUuid(input.translationId, "Translation ID");
    if (!Number.isInteger(input.expectedLockVersion) || input.expectedLockVersion < 0) {
      throw new Error("Expected lock version must be non-negative.");
    }
    if (!isTranslationStatus(input.status)) throw new Error("Invalid translation status.");
    if (!isTranslationOrigin(input.origin)) throw new Error("Invalid translation origin.");
    if (!isTranslationReviewStatus(input.reviewStatus)) {
      throw new Error("Invalid review status.");
    }
    if (input.translatedSourceHash) {
      assertHash(input.translatedSourceHash, "Translated source hash");
    }
    if (input.status === "ready") {
      if (input.translatedValue === null) throw new Error("Ready translation requires a value.");
      assertNonEmpty(input.translatedValue, "Translated value");
      if (input.translatedSourceHash === null) {
        throw new Error("Ready translation requires a translated source hash.");
      }
    }
    if (
      (input.origin === "manual" || input.reviewStatus === "reviewed") &&
      !input.protectedFromAutomation
    ) {
      throw new Error("Manual or reviewed translations must be protected.");
    }
    if (input.reviewedBy) assertUuid(input.reviewedBy, "Reviewer ID");

    const rows = await database.unsafe<TranslationRow>(
      `UPDATE public.content_translations
          SET translated_value = $3,
              translated_source_hash = $4,
              status = $5,
              origin = $6,
              review_status = $7,
              protected_from_automation = $8,
              manually_edited_at = CASE WHEN $6 = 'manual' THEN now() ELSE manually_edited_at END,
              reviewed_at = CASE WHEN $7 = 'reviewed' THEN now() ELSE reviewed_at END,
              reviewed_by = CASE WHEN $7 = 'reviewed' THEN $9::uuid ELSE reviewed_by END,
              lock_version = lock_version + 1,
              updated_at = now()
        WHERE id = $1::uuid
          AND lock_version = $2
      RETURNING ${TRANSLATION_COLUMNS}`,
      [
        input.translationId,
        input.expectedLockVersion,
        input.translatedValue,
        input.translatedSourceHash,
        input.status,
        input.origin,
        input.reviewStatus,
        input.protectedFromAutomation,
        input.reviewedBy ?? null,
      ]
    );
    return rows[0] ? mapTranslation(rows[0]) : null;
  }

  async function writeMachineTranslationResult(input: {
    translationId: string;
    jobId: string;
    sourceHash: string;
    translatedValue: string;
    provider: string;
    providerModel?: string | null;
    providerVersion?: string | null;
  }) {
    assertUuid(input.translationId, "Translation ID");
    assertUuid(input.jobId, "Translation job ID");
    assertHash(input.sourceHash, "Source hash");
    assertNonEmpty(input.translatedValue, "Translated value");
    assertNonEmpty(input.provider, "Provider");

    return database.begin(async (transaction) => {
      const beforeRows = await transaction.unsafe<TranslationRow>(
        `SELECT ${TRANSLATION_COLUMNS}
           FROM public.content_translations
          WHERE id = $1::uuid
          FOR UPDATE`,
        [input.translationId]
      );
      const before = beforeRows[0];
      if (!before) return null;
      const jobRows = await transaction.unsafe<JobRow>(
        `SELECT ${JOB_COLUMNS}
           FROM public.translation_jobs
          WHERE id = $1::uuid
            AND translation_id = $2::uuid
          FOR UPDATE`,
        [input.jobId, input.translationId]
      );
      const job = jobRows[0];
      if (
        !job ||
        job.status !== "processing" ||
        job.source_hash !== input.sourceHash ||
        before.source_hash !== input.sourceHash ||
        before.protected_from_automation ||
        before.status !== "processing"
      ) {
        return null;
      }
      const updatedRows = await transaction.unsafe<TranslationRow>(
        `UPDATE public.content_translations
            SET translated_value = $3,
                translated_source_hash = $4,
                status = 'ready',
                origin = 'machine',
                review_status = 'unreviewed',
                protected_from_automation = false,
                regeneration_authorized_at = NULL,
                reviewed_at = NULL,
                reviewed_by = NULL,
                provider = $5,
                provider_model = $6,
                provider_version = $7,
                generated_at = now(),
                lock_version = lock_version + 1,
                updated_at = now()
          WHERE id = $1::uuid
            AND source_hash = $2
            AND protected_from_automation = false
            AND status = 'processing'
        RETURNING ${TRANSLATION_COLUMNS}`,
        [
          input.translationId,
          input.sourceHash,
          input.translatedValue,
          input.sourceHash,
          input.provider,
          input.providerModel ?? null,
          input.providerVersion ?? null,
        ]
      );
      const updated = updatedRows[0];
      if (!updated) return null;
      await transaction.unsafe<JobRow>(
        `UPDATE public.translation_jobs
            SET status = 'succeeded',
                completed_at = now(),
                locked_at = NULL,
                locked_by = NULL,
                updated_at = now()
          WHERE id = $1::uuid
            AND status = 'processing'
        RETURNING ${JOB_COLUMNS}`,
        [input.jobId]
      );
      await transaction.unsafe<RevisionRow>(
        `INSERT INTO public.translation_revision_events (
           translation_id, job_id, event_type,
           previous_source_hash, new_source_hash,
           previous_translated_source_hash, new_translated_source_hash,
           previous_status, new_status, previous_value, new_value
         ) VALUES (
           $1::uuid, $2::uuid, 'generation_succeeded',
           $3, $3, $4, $3, $5, 'ready', $6, $7
         )
         RETURNING id::text, translation_id::text, job_id::text, event_type,
           previous_source_hash, new_source_hash,
           previous_translated_source_hash, new_translated_source_hash,
           previous_status, new_status, previous_value, new_value,
           actor_admin_id::text, created_at`,
        [
          input.translationId,
          input.jobId,
          input.sourceHash,
          before.translated_source_hash,
          before.status,
          before.translated_value,
          input.translatedValue,
        ]
      );
      return mapTranslation(updated);
    });
  }

  return {
    fetchPropertyTranslations,
    fetchTestimonialTranslations,
    fetchTranslationById,
    findActiveJob,
    listRevisionEvents,
    ensurePropertyTranslation: (input: {
      propertyId: string;
      targetLocale: TranslationTargetLocale;
      fieldKey: PropertyTranslationField;
      sourceHash: string;
      hashVersion: number;
    }) =>
      ensureTranslation({
        entityType: "property",
        ownerId: input.propertyId,
        targetLocale: input.targetLocale,
        fieldKey: input.fieldKey,
        sourceHash: input.sourceHash,
        hashVersion: input.hashVersion,
      }),
    ensureTestimonialTranslation: (input: {
      testimonialId: string;
      targetLocale: TranslationTargetLocale;
      fieldKey: TestimonialTranslationField;
      sourceHash: string;
      hashVersion: number;
    }) =>
      ensureTranslation({
        entityType: "testimonial",
        ownerId: input.testimonialId,
        targetLocale: input.targetLocale,
        fieldKey: input.fieldKey,
        sourceHash: input.sourceHash,
        hashVersion: input.hashVersion,
      }),
    updateSourceHashAndLifecycle,
    enqueueTranslationJob,
    appendRevisionEvent,
    markTranslationStale,
    updateTranslationOptimistically,
    writeMachineTranslationResult,
  };
}
