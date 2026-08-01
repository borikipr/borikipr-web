import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test, { after, before, beforeEach } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  CURRENT_TRANSLATION_HASH_VERSION,
  TRANSLATION_HASH_HEX_LENGTH,
  hashPropertyTranslationSource,
  hashTestimonialTranslationSource,
  hashTranslationSource,
  normalizeTranslationSourceText,
} from "../lib/i18n/translations/hash.ts";
import {
  PROPERTY_TRANSLATION_FIELDS,
  TESTIMONIAL_TRANSLATION_FIELDS,
  TRANSLATION_ENTITY_TYPES,
  TRANSLATION_FIELD_MAPPINGS,
  TRANSLATION_JOB_STATUSES,
  TRANSLATION_ORIGINS,
  TRANSLATION_REVIEW_STATUSES,
  TRANSLATION_STATUSES,
  isTranslationFieldForEntity,
  isTranslationTargetLocale,
} from "../lib/i18n/translations/types.ts";
import { getTranslatedValueOrSpanishFallback } from "../lib/i18n/translations/publishable.ts";
import { createTranslationRepository } from "../lib/i18n/translations/repository.ts";

const migrationSql = await readFile(
  fileURLToPath(
    new URL(
      "../db/migrations/0019_create_translation_persistence.sql",
      import.meta.url
    )
  ),
  "utf8"
);
const regenerationMigrationSql = await readFile(
  fileURLToPath(new URL("../db/migrations/0020_add_translation_regeneration_authorization.sql", import.meta.url)),
  "utf8"
);
const rollbackSql = await readFile(
  fileURLToPath(
    new URL(
      "../db/migrations/0019_create_translation_persistence.rollback.sql",
      import.meta.url
    )
  ),
  "utf8"
);

function pgliteDatabase(db, counter = { count: 0 }) {
  const executor = (source) => ({
    async unsafe(query, parameters = []) {
      counter.count += 1;
      return (await source.query(query, parameters)).rows;
    },
  });
  return {
    ...executor(db),
    begin: (callback) =>
      db.transaction((transaction) => callback(executor(transaction))),
    counter,
  };
}

const db = new PGlite();
let repository;
let propertyId;
let testimonialId;
let adminId;

before(async () => {
  await db.exec(`
    CREATE TABLE public.propiedades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo text NOT NULL,
      descripcion text NOT NULL
    );
    CREATE TABLE public.testimonios (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      texto text NOT NULL
    );
    CREATE TABLE public.admin_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username text NOT NULL UNIQUE
    );
  `);
  await db.exec(migrationSql);
  await db.exec(regenerationMigrationSql);
  repository = createTranslationRepository(pgliteDatabase(db));
});

beforeEach(async () => {
  await db.exec(`
    DELETE FROM public.translation_revision_events;
    DELETE FROM public.translation_jobs;
    DELETE FROM public.content_translations;
    DELETE FROM public.propiedades;
    DELETE FROM public.testimonios;
    DELETE FROM public.admin_users;
  `);
  const property = await db.query(`
    INSERT INTO public.propiedades (titulo, descripcion)
    VALUES ('Casa en Ponce', 'Descripción de prueba')
    RETURNING id::text
  `);
  const testimonial = await db.query(`
    INSERT INTO public.testimonios (texto)
    VALUES ('Excelente servicio')
    RETURNING id::text
  `);
  const admin = await db.query(`
    INSERT INTO public.admin_users (username)
    VALUES ('translation-test-admin')
    RETURNING id::text
  `);
  propertyId = property.rows[0].id;
  testimonialId = testimonial.rows[0].id;
  adminId = admin.rows[0].id;
});

after(async () => {
  await db.close();
});

test("translation domain allowlists and mappings stay explicit", () => {
  assert.deepEqual(TRANSLATION_ENTITY_TYPES, ["property", "testimonial"]);
  assert.deepEqual(PROPERTY_TRANSLATION_FIELDS, ["title", "description"]);
  assert.deepEqual(TESTIMONIAL_TRANSLATION_FIELDS, ["body"]);
  assert.deepEqual(TRANSLATION_STATUSES, [
    "pending",
    "processing",
    "ready",
    "stale",
    "failed",
  ]);
  assert.deepEqual(TRANSLATION_ORIGINS, ["machine", "manual"]);
  assert.deepEqual(TRANSLATION_REVIEW_STATUSES, ["unreviewed", "reviewed"]);
  assert.deepEqual(TRANSLATION_JOB_STATUSES, [
    "queued",
    "processing",
    "succeeded",
    "failed",
    "cancelled",
  ]);
  assert.deepEqual(TRANSLATION_FIELD_MAPPINGS, {
    property: { title: "titulo", description: "descripcion" },
    testimonial: { body: "texto" },
  });
  assert.equal(isTranslationFieldForEntity("property", "title"), true);
  assert.equal(isTranslationFieldForEntity("property", "body"), false);
  assert.equal(isTranslationFieldForEntity("testimonial", "body"), true);
  assert.equal(isTranslationTargetLocale("en-US"), true);
  assert.equal(isTranslationTargetLocale("fr-FR"), false);
});

test("source hashing is stable, versioned, and exactly 64 lowercase hex characters", () => {
  const hash = hashPropertyTranslationSource("title", "Casa en Ponce");
  assert.equal(hash.length, TRANSLATION_HASH_HEX_LENGTH);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(
    hash,
    "4c7fd1f98a44d14a70c0e68d9e1b36b5e1209f9e23fb016a4981c348e4ed872f"
  );
  assert.equal(CURRENT_TRANSLATION_HASH_VERSION, 1);
  assert.notEqual(
    hash,
    hashPropertyTranslationSource("title", "Casa en Ponce", 2)
  );
});

test("hash normalization uses NFC and normalizes CRLF/CR without changing meaning", () => {
  assert.equal(normalizeTranslationSourceText("A\r\nB\rC"), "A\nB\nC");
  assert.equal(
    hashPropertyTranslationSource("description", "Café\r\nPonce"),
    hashPropertyTranslationSource("description", "Cafe\u0301\nPonce")
  );
  assert.notEqual(
    hashPropertyTranslationSource("description", "Casa"),
    hashPropertyTranslationSource("description", "casa")
  );
  assert.notEqual(
    hashPropertyTranslationSource("description", "café"),
    hashPropertyTranslationSource("description", "cafe")
  );
  assert.notEqual(
    hashPropertyTranslationSource("description", " Casa "),
    hashPropertyTranslationSource("description", "Casa")
  );
  assert.notEqual(
    hashTranslationSource({
      entityType: "property",
      fieldKey: "title",
      sourceText: "Texto",
    }),
    hashTranslationSource({
      entityType: "property",
      fieldKey: "description",
      sourceText: "Texto",
    })
  );
  assert.notEqual(
    hashPropertyTranslationSource("description", "Texto"),
    hashTestimonialTranslationSource("body", "Texto")
  );
});

test("publishability helper returns only current, non-empty ready translations", () => {
  const hash = "a".repeat(64);
  assert.equal(
    getTranslatedValueOrSpanishFallback(
      {
        status: "ready",
        translatedValue: "House",
        sourceHash: hash,
        translatedSourceHash: hash,
      },
      "Casa"
    ),
    "House"
  );
  for (const candidate of [
    {
      status: "stale",
      translatedValue: "Old house",
      sourceHash: hash,
      translatedSourceHash: "b".repeat(64),
    },
    {
      status: "failed",
      translatedValue: "House",
      sourceHash: hash,
      translatedSourceHash: hash,
    },
    {
      status: "ready",
      translatedValue: "   ",
      sourceHash: hash,
      translatedSourceHash: hash,
    },
  ]) {
    assert.equal(
      getTranslatedValueOrSpanishFallback(candidate, "Casa"),
      "Casa"
    );
  }
});

test("migration creates the complete typed schema, constraints, and indexes", async () => {
  const tables = await db.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public'
      AND table_name LIKE 'translation%'
       OR table_schema='public' AND table_name='content_translations'
    ORDER BY table_name
  `);
  assert.deepEqual(tables.rows.map((row) => row.table_name), [
    "content_translations",
    "translation_jobs",
    "translation_revision_events",
  ]);
  const checks = await db.query(`
    SELECT rel.relname AS table_name, count(*)::int AS count
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid=con.conrelid
    WHERE rel.relname IN (
      'content_translations',
      'translation_jobs',
      'translation_revision_events'
    )
      AND con.contype='c'
    GROUP BY rel.relname
    ORDER BY rel.relname
  `);
  assert.deepEqual(checks.rows, [
    { table_name: "content_translations", count: 17 },
    { table_name: "translation_jobs", count: 12 },
    { table_name: "translation_revision_events", count: 7 },
  ]);
  const indexes = await db.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname='public'
      AND indexname IN (
        'content_translations_property_locale_field_uidx',
        'content_translations_testimonial_locale_field_uidx',
        'content_translations_property_id_idx',
        'content_translations_testimonial_id_idx',
        'content_translations_status_updated_at_idx',
        'translation_jobs_active_source_uidx',
        'translation_jobs_claim_idx',
        'translation_jobs_processing_locked_at_idx',
        'translation_jobs_status_updated_at_idx',
        'translation_revision_events_translation_created_at_idx',
        'translation_revision_events_actor_created_at_idx'
      )
  `);
  assert.equal(indexes.rows.length, 11);
});

test("database rejects invalid owners, fields, locales, hashes, and ready values", async () => {
  const hash = "a".repeat(64);
  const invalidStatements = [
    {
      sql: `INSERT INTO content_translations (
        target_locale, field_key, source_hash
      ) VALUES ('en-US', 'title', $1)`,
      params: [hash],
    },
    {
      sql: `INSERT INTO content_translations (
        property_id, testimonial_id, target_locale, field_key, source_hash
      ) VALUES ($1::uuid, $2::uuid, 'en-US', 'title', $3)`,
      params: [propertyId, testimonialId, hash],
    },
    {
      sql: `INSERT INTO content_translations (
        property_id, target_locale, field_key, source_hash
      ) VALUES ($1::uuid, 'en-US', 'body', $2)`,
      params: [propertyId, hash],
    },
    {
      sql: `INSERT INTO content_translations (
        testimonial_id, target_locale, field_key, source_hash
      ) VALUES ($1::uuid, 'en-US', 'title', $2)`,
      params: [testimonialId, hash],
    },
    {
      sql: `INSERT INTO content_translations (
        property_id, target_locale, field_key, source_hash
      ) VALUES ($1::uuid, 'fr-FR', 'title', $2)`,
      params: [propertyId, hash],
    },
    {
      sql: `INSERT INTO content_translations (
        property_id, target_locale, field_key, source_hash
      ) VALUES ($1::uuid, 'en-US', 'title', 'short')`,
      params: [propertyId],
    },
    {
      sql: `INSERT INTO content_translations (
        property_id, target_locale, field_key, source_hash,
        status, translated_value, translated_source_hash
      ) VALUES ($1::uuid, 'en-US', 'title', $2, 'ready', ' ', $2)`,
      params: [propertyId, hash],
    },
    {
      sql: `INSERT INTO content_translations (
        property_id, target_locale, field_key, source_hash,
        origin, protected_from_automation
      ) VALUES ($1::uuid, 'en-US', 'title', $2, 'manual', false)`,
      params: [propertyId, hash],
    },
  ];
  for (const statement of invalidStatements) {
    await assert.rejects(db.query(statement.sql, statement.params));
  }
});

test("property and testimonial ensure operations are idempotent and typed", async () => {
  const propertyHash = hashPropertyTranslationSource("title", "Casa en Ponce");
  const first = await repository.ensurePropertyTranslation({
    propertyId,
    targetLocale: "en-US",
    fieldKey: "title",
    sourceHash: propertyHash,
    hashVersion: 1,
  });
  const repeated = await repository.ensurePropertyTranslation({
    propertyId,
    targetLocale: "en-US",
    fieldKey: "title",
    sourceHash: propertyHash,
    hashVersion: 1,
  });
  assert.equal(first.id, repeated.id);

  const testimonial = await repository.ensureTestimonialTranslation({
    testimonialId,
    targetLocale: "en-US",
    fieldKey: "body",
    sourceHash: hashTestimonialTranslationSource("body", "Excelente servicio"),
    hashVersion: 1,
  });
  assert.equal(testimonial.entityType, "testimonial");
  await assert.rejects(
    repository.ensurePropertyTranslation({
      propertyId,
      targetLocale: "en-US",
      fieldKey: "body",
      sourceHash: propertyHash,
      hashVersion: 1,
    }),
    /not allowed/
  );
});

test("batch repositories use one query per entity batch", async () => {
  const counter = { count: 0 };
  const countedRepository = createTranslationRepository(
    pgliteDatabase(db, counter)
  );
  await repository.ensurePropertyTranslation({
    propertyId,
    targetLocale: "en-US",
    fieldKey: "title",
    sourceHash: "a".repeat(64),
    hashVersion: 1,
  });
  await repository.ensureTestimonialTranslation({
    testimonialId,
    targetLocale: "en-US",
    fieldKey: "body",
    sourceHash: "b".repeat(64),
    hashVersion: 1,
  });
  counter.count = 0;
  const properties = await countedRepository.fetchPropertyTranslations(
    [propertyId],
    "en-US",
    ["title"]
  );
  assert.equal(counter.count, 1);
  assert.equal(properties.length, 1);
  const testimonials = await countedRepository.fetchTestimonialTranslations(
    [testimonialId],
    "en-US"
  );
  assert.equal(counter.count, 2);
  assert.equal(testimonials.length, 1);
});

test("active jobs are idempotent and completed jobs do not block a new source hash", async () => {
  const translation = await repository.ensurePropertyTranslation({
    propertyId,
    targetLocale: "en-US",
    fieldKey: "title",
    sourceHash: "a".repeat(64),
    hashVersion: 1,
  });
  const first = await repository.enqueueTranslationJob({
    translationId: translation.id,
    sourceHash: translation.sourceHash,
  });
  const repeated = await repository.enqueueTranslationJob({
    translationId: translation.id,
    sourceHash: translation.sourceHash,
  });
  assert.equal(first.id, repeated.id);
  await db.query(
    `UPDATE translation_jobs
        SET status='cancelled', completed_at=now(), updated_at=now()
      WHERE id=$1::uuid`,
    [first.id]
  );
  const nextHash = "b".repeat(64);
  const next = await repository.enqueueTranslationJob({
    translationId: translation.id,
    sourceHash: nextHash,
  });
  assert.notEqual(next.id, first.id);
});

test("stale transitions preserve values and optimistic locking rejects old versions", async () => {
  const sourceHash = "a".repeat(64);
  const translation = await repository.ensurePropertyTranslation({
    propertyId,
    targetLocale: "en-US",
    fieldKey: "title",
    sourceHash,
    hashVersion: 1,
  });
  const manual = await repository.updateTranslationOptimistically({
    translationId: translation.id,
    expectedLockVersion: translation.lockVersion,
    translatedValue: "House in Ponce",
    translatedSourceHash: sourceHash,
    status: "ready",
    origin: "manual",
    reviewStatus: "reviewed",
    protectedFromAutomation: true,
    reviewedBy: adminId,
  });
  assert.ok(manual);
  const stale = await repository.markTranslationStale({
    translationId: translation.id,
    sourceHash: "b".repeat(64),
  });
  assert.equal(stale.status, "stale");
  assert.equal(stale.translatedValue, "House in Ponce");
  assert.equal(stale.protectedFromAutomation, true);

  const rejected = await repository.updateTranslationOptimistically({
    translationId: translation.id,
    expectedLockVersion: translation.lockVersion,
    translatedValue: "Outdated write",
    translatedSourceHash: "b".repeat(64),
    status: "ready",
    origin: "manual",
    reviewStatus: "reviewed",
    protectedFromAutomation: true,
    reviewedBy: adminId,
  });
  assert.equal(rejected, null);
});

test("source-hash lifecycle queues unprotected rows and preserves protected rows as stale", async () => {
  const unprotected = await repository.ensurePropertyTranslation({
    propertyId,
    targetLocale: "en-US",
    fieldKey: "title",
    sourceHash: "a".repeat(64),
    hashVersion: 1,
  });
  const pending = await repository.updateSourceHashAndLifecycle({
    translationId: unprotected.id,
    sourceHash: "b".repeat(64),
    hashVersion: 1,
    expectedLockVersion: unprotected.lockVersion,
  });
  assert.equal(pending.status, "pending");
  assert.equal(pending.sourceHash, "b".repeat(64));

  const protectedTranslation = await repository.ensurePropertyTranslation({
    propertyId,
    targetLocale: "en-US",
    fieldKey: "description",
    sourceHash: "c".repeat(64),
    hashVersion: 1,
  });
  const manual = await repository.updateTranslationOptimistically({
    translationId: protectedTranslation.id,
    expectedLockVersion: protectedTranslation.lockVersion,
    translatedValue: "Protected description",
    translatedSourceHash: protectedTranslation.sourceHash,
    status: "ready",
    origin: "manual",
    reviewStatus: "unreviewed",
    protectedFromAutomation: true,
  });
  const stale = await repository.updateSourceHashAndLifecycle({
    translationId: protectedTranslation.id,
    sourceHash: "d".repeat(64),
    hashVersion: 1,
    expectedLockVersion: manual.lockVersion,
  });
  assert.equal(stale.status, "stale");
  assert.equal(stale.translatedValue, "Protected description");
});

test("machine results require the exact active job, hash, lifecycle, and unprotected row", async () => {
  const sourceHash = "a".repeat(64);
  const translation = await repository.ensurePropertyTranslation({
    propertyId,
    targetLocale: "en-US",
    fieldKey: "description",
    sourceHash,
    hashVersion: 1,
  });
  const job = await repository.enqueueTranslationJob({
    translationId: translation.id,
    sourceHash,
  });
  await db.query(
    `UPDATE content_translations SET status='processing' WHERE id=$1::uuid`,
    [translation.id]
  );
  await db.query(
    `UPDATE translation_jobs
        SET status='processing', locked_at=now(), locked_by='test-worker',
            started_at=now(), updated_at=now()
      WHERE id=$1::uuid`,
    [job.id]
  );
  const mismatch = await repository.writeMachineTranslationResult({
    translationId: translation.id,
    jobId: job.id,
    sourceHash: "b".repeat(64),
    translatedValue: "Wrong",
    provider: "test-provider",
  });
  assert.equal(mismatch, null);

  await db.query(
    `UPDATE content_translations SET protected_from_automation=true
      WHERE id=$1::uuid`,
    [translation.id]
  );
  const protectedResult = await repository.writeMachineTranslationResult({
    translationId: translation.id,
    jobId: job.id,
    sourceHash,
    translatedValue: "Protected overwrite",
    provider: "test-provider",
  });
  assert.equal(protectedResult, null);

  await db.query(
    `UPDATE content_translations SET protected_from_automation=false
      WHERE id=$1::uuid`,
    [translation.id]
  );
  const success = await repository.writeMachineTranslationResult({
    translationId: translation.id,
    jobId: job.id,
    sourceHash,
    translatedValue: "Test description",
    provider: "test-provider",
    providerModel: "fixture",
  });
  assert.equal(success.status, "ready");
  assert.equal(success.translatedValue, "Test description");
});

test("revision events append and return in requested order", async () => {
  const translation = await repository.ensurePropertyTranslation({
    propertyId,
    targetLocale: "en-US",
    fieldKey: "title",
    sourceHash: "a".repeat(64),
    hashVersion: 1,
  });
  await repository.appendRevisionEvent({
    translationId: translation.id,
    eventType: "created",
    newSourceHash: translation.sourceHash,
    newStatus: "pending",
  });
  await new Promise((resolve) => setTimeout(resolve, 2));
  await repository.appendRevisionEvent({
    translationId: translation.id,
    eventType: "source_changed",
    previousSourceHash: translation.sourceHash,
    newSourceHash: "b".repeat(64),
    previousStatus: "pending",
    newStatus: "stale",
  });
  const ascending = await repository.listRevisionEvents(
    translation.id,
    "asc"
  );
  assert.deepEqual(
    ascending.map((event) => event.eventType),
    ["created", "source_changed"]
  );
  const descending = await repository.listRevisionEvents(
    translation.id,
    "desc"
  );
  assert.deepEqual(
    descending.map((event) => event.eventType),
    ["source_changed", "created"]
  );
});

test("source deletion cascades translations, jobs, and revisions without altering other Spanish rows", async () => {
  const translation = await repository.ensurePropertyTranslation({
    propertyId,
    targetLocale: "en-US",
    fieldKey: "title",
    sourceHash: "a".repeat(64),
    hashVersion: 1,
  });
  await repository.enqueueTranslationJob({
    translationId: translation.id,
    sourceHash: translation.sourceHash,
  });
  await repository.appendRevisionEvent({
    translationId: translation.id,
    eventType: "created",
    newSourceHash: translation.sourceHash,
  });
  await db.query(`DELETE FROM propiedades WHERE id=$1::uuid`, [propertyId]);
  const counts = await db.query(`
    SELECT
      (SELECT count(*)::int FROM content_translations) AS translations,
      (SELECT count(*)::int FROM translation_jobs) AS jobs,
      (SELECT count(*)::int FROM translation_revision_events) AS revisions,
      (SELECT count(*)::int FROM testimonios) AS testimonials
  `);
  assert.deepEqual(counts.rows, [
    { translations: 0, jobs: 0, revisions: 0, testimonials: 1 },
  ]);
});

test("guarded rollback preserves Spanish data and refuses derived translation data", async () => {
  const isolated = new PGlite();
  try {
    await isolated.exec(`
      CREATE TABLE public.propiedades (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        titulo text NOT NULL,
        descripcion text NOT NULL
      );
      CREATE TABLE public.testimonios (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        texto text NOT NULL
      );
      CREATE TABLE public.admin_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        username text NOT NULL UNIQUE
      );
      INSERT INTO public.propiedades (titulo, descripcion)
      VALUES ('Casa', 'Descripción');
      INSERT INTO public.testimonios (texto) VALUES ('Testimonio');
    `);
    await isolated.exec(migrationSql);
    const property = await isolated.query(
      `SELECT id::text FROM propiedades LIMIT 1`
    );
    await isolated.query(
      `INSERT INTO content_translations (
         property_id, target_locale, field_key, source_hash
       ) VALUES ($1::uuid, 'en-US', 'title', $2)`,
      [property.rows[0].id, "a".repeat(64)]
    );
    await assert.rejects(isolated.exec(rollbackSql), /Cannot roll back 0019/);
    await isolated.exec(`ROLLBACK`);
    await isolated.exec(`DELETE FROM content_translations`);
    await isolated.exec(rollbackSql);
    const preserved = await isolated.query(`
      SELECT
        to_regclass('public.content_translations') IS NULL AS removed,
        (SELECT count(*)::int FROM propiedades) AS properties,
        (SELECT count(*)::int FROM testimonios) AS testimonials
    `);
    assert.deepEqual(preserved.rows, [
      { removed: true, properties: 1, testimonials: 1 },
    ]);
  } finally {
    await isolated.close();
  }
});

test("translation persistence leaves Spanish repositories and SEO isolated while Phase 4 stays gated", async () => {
  const [
    propertyQueries,
    testimonialQueries,
    englishLayout,
    englishPropertyRoute,
    localeDefinitions,
    sitemap,
    robots,
    schemaAudit,
  ] = await Promise.all([
      readFile(
        fileURLToPath(
          new URL("../lib/queries/propiedades.ts", import.meta.url)
        ),
        "utf8"
      ),
      readFile(
        fileURLToPath(
          new URL("../lib/queries/testimonios.ts", import.meta.url)
        ),
        "utf8"
      ),
      readFile(
        fileURLToPath(new URL("../app/(public)/en/layout.tsx", import.meta.url)),
        "utf8"
      ),
      readFile(
        fileURLToPath(
          new URL("../app/(public)/en/listings/[slug]/page.tsx", import.meta.url)
        ),
        "utf8"
      ),
      readFile(
        fileURLToPath(new URL("../lib/i18n/locales.ts", import.meta.url)),
        "utf8"
      ),
      readFile(
        fileURLToPath(new URL("../app/sitemap.ts", import.meta.url)),
        "utf8"
      ),
      readFile(
        fileURLToPath(new URL("../app/robots.ts", import.meta.url)),
        "utf8"
      ),
      readFile(
        fileURLToPath(
          new URL("../scripts/migrations/audit-schema-version.mjs", import.meta.url)
        ),
        "utf8"
      ),
    ]);
  assert.doesNotMatch(propertyQueries, /content_translations|translation_jobs/);
  assert.doesNotMatch(testimonialQueries, /content_translations|translation_jobs/);
  assert.match(localeDefinitions, /MULTILINGUAL_ENABLED/);
  assert.doesNotMatch(sitemap, /content_translations|translation_jobs/);
  assert.doesNotMatch(robots, /content_translations|translation_jobs/);
  assert.match(schemaAudit, /AS v0019/);
  assert.match(schemaAudit, /content_translations/);
  assert.match(schemaAudit, /translation_revision_events/);
  assert.match(englishLayout, /isMultilingualEnabled\(\)/);
  assert.match(englishLayout, /notFound\(\)/);
  assert.match(englishPropertyRoute, /renderPropertyDetailPage/);
  assert.match(englishPropertyRoute, /generateLocalizedPropertyMetadata/);
  assert.doesNotMatch(englishPropertyRoute, /<main|content_translations|translation_jobs/);
});
