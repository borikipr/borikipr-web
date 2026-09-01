import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test, { after, before, beforeEach } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  ADMIN_REGENERATION_PRIORITY,
  createTranslationAdminService,
  TranslationAdminConflictError,
  TranslationAdminValidationError,
} from "../lib/i18n/translations/admin-service.ts";
import { getTranslationAdminPresentation } from "../lib/i18n/translations/admin-presentation.ts";
import { syncPropertyTranslationIntents } from "../lib/i18n/translations/source-intents.ts";
import { createTranslationWorkerRepository } from "../lib/i18n/translations/worker-repository.ts";
import { processTranslationJobs } from "../lib/i18n/translations/worker.ts";
import { FakeTranslationProvider } from "../lib/i18n/translations/fake-provider.ts";

const migration0019 = await readFile(fileURLToPath(new URL("../db/migrations/0019_create_translation_persistence.sql", import.meta.url)), "utf8");
const migration0020 = await readFile(fileURLToPath(new URL("../db/migrations/0020_add_translation_regeneration_authorization.sql", import.meta.url)), "utf8");
const migration0021 = await readFile(fileURLToPath(new URL("../db/migrations/0021_add_translation_usage_budget.sql", import.meta.url)), "utf8");

function adapter(db) {
  const executor = (source) => ({
    async unsafe(query, parameters = []) {
      return (await source.query(query, parameters)).rows;
    },
  });
  return {
    ...executor(db),
    begin: (callback) => db.transaction((transaction) => callback(executor(transaction))),
  };
}

const db = new PGlite();
const database = adapter(db);
const service = createTranslationAdminService(database);
let propertyId;
let adminId;
let title;

before(async () => {
  await db.exec(`
    CREATE TABLE propiedades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), titulo text NOT NULL,
      descripcion text, destacado boolean NOT NULL DEFAULT false,
      slug text NOT NULL DEFAULT 'fixture-property'
    );
    CREATE TABLE testimonios (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), texto text NOT NULL,
      activo boolean NOT NULL DEFAULT true
    );
    CREATE TABLE admin_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text NOT NULL UNIQUE,
      display_name text
    );
  `);
  await db.exec(migration0019);
  await db.exec(migration0020);
  await db.exec(migration0021);
});

beforeEach(async () => {
  await db.exec(`
    DELETE FROM translation_revision_events;
    DELETE FROM translation_provider_usage_buckets;
    DELETE FROM translation_jobs;
    DELETE FROM content_translations;
    DELETE FROM propiedades;
    DELETE FROM testimonios;
    DELETE FROM admin_users;
  `);
  propertyId = (await db.query(`INSERT INTO propiedades (titulo, descripcion) VALUES ('Casa Borikí', 'Vista al mar') RETURNING id::text`)).rows[0].id;
  adminId = (await db.query(`INSERT INTO admin_users (username, display_name) VALUES ('ivonne', 'Ivonne Erickson') RETURNING id::text`)).rows[0].id;
  await database.begin((tx) => syncPropertyTranslationIntents(tx, {
    propertyId, title: "Casa Borikí", description: "Vista al mar", highlighted: false,
  }));
  title = (await service.getEntityTranslations({ entityType: "property", ownerId: propertyId }))[0];
});

after(() => db.close());

function common(field = title) {
  return {
    translationId: field.translationId,
    actorAdminId: adminId,
    entityType: "property",
    ownerId: propertyId,
    expectedSourceHash: field.sourceHash,
    expectedLockVersion: field.lockVersion,
  };
}

test("read model batches property fields and represents missing and safe job state", async () => {
  const fields = await service.getEntityTranslations({ entityType: "property", ownerId: propertyId });
  const repeated = await service.getEntityTranslations({ entityType: "property", ownerId: propertyId });
  assert.deepEqual(fields.map((field) => field.fieldKey), ["title", "description"]);
  assert.equal(fields[0].status, "pending");
  assert.equal(fields[0].activeJobStatus, "queued");
  assert.deepEqual(
    repeated[0].events.map((event) => event.id),
    fields[0].events.map((event) => event.id)
  );
  assert.deepEqual(
    new Set(fields[0].events.map((event) => event.eventType)),
    new Set(["created", "job_queued"])
  );
  for (let index = 1; index < fields[0].events.length; index += 1) {
    assert(
      Date.parse(fields[0].events[index - 1].createdAt) >=
        Date.parse(fields[0].events[index].createdAt)
    );
  }
  assert.equal(fields[0].events.some((event) => "lastErrorMessage" in event), false);
});

test("missing property and testimonial translations remain distinct from persisted lifecycle states", async () => {
  await db.exec(`
    DELETE FROM translation_revision_events;
    DELETE FROM translation_jobs;
    DELETE FROM content_translations;
  `);
  const testimonialId = (await db.query(
    `INSERT INTO testimonios (texto) VALUES ('Servicio excelente') RETURNING id::text`
  )).rows[0].id;
  const before = (await db.query(`
    SELECT
      (SELECT count(*)::int FROM content_translations) AS translations,
      (SELECT count(*)::int FROM translation_jobs) AS jobs,
      (SELECT count(*)::int FROM translation_revision_events) AS events
  `)).rows[0];

  const propertyFields = await service.getEntityTranslations({ entityType: "property", ownerId: propertyId });
  const testimonialFields = await service.getEntityTranslations({ entityType: "testimonial", ownerId: testimonialId });
  const after = (await db.query(`
    SELECT
      (SELECT count(*)::int FROM content_translations) AS translations,
      (SELECT count(*)::int FROM translation_jobs) AS jobs,
      (SELECT count(*)::int FROM translation_revision_events) AS events
  `)).rows[0];

  assert.deepEqual(propertyFields.map((field) => field.fieldKey), ["title", "description"]);
  assert.deepEqual(testimonialFields.map((field) => field.fieldKey), ["body"]);
  for (const field of [...propertyFields, ...testimonialFields]) {
    assert.equal(field.translationId, null);
    assert.equal(field.status, "missing");
    assert.equal(field.origin, null);
    assert.equal(field.activeJobStatus, null);
    assert.deepEqual(getTranslationAdminPresentation(field), {
      isMissing: true,
      status: "Sin traducción",
      origin: "No aplica",
      review: "No revisada",
      protection: "No protegida",
      freshness: "No aplica",
      activeJobTerm: "Trabajo activo",
      job: "Ninguno",
      automation: "No autorizada",
    });
  }
  assert.deepEqual(after, before);
});

test("existing translation presentation preserves pending, stale, ready, and protected states", () => {
  const pending = getTranslationAdminPresentation(title);
  assert.equal(pending.status, "Pendiente");
  assert.equal(pending.origin, "Generada automáticamente");

  const stale = getTranslationAdminPresentation({
    ...title,
    status: "stale",
    translatedValue: "Older English",
    isFresh: false,
  });
  assert.equal(stale.status, "Desactualizada");
  assert.equal(stale.freshness, "Desactualizada porque cambió el español");

  const ready = getTranslationAdminPresentation({
    ...title,
    status: "ready",
    translatedValue: "Current English",
    isFresh: true,
    activeJobStatus: null,
    lastJobStatus: "succeeded",
  });
  assert.equal(ready.status, "Lista");
  assert.equal(ready.origin, "Generada automáticamente");
  assert.equal(ready.freshness, "Al día");
  assert.equal(ready.job, "Completado");

  const manualReviewed = getTranslationAdminPresentation({
    ...title,
    status: "ready",
    translatedValue: "Reviewed English",
    origin: "manual",
    reviewStatus: "reviewed",
    protectedFromAutomation: true,
    isFresh: true,
  });
  assert.equal(manualReviewed.origin, "Editada manualmente");
  assert.equal(manualReviewed.review, "Revisada");
  assert.equal(manualReviewed.protection, "Protegida");
});

test("manual edit is protected, audited, cancels active jobs, and rejects stale forms", async () => {
  await assert.rejects(
    service.manualEdit({
      ...common(),
      expectedSourceHash: "0".repeat(64),
      translatedValue: "Forged overwrite",
    }),
    TranslationAdminConflictError
  );
  await service.manualEdit({ ...common(), translatedValue: "Borikí House" });
  const row = (await db.query(`SELECT * FROM content_translations WHERE id = $1`, [title.translationId])).rows[0];
  assert.equal(row.origin, "manual");
  assert.equal(row.status, "ready");
  assert.equal(row.protected_from_automation, true);
  assert.equal(row.regeneration_authorized_at, null);
  assert.equal(row.translated_source_hash, row.source_hash);
  assert.equal((await db.query(`SELECT status FROM translation_jobs WHERE translation_id = $1`, [title.translationId])).rows[0].status, "cancelled");
  assert.equal((await db.query(`SELECT event_type, actor_admin_id::text FROM translation_revision_events WHERE translation_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`, [title.translationId])).rows[0].event_type, "manually_edited");
  await assert.rejects(service.manualEdit({ ...common(), translatedValue: "Overwrite" }), TranslationAdminConflictError);
  await assert.rejects(service.manualEdit({ ...common({ ...title, lockVersion: title.lockVersion + 1 }), translatedValue: "  " }), TranslationAdminValidationError);
});

test("review is server-attributed, protected, and stale values cannot be reviewed", async () => {
  await service.manualEdit({ ...common(), translatedValue: "Borikí House" });
  let current = (await service.getEntityTranslations({ entityType: "property", ownerId: propertyId }))[0];
  await service.markReviewed(common(current));
  let row = (await db.query(`SELECT review_status, reviewed_by::text, protected_from_automation, regeneration_authorized_at FROM content_translations WHERE id = $1`, [title.translationId])).rows[0];
  assert.deepEqual(row, { review_status: "reviewed", reviewed_by: adminId, protected_from_automation: true, regeneration_authorized_at: null });
  await db.query(`UPDATE propiedades SET titulo = 'Casa Borikí renovada' WHERE id = $1`, [propertyId]);
  await database.begin((tx) => syncPropertyTranslationIntents(tx, { propertyId, title: "Casa Borikí renovada", description: "Vista al mar", highlighted: false }));
  current = (await service.getEntityTranslations({ entityType: "property", ownerId: propertyId }))[0];
  await assert.rejects(service.markReviewed(common(current)), TranslationAdminValidationError);
});

test("stale confirmation preserves value and human control while updating freshness", async () => {
  await service.manualEdit({ ...common(), translatedValue: "Borikí House" });
  await db.query(`UPDATE propiedades SET titulo = 'Casa Borikí actualizada' WHERE id = $1`, [propertyId]);
  await database.begin((tx) => syncPropertyTranslationIntents(tx, { propertyId, title: "Casa Borikí actualizada", description: "Vista al mar", highlighted: false }));
  const stale = (await service.getEntityTranslations({ entityType: "property", ownerId: propertyId }))[0];
  assert.equal(stale.status, "stale");
  await service.confirmStillApplies(common(stale));
  const row = (await db.query(`SELECT translated_value, translated_source_hash = source_hash AS fresh, status, protected_from_automation, regeneration_authorized_at FROM content_translations WHERE id = $1`, [title.translationId])).rows[0];
  assert.deepEqual(row, { translated_value: "Borikí House", fresh: true, status: "ready", protected_from_automation: true, regeneration_authorized_at: null });
});

test("regeneration preserves manual origin, records authorization, and queues one priority-25 job", async () => {
  await service.manualEdit({ ...common(), translatedValue: "Borikí House" });
  let current = (await service.getEntityTranslations({ entityType: "property", ownerId: propertyId }))[0];
  const first = await service.authorizeRegeneration(common(current));
  assert.equal(first.jobQueued, true);
  current = (await service.getEntityTranslations({ entityType: "property", ownerId: propertyId }))[0];
  const second = await service.authorizeRegeneration(common(current));
  assert.equal(second.jobQueued, false);
  const row = (await db.query(`SELECT origin, protected_from_automation, regeneration_authorized_at IS NOT NULL AS authorized, review_status, translated_value FROM content_translations WHERE id = $1`, [title.translationId])).rows[0];
  assert.deepEqual(row, { origin: "manual", protected_from_automation: false, authorized: true, review_status: "unreviewed", translated_value: "Borikí House" });
  const jobs = (await db.query(`SELECT priority FROM translation_jobs WHERE translation_id = $1 AND status IN ('queued','processing')`, [title.translationId])).rows;
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].priority, ADMIN_REGENERATION_PRIORITY);
  const events = (await db.query(`SELECT event_type FROM translation_revision_events WHERE translation_id = $1 ORDER BY created_at DESC, id DESC`, [title.translationId])).rows.map((row) => row.event_type);
  assert(events.includes("automation_unprotected"));
  assert(events.includes("regeneration_authorized"));
});

test("worker rejects ordinary unprotected manual, accepts authorized manual, and clears authorization on success", async () => {
  await service.manualEdit({ ...common(), translatedValue: "Old English" });
  await assert.rejects(
    db.query(`UPDATE content_translations SET protected_from_automation = false WHERE id = $1`, [title.translationId]),
    /manual_protection/
  );
  let current = (await service.getEntityTranslations({ entityType: "property", ownerId: propertyId }))[0];
  await service.authorizeRegeneration(common(current));
  const provider = new FakeTranslationProvider();
  await assert.rejects(
    processTranslationJobs({
      repository: createTranslationWorkerRepository(database),
      provider,
      config: { enabled: true, providerId: "google-cloud-translation", batchSize: 1, concurrency: 1, lockTimeoutMs: 600000, requestTimeoutMs: 5000, workerIdPrefix: "admin-test" },
      now: () => new Date("2032-08-01T12:00:00Z"),
      random: () => 0.5,
    }),
    /requires a transaction-capable database/
  );
  assert.equal(provider.requests.length, 0);
  const result = await processTranslationJobs({
    database,
    provider,
    config: { enabled: true, providerId: "google-cloud-translation", batchSize: 1, concurrency: 1, lockTimeoutMs: 600000, requestTimeoutMs: 5000, workerIdPrefix: "admin-test" },
    now: () => new Date("2032-08-01T12:00:00Z"),
    random: () => 0.5,
  });
  assert.equal(result.succeeded, 1);
  assert.equal(provider.requests.length, 1);
  let row = (await db.query(`SELECT translated_value, origin, protected_from_automation, regeneration_authorized_at, review_status, reviewed_at, reviewed_by FROM content_translations WHERE id = $1`, [title.translationId])).rows[0];
  assert.deepEqual(row, {
    translated_value: "[FAKE en-US] Casa Borikí",
    origin: "machine",
    protected_from_automation: false,
    regeneration_authorized_at: null,
    review_status: "unreviewed",
    reviewed_at: null,
    reviewed_by: null,
  });

  current = (await service.getEntityTranslations({ entityType: "property", ownerId: propertyId }))[0];
  await service.manualEdit({ ...common(current), translatedValue: "Newest human value" });
  current = (await service.getEntityTranslations({ entityType: "property", ownerId: propertyId }))[0];
  await service.authorizeRegeneration(common(current));
  const delayedProvider = {
    id: "fake-delayed-human-edit",
    implementationVersion: "1",
    model: null,
    requests: [],
    async translate(request) {
      this.requests.push(request);
      const claimed = (await service.getEntityTranslations({ entityType: "property", ownerId: propertyId }))[0];
      await service.manualEdit({
        ...common(claimed),
        translatedValue: "Human edit during provider request",
      });
      return {
        translatedText: "Obsolete machine result",
        providerId: this.id,
        providerModel: this.model,
        providerVersion: this.implementationVersion,
        providerRequestId: null,
        usage: null,
      };
    },
  };
  const obsolete = await processTranslationJobs({
    database,
    provider: delayedProvider,
    config: { enabled: true, providerId: "google-cloud-translation", batchSize: 1, concurrency: 1, lockTimeoutMs: 600000, requestTimeoutMs: 5000, workerIdPrefix: "admin-test" },
    now: () => new Date("2032-08-01T12:01:00Z"),
    random: () => 0.5,
  });
  assert.equal(delayedProvider.requests.length, 1);
  assert.equal(obsolete.cancelled, 1);
  row = (await db.query(`SELECT translated_value, origin, protected_from_automation, regeneration_authorized_at FROM content_translations WHERE id = $1`, [title.translationId])).rows[0];
  assert.deepEqual(row, {
    translated_value: "Human edit during provider request",
    origin: "manual",
    protected_from_automation: true,
    regeneration_authorized_at: null,
  });
});

test("new Spanish source invalidates authorization and re-protects manual value", async () => {
  await service.manualEdit({ ...common(), translatedValue: "Old English" });
  let current = (await service.getEntityTranslations({ entityType: "property", ownerId: propertyId }))[0];
  await service.authorizeRegeneration(common(current));
  await db.query(`UPDATE propiedades SET titulo = 'Fuente nueva' WHERE id = $1`, [propertyId]);
  await database.begin((tx) => syncPropertyTranslationIntents(tx, { propertyId, title: "Fuente nueva", description: "Vista al mar", highlighted: false }));
  const row = (await db.query(`SELECT status, origin, protected_from_automation, regeneration_authorized_at, translated_value FROM content_translations WHERE id = $1`, [title.translationId])).rows[0];
  assert.deepEqual(row, { status: "stale", origin: "manual", protected_from_automation: true, regeneration_authorized_at: null, translated_value: "Old English" });
});

test("restore uses immutable history, protects the value, and clears authorization", async () => {
  await service.manualEdit({ ...common(), translatedValue: "First version" });
  let current = (await service.getEntityTranslations({ entityType: "property", ownerId: propertyId }))[0];
  await service.manualEdit({ ...common(current), translatedValue: "Second version" });
  current = (await service.getEntityTranslations({ entityType: "property", ownerId: propertyId }))[0];
  const event = current.events.find((item) => item.newValue === "First version");
  const beforeCount = (await db.query(`SELECT count(*)::int AS count FROM translation_revision_events WHERE translation_id = $1`, [title.translationId])).rows[0].count;
  await service.restore({ ...common(current), eventId: event.id });
  const row = (await db.query(`SELECT translated_value, origin, protected_from_automation, regeneration_authorized_at, review_status FROM content_translations WHERE id = $1`, [title.translationId])).rows[0];
  assert.deepEqual(row, { translated_value: "First version", origin: "manual", protected_from_automation: true, regeneration_authorized_at: null, review_status: "unreviewed" });
  const afterCount = (await db.query(`SELECT count(*)::int AS count FROM translation_revision_events WHERE translation_id = $1`, [title.translationId])).rows[0].count;
  assert.equal(afterCount, beforeCount + 1);
});

test("Admin action boundary derives actor from the authenticated session and UI contains safe controls", async () => {
  const actions = await readFile(fileURLToPath(new URL("../app/admin/translations/actions.ts", import.meta.url)), "utf8");
  const panel = await readFile(fileURLToPath(new URL("../components/admin/TranslationAdminPanel.tsx", import.meta.url)), "utf8");
  const presentation = await readFile(fileURLToPath(new URL("../lib/i18n/translations/admin-presentation.ts", import.meta.url)), "utf8");
  assert.match(actions, /getAdminSession\(\)/);
  assert.doesNotMatch(actions, /export\s+const\s+initialTranslationAdminActionState/);
  assert.match(panel, /const\s+initialTranslationAdminActionState:\s*TranslationAdminActionState/);
  assert.match(actions, /actorAdminId: session\.id/);
  assert.doesNotMatch(actions, /formData,\s*"actorAdminId"/);
  assert.match(presentation, /Regeneración automática autorizada/);
  assert.match(panel, /Confirmar que todavía aplica/);
  assert.match(panel, /Restaurar versión/);
  assert.match(panel, /showHistory = true/);
  assert.match(panel, /showHistory && field\.events\.length/);
  assert.match(panel, /break-words/);
  assert.match(panel, /type="hidden" name="expectedSourceHash" value=\{field\.sourceHash\}/);
  assert.match(panel, /disabled=\{disabled \|\| editPending\}/);
  assert.match(panel, /const disabled = presentation\.isMissing/);
  assert.doesNotMatch(panel, />\s*\{field\.sourceHash\}\s*</);
  assert.doesNotMatch(panel, /console\.(?:log|info|debug)\([^\n]*sourceHash/);
  assert.doesNotMatch(panel, /(?:analytics|track)\([^\n]*sourceHash/i);
});

test("property and testimonial editing hide translation history without changing the shared capability", async () => {
  const propertyEditPage = await readFile(fileURLToPath(new URL("../app/admin/propiedades/[id]/editar/page.tsx", import.meta.url)), "utf8");
  const testimonialEditPage = await readFile(fileURLToPath(new URL("../app/admin/testimonios/[id]/editar/page.tsx", import.meta.url)), "utf8");
  assert.match(propertyEditPage, /<TranslationAdminPanel fields=\{translationFields\} showHistory=\{false\} \/>/);
  assert.match(testimonialEditPage, /<TranslationAdminPanel fields=\{translationFields\} showHistory=\{false\} \/>/);
});

test("Admin usage panel exposes aggregate limits and sanitized budget states only", async () => {
  const panel = await readFile(fileURLToPath(new URL("../components/admin/TranslationUsageStatus.tsx", import.meta.url)), "utf8");
  assert.match(panel, />Hoy</);
  assert.match(panel, /label="Caracteres"/);
  assert.match(panel, /Intentos este mes \(UTC\)/);
  assert.match(panel, /Pausados por límite/);
  assert.match(panel, /Traducciones automáticas pausadas por límite de uso\./);
  assert.match(panel, />= TRANSLATION_USAGE_LIMITS\.dailyCharacters \* 0\.8/);
  assert.doesNotMatch(panel, /sourceText|translatedText|customer|email|phone/i);
});
