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
  type TranslationEntityType,
  type TranslationField,
  type TranslationJobStatus,
  type TranslationOrigin,
  type TranslationReviewStatus,
  type TranslationRevisionEventType,
  type TranslationStatus,
} from "@/lib/i18n/translations/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
export const ADMIN_REGENERATION_PRIORITY = 25;

export class TranslationAdminConflictError extends Error {
  constructor() {
    super(
      "La fuente en español o la traducción en inglés cambió mientras editabas. Recarga y revisa la versión más reciente."
    );
    this.name = "TranslationAdminConflictError";
  }
}

export class TranslationAdminValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranslationAdminValidationError";
  }
}

export type TranslationAdminEvent = {
  id: string;
  eventType: TranslationRevisionEventType;
  previousStatus: TranslationStatus | null;
  newStatus: TranslationStatus | null;
  previousValue: string | null;
  newValue: string | null;
  actorName: string | null;
  jobId: string | null;
  createdAt: string;
};

export type TranslationAdminField = {
  translationId: string | null;
  entityType: TranslationEntityType;
  ownerId: string;
  fieldKey: TranslationField;
  sourceValue: string;
  sourceHash: string;
  translatedValue: string | null;
  status: TranslationStatus | "missing";
  origin: TranslationOrigin | null;
  reviewStatus: TranslationReviewStatus | null;
  protectedFromAutomation: boolean;
  regenerationAuthorizedAt: string | null;
  isFresh: boolean;
  lockVersion: number;
  generatedAt: string | null;
  manuallyEditedAt: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
  activeJobStatus: TranslationJobStatus | null;
  lastJobStatus: TranslationJobStatus | null;
  events: TranslationAdminEvent[];
};

type LockedRow = {
  id: string;
  property_id: string | null;
  testimonial_id: string | null;
  field_key: string;
  source_hash: string;
  translated_source_hash: string | null;
  translated_value: string | null;
  status: TranslationStatus;
  origin: TranslationOrigin;
  review_status: TranslationReviewStatus;
  protected_from_automation: boolean;
  regeneration_authorized_at: string | Date | null;
  lock_version: number;
};

function validateMutationInput(input: {
  translationId: string;
  actorAdminId: string;
  entityType: TranslationEntityType;
  ownerId: string;
  expectedSourceHash: string;
  expectedLockVersion: number;
}) {
  if (!UUID.test(input.translationId) || !UUID.test(input.actorAdminId) || !UUID.test(input.ownerId)) {
    throw new TranslationAdminValidationError("Identificador inválido.");
  }
  if (!HASH.test(input.expectedSourceHash)) {
    throw new TranslationAdminValidationError("Estado de fuente inválido.");
  }
  if (!Number.isInteger(input.expectedLockVersion) || input.expectedLockVersion < 0) {
    throw new TranslationAdminValidationError("Versión de edición inválida.");
  }
}

function sourceHashFor(row: LockedRow, source: string) {
  if (row.property_id) {
    if (!isPropertyTranslationField(row.field_key)) {
      throw new TranslationAdminValidationError("Campo de propiedad inválido.");
    }
    return hashPropertyTranslationSource(row.field_key, source);
  }
  if (!row.testimonial_id || !isTestimonialTranslationField(row.field_key)) {
    throw new TranslationAdminValidationError("Campo de testimonio inválido.");
  }
  return hashTestimonialTranslationSource(row.field_key, source);
}

async function lockAndVerify(
  tx: TranslationQueryExecutor,
  input: {
    translationId: string;
    expectedSourceHash: string;
    expectedLockVersion: number;
    entityType: TranslationEntityType;
    ownerId: string;
  }
) {
  const rows = await tx.unsafe<LockedRow>(
    `SELECT id::text, property_id::text, testimonial_id::text, field_key,
            source_hash, translated_source_hash, translated_value, status,
            origin, review_status, protected_from_automation,
            regeneration_authorized_at, lock_version
       FROM public.content_translations
      WHERE id = $1::uuid
        AND target_locale = 'en-US'
      FOR UPDATE`,
    [input.translationId]
  );
  const row = rows[0];
  if (!row) throw new TranslationAdminValidationError("Traducción no encontrada.");
  if (
    (input.entityType === "property" && row.property_id !== input.ownerId) ||
    (input.entityType === "testimonial" && row.testimonial_id !== input.ownerId)
  ) {
    throw new TranslationAdminValidationError("La traducción no pertenece al contenido solicitado.");
  }
  const sourceRows = row.property_id
    ? await tx.unsafe<{ source_value: string | null }>(
        `SELECT CASE WHEN $2 = 'title' THEN titulo ELSE descripcion END AS source_value
           FROM public.propiedades WHERE id = $1::uuid`,
        [row.property_id, row.field_key]
      )
    : await tx.unsafe<{ source_value: string | null }>(
        `SELECT texto AS source_value FROM public.testimonios WHERE id = $1::uuid`,
        [row.testimonial_id]
      );
  const source = sourceRows[0]?.source_value ?? "";
  const actualHash = sourceHashFor(row, source);
  if (
    row.lock_version !== input.expectedLockVersion ||
    row.source_hash !== input.expectedSourceHash ||
    actualHash !== input.expectedSourceHash
  ) {
    throw new TranslationAdminConflictError();
  }
  return row;
}

async function cancelActiveJobs(
  tx: TranslationQueryExecutor,
  translationId: string,
  now: string
) {
  await tx.unsafe(
    `UPDATE public.translation_jobs
        SET status = 'cancelled', completed_at = $2::timestamptz,
            locked_at = NULL, locked_by = NULL, updated_at = $2::timestamptz
      WHERE translation_id = $1::uuid
        AND status IN ('queued', 'processing')`,
    [translationId, now]
  );
}

async function appendEvent(
  tx: TranslationQueryExecutor,
  input: {
    row: LockedRow;
    actorAdminId: string;
    eventType: TranslationRevisionEventType;
    newStatus: TranslationStatus;
    newTranslatedSourceHash: string | null;
    newValue: string | null;
    jobId?: string | null;
  }
) {
  await tx.unsafe(
    `INSERT INTO public.translation_revision_events (
       translation_id, job_id, event_type,
       previous_source_hash, new_source_hash,
       previous_translated_source_hash, new_translated_source_hash,
       previous_status, new_status, previous_value, new_value, actor_admin_id
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, $4, $5, $6, $7, $8, $9, $10, $11::uuid
     )`,
    [
      input.row.id,
      input.jobId ?? null,
      input.eventType,
      input.row.source_hash,
      input.row.translated_source_hash,
      input.newTranslatedSourceHash,
      input.row.status,
      input.newStatus,
      input.row.translated_value,
      input.newValue,
      input.actorAdminId,
    ]
  );
}

export function createTranslationAdminService(database: TranslationDatabase) {
  async function getEntityTranslations(input: {
    entityType: TranslationEntityType;
    ownerId: string;
  }): Promise<TranslationAdminField[]> {
    if (!UUID.test(input.ownerId)) return [];
    let fields: Array<{ fieldKey: TranslationField; sourceValue: string }>;
    if (input.entityType === "property") {
      const sourceRows = await database.unsafe<{
        title: string;
        description: string | null;
      }>(
        `SELECT titulo AS title, descripcion AS description
           FROM public.propiedades WHERE id = $1::uuid`,
        [input.ownerId]
      );
      if (!sourceRows[0]) return [];
      fields = [
        { fieldKey: "title", sourceValue: String(sourceRows[0].title ?? "") },
        {
          fieldKey: "description",
          sourceValue: String(sourceRows[0].description ?? ""),
        },
      ];
    } else {
      const sourceRows = await database.unsafe<{ body: string }>(
        `SELECT texto AS body FROM public.testimonios WHERE id = $1::uuid`,
        [input.ownerId]
      );
      if (!sourceRows[0]) return [];
      fields = [{ fieldKey: "body", sourceValue: String(sourceRows[0].body ?? "") }];
    }
    const ownerColumn = input.entityType === "property" ? "property_id" : "testimonial_id";
    const rows = await database.unsafe<Record<string, unknown>>(
      `SELECT ct.id::text, ct.field_key, ct.source_hash,
              ct.translated_source_hash, ct.translated_value, ct.status,
              ct.origin, ct.review_status, ct.protected_from_automation,
              ct.regeneration_authorized_at, ct.lock_version, ct.generated_at,
              ct.manually_edited_at, ct.reviewed_at,
              COALESCE(NULLIF(au.display_name, ''), au.username) AS reviewer_name,
              active_job.status AS active_job_status,
              last_job.status AS last_job_status
         FROM public.content_translations ct
         LEFT JOIN public.admin_users au ON au.id = ct.reviewed_by
         LEFT JOIN LATERAL (
           SELECT status FROM public.translation_jobs
            WHERE translation_id = ct.id AND status IN ('queued', 'processing')
            ORDER BY created_at DESC LIMIT 1
         ) active_job ON true
         LEFT JOIN LATERAL (
           SELECT status FROM public.translation_jobs
            WHERE translation_id = ct.id ORDER BY created_at DESC LIMIT 1
         ) last_job ON true
        WHERE ct.${ownerColumn} = $1::uuid AND ct.target_locale = 'en-US'`,
      [input.ownerId]
    );
    const byField = new Map(rows.map((row) => [String(row.field_key), row]));
    const ids = rows.map((row) => String(row.id));
    const eventRows = ids.length
      ? await database.unsafe<Record<string, unknown>>(
          `SELECT e.id::text, e.translation_id::text, e.job_id::text,
                  e.event_type, e.previous_status, e.new_status,
                  e.previous_value, e.new_value, e.created_at,
                  COALESCE(NULLIF(au.display_name, ''), au.username) AS actor_name
             FROM public.translation_revision_events e
             LEFT JOIN public.admin_users au ON au.id = e.actor_admin_id
            WHERE e.translation_id = ANY($1::uuid[])
            ORDER BY e.created_at DESC, e.id DESC
            LIMIT 100`,
          [ids]
        )
      : [];
    const eventsById = new Map<string, TranslationAdminEvent[]>();
    for (const event of eventRows) {
      const id = String(event.translation_id);
      const list = eventsById.get(id) ?? [];
      list.push({
        id: String(event.id),
        eventType: event.event_type as TranslationRevisionEventType,
        previousStatus: (event.previous_status as TranslationStatus | null) ?? null,
        newStatus: (event.new_status as TranslationStatus | null) ?? null,
        previousValue: (event.previous_value as string | null) ?? null,
        newValue: (event.new_value as string | null) ?? null,
        actorName: (event.actor_name as string | null) ?? null,
        jobId: (event.job_id as string | null) ?? null,
        createdAt: new Date(event.created_at as string | Date).toISOString(),
      });
      eventsById.set(id, list);
    }
    return fields.map(({ fieldKey, sourceValue }) => {
      const row = byField.get(fieldKey);
      const sourceHash = input.entityType === "property"
        ? hashPropertyTranslationSource(fieldKey as "title" | "description", sourceValue)
        : hashTestimonialTranslationSource("body", sourceValue);
      if (!row) {
        return {
          translationId: null, entityType: input.entityType, ownerId: input.ownerId,
          fieldKey, sourceValue, sourceHash, translatedValue: null, status: "missing",
          origin: null, reviewStatus: null, protectedFromAutomation: false,
          regenerationAuthorizedAt: null, isFresh: false, lockVersion: 0,
          generatedAt: null, manuallyEditedAt: null, reviewedAt: null,
          reviewerName: null, activeJobStatus: null, lastJobStatus: null, events: [],
        };
      }
      const translationId = String(row.id);
      return {
        translationId, entityType: input.entityType, ownerId: input.ownerId,
        fieldKey, sourceValue, sourceHash: String(row.source_hash),
        translatedValue: (row.translated_value as string | null) ?? null,
        status: row.status as TranslationStatus,
        origin: row.origin as TranslationOrigin,
        reviewStatus: row.review_status as TranslationReviewStatus,
        protectedFromAutomation: Boolean(row.protected_from_automation),
        regenerationAuthorizedAt: row.regeneration_authorized_at
          ? new Date(row.regeneration_authorized_at as string | Date).toISOString() : null,
        isFresh: row.translated_source_hash === row.source_hash,
        lockVersion: Number(row.lock_version),
        generatedAt: row.generated_at ? new Date(row.generated_at as string | Date).toISOString() : null,
        manuallyEditedAt: row.manually_edited_at ? new Date(row.manually_edited_at as string | Date).toISOString() : null,
        reviewedAt: row.reviewed_at ? new Date(row.reviewed_at as string | Date).toISOString() : null,
        reviewerName: (row.reviewer_name as string | null) ?? null,
        activeJobStatus: (row.active_job_status as TranslationJobStatus | null) ?? null,
        lastJobStatus: (row.last_job_status as TranslationJobStatus | null) ?? null,
        events: eventsById.get(translationId) ?? [],
      };
    });
  }

  async function manualEdit(input: {
    translationId: string; actorAdminId: string; entityType: TranslationEntityType; ownerId: string; expectedSourceHash: string;
    expectedLockVersion: number; translatedValue: string;
  }) {
    validateMutationInput(input);
    if (!input.translatedValue.trim()) {
      throw new TranslationAdminValidationError("La traducción no puede estar vacía.");
    }
    return database.begin(async (tx) => {
      const row = await lockAndVerify(tx, input);
      const now = new Date().toISOString();
      await cancelActiveJobs(tx, row.id, now);
      await tx.unsafe(
        `UPDATE public.content_translations SET translated_value = $2,
           translated_source_hash = source_hash, status = 'ready', origin = 'manual',
           protected_from_automation = true, regeneration_authorized_at = NULL,
           manually_edited_at = $3::timestamptz, lock_version = lock_version + 1,
           updated_at = $3::timestamptz WHERE id = $1::uuid`,
        [row.id, input.translatedValue, now]
      );
      await appendEvent(tx, { row, actorAdminId: input.actorAdminId,
        eventType: "manually_edited", newStatus: "ready",
        newTranslatedSourceHash: row.source_hash, newValue: input.translatedValue });
    });
  }

  async function markReviewed(input: {
    translationId: string; actorAdminId: string; entityType: TranslationEntityType; ownerId: string; expectedSourceHash: string;
    expectedLockVersion: number;
  }) {
    validateMutationInput(input);
    return database.begin(async (tx) => {
      const row = await lockAndVerify(tx, input);
      if (!row.translated_value?.trim() || row.translated_source_hash !== row.source_hash || row.status !== "ready") {
        throw new TranslationAdminValidationError("Solo una traducción vigente y lista puede marcarse como revisada.");
      }
      const now = new Date().toISOString();
      await cancelActiveJobs(tx, row.id, now);
      await tx.unsafe(
        `UPDATE public.content_translations SET review_status = 'reviewed',
           protected_from_automation = true, regeneration_authorized_at = NULL,
           reviewed_at = $2::timestamptz, reviewed_by = $3::uuid,
           lock_version = lock_version + 1, updated_at = $2::timestamptz
         WHERE id = $1::uuid`,
        [row.id, now, input.actorAdminId]
      );
      await appendEvent(tx, { row, actorAdminId: input.actorAdminId,
        eventType: "reviewed", newStatus: "ready",
        newTranslatedSourceHash: row.source_hash, newValue: row.translated_value });
    });
  }

  async function confirmStillApplies(input: {
    translationId: string; actorAdminId: string; entityType: TranslationEntityType; ownerId: string; expectedSourceHash: string;
    expectedLockVersion: number;
  }) {
    validateMutationInput(input);
    return database.begin(async (tx) => {
      const row = await lockAndVerify(tx, input);
      if (row.status !== "stale" || !row.protected_from_automation || !row.translated_value?.trim()) {
        throw new TranslationAdminValidationError("Esta traducción no está disponible para confirmación.");
      }
      const now = new Date().toISOString();
      await cancelActiveJobs(tx, row.id, now);
      await tx.unsafe(
        `UPDATE public.content_translations SET translated_source_hash = source_hash,
           status = 'ready', protected_from_automation = true,
           regeneration_authorized_at = NULL, lock_version = lock_version + 1,
           updated_at = $2::timestamptz WHERE id = $1::uuid`,
        [row.id, now]
      );
      await appendEvent(tx, { row, actorAdminId: input.actorAdminId,
        eventType: "manually_edited", newStatus: "ready",
        newTranslatedSourceHash: row.source_hash, newValue: row.translated_value });
    });
  }

  async function authorizeRegeneration(input: {
    translationId: string; actorAdminId: string; entityType: TranslationEntityType; ownerId: string; expectedSourceHash: string;
    expectedLockVersion: number;
  }) {
    validateMutationInput(input);
    return database.begin(async (tx) => {
      const row = await lockAndVerify(tx, input);
      if (row.regeneration_authorized_at) {
        const active = await tx.unsafe<{ id: string }>(
          `SELECT id::text FROM public.translation_jobs
            WHERE translation_id = $1::uuid AND source_hash = $2
              AND status IN ('queued', 'processing') LIMIT 1`,
          [row.id, row.source_hash]
        );
        if (active[0]) return { jobQueued: false };
      }
      const now = new Date().toISOString();
      const status: TranslationStatus = row.translated_value?.trim() ? "stale" : "pending";
      await tx.unsafe(
        `UPDATE public.content_translations SET protected_from_automation = false,
           regeneration_authorized_at = $2::timestamptz, review_status = 'unreviewed',
           reviewed_at = NULL, reviewed_by = NULL, status = $3,
           lock_version = lock_version + 1, updated_at = $2::timestamptz
         WHERE id = $1::uuid`,
        [row.id, now, status]
      );
      await appendEvent(tx, { row, actorAdminId: input.actorAdminId,
        eventType: "automation_unprotected", newStatus: status,
        newTranslatedSourceHash: row.translated_source_hash, newValue: row.translated_value });
      await appendEvent(tx, { row: { ...row, status }, actorAdminId: input.actorAdminId,
        eventType: "regeneration_authorized", newStatus: status,
        newTranslatedSourceHash: row.translated_source_hash, newValue: row.translated_value });
      const jobs = await tx.unsafe<{ id: string }>(
        `INSERT INTO public.translation_jobs (translation_id, source_hash, priority)
         VALUES ($1::uuid, $2, $3)
         ON CONFLICT (translation_id, source_hash)
           WHERE status IN ('queued', 'processing') DO NOTHING
         RETURNING id::text`,
        [row.id, row.source_hash, ADMIN_REGENERATION_PRIORITY]
      );
      if (jobs[0]) {
        await appendEvent(tx, { row: { ...row, status }, actorAdminId: input.actorAdminId,
          eventType: "job_queued", newStatus: status,
          newTranslatedSourceHash: row.translated_source_hash,
          newValue: row.translated_value, jobId: jobs[0].id });
      }
      return { jobQueued: Boolean(jobs[0]) };
    });
  }

  async function restore(input: {
    translationId: string; actorAdminId: string; entityType: TranslationEntityType; ownerId: string; expectedSourceHash: string;
    expectedLockVersion: number; eventId: string;
  }) {
    validateMutationInput(input);
    if (!UUID.test(input.eventId)) throw new TranslationAdminValidationError("Versión histórica inválida.");
    return database.begin(async (tx) => {
      const row = await lockAndVerify(tx, input);
      const events = await tx.unsafe<{ value: string | null }>(
        `SELECT COALESCE(new_value, previous_value) AS value
           FROM public.translation_revision_events
          WHERE id = $1::uuid AND translation_id = $2::uuid`,
        [input.eventId, row.id]
      );
      const value = events[0]?.value;
      if (!value?.trim()) throw new TranslationAdminValidationError("La versión seleccionada no contiene una traducción restaurable.");
      const now = new Date().toISOString();
      await cancelActiveJobs(tx, row.id, now);
      await tx.unsafe(
        `UPDATE public.content_translations SET translated_value = $2,
           translated_source_hash = source_hash, status = 'ready', origin = 'manual',
           protected_from_automation = true, regeneration_authorized_at = NULL,
           review_status = 'unreviewed', reviewed_at = NULL, reviewed_by = NULL,
           manually_edited_at = $3::timestamptz, lock_version = lock_version + 1,
           updated_at = $3::timestamptz WHERE id = $1::uuid`,
        [row.id, value, now]
      );
      await appendEvent(tx, { row, actorAdminId: input.actorAdminId,
        eventType: "manually_edited", newStatus: "ready",
        newTranslatedSourceHash: row.source_hash, newValue: value });
    });
  }

  return { getEntityTranslations, manualEdit, markReviewed,
    confirmStillApplies, authorizeRegeneration, restore };
}
