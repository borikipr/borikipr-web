import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test, { after, before, beforeEach } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  assertTranslationBackfillApplyIsSafe,
  runTranslationBackfill,
} from "../lib/i18n/translations/backfill.ts";
import {
  syncPropertyTranslationIntents,
  syncTestimonialTranslationIntent,
  TRANSLATION_JOB_PRIORITIES,
} from "../lib/i18n/translations/source-intents.ts";

const migrationSql = await readFile(
  fileURLToPath(
    new URL("../db/migrations/0019_create_translation_persistence.sql", import.meta.url)
  ),
  "utf8"
);
const regenerationMigrationSql = await readFile(
  fileURLToPath(new URL("../db/migrations/0020_add_translation_regeneration_authorization.sql", import.meta.url)),
  "utf8"
);
function pgliteDatabase(db) {
  const executor = (source) => ({
    async unsafe(query, parameters = []) {
      return (await source.query(query, parameters)).rows;
    },
  });
  return {
    ...executor(db),
    begin: (callback) =>
      db.transaction((transaction) => callback(executor(transaction))),
  };
}

const db = new PGlite();
const database = pgliteDatabase(db);
let propertyId;
let testimonialId;

before(async () => {
  await db.exec(`
    CREATE TABLE public.propiedades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo text NOT NULL, descripcion text, destacado boolean NOT NULL DEFAULT false
    );
    CREATE TABLE public.testimonios (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      texto text NOT NULL, activo boolean NOT NULL DEFAULT true
    );
    CREATE TABLE public.admin_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text NOT NULL UNIQUE
    );
  `);
  await db.exec(migrationSql);
  await db.exec(regenerationMigrationSql);
});
beforeEach(async () => {
  await db.exec(`
    DELETE FROM translation_revision_events;
    DELETE FROM translation_jobs;
    DELETE FROM content_translations;
    DELETE FROM propiedades;
    DELETE FROM testimonios;
  `);
  propertyId = (
    await db.query(`
      INSERT INTO propiedades (titulo, descripcion)
      VALUES ('Casa en Ponce', 'Descripción original') RETURNING id::text
    `)
  ).rows[0].id;
  testimonialId = (
    await db.query(`
      INSERT INTO testimonios (texto, activo)
      VALUES ('Excelente servicio', true) RETURNING id::text
    `)
  ).rows[0].id;
});
after(async () => db.close());

async function counts() {
  const translations = await db.query(
    "SELECT count(*)::integer count FROM content_translations"
  );
  const jobs = await db.query("SELECT count(*)::integer count FROM translation_jobs");
  const events = await db.query(
    "SELECT count(*)::integer count FROM translation_revision_events"
  );
  return {
    translations: translations.rows[0].count,
    jobs: jobs.rows[0].count,
    events: events.rows[0].count,
  };
}

test("new property creates two translation intents, jobs and events atomically", async () => {
  await database.begin((transaction) =>
    syncPropertyTranslationIntents(transaction, {
      propertyId,
      title: "Casa en Ponce",
      description: "Descripción original",
      highlighted: false,
    })
  );
  assert.deepEqual(await counts(), { translations: 2, jobs: 2, events: 4 });
  const jobs = await db.query("SELECT priority FROM translation_jobs");
  assert.deepEqual(
    jobs.rows.map((row) => row.priority),
    [100, 100]
  );
});

test("identical saves do nothing and highlighted properties use central priority", async () => {
  await database.begin((transaction) =>
    syncPropertyTranslationIntents(transaction, {
      propertyId,
      title: "Casa en Ponce",
      description: "Descripción original",
      highlighted: true,
    })
  );
  const before = await counts();
  const result = await database.begin((transaction) =>
    syncPropertyTranslationIntents(transaction, {
      propertyId,
      title: "Casa en Ponce",
      description: "Descripción original",
      highlighted: true,
    })
  );
  assert.deepEqual(await counts(), before);
  assert.deepEqual(result.map((item) => item.outcome), ["unchanged", "unchanged"]);
  const priorities = await db.query("SELECT DISTINCT priority FROM translation_jobs");
  assert.deepEqual(priorities.rows, [
    { priority: TRANSLATION_JOB_PRIORITIES.highlightedProperty },
  ]);
});

test("one changed field becomes stale, preserves its value and queues one job", async () => {
  await database.begin((transaction) =>
    syncPropertyTranslationIntents(transaction, {
      propertyId,
      title: "Casa en Ponce",
      description: "Descripción original",
      highlighted: false,
    })
  );
  await db.exec(`
    UPDATE content_translations
       SET translated_value = 'Original description',
           translated_source_hash = source_hash, status = 'ready'
     WHERE property_id = '${propertyId}'::uuid AND field_key = 'description';
    UPDATE translation_jobs SET status = 'succeeded', completed_at = now();
  `);
  const result = await database.begin((transaction) =>
    syncPropertyTranslationIntents(transaction, {
      propertyId,
      title: "Casa en Ponce",
      description: "Descripción revisada",
      highlighted: false,
    })
  );
  assert.deepEqual(result.map((item) => item.outcome), ["unchanged", "changed"]);
  const row = await db.query(`
    SELECT status, translated_value, source_hash = translated_source_hash AS current
      FROM content_translations
     WHERE property_id = '${propertyId}'::uuid AND field_key = 'description'
  `);
  assert.deepEqual(row.rows[0], {
    status: "stale",
    translated_value: "Original description",
    current: false,
  });
  assert.equal(
    (await db.query("SELECT count(*)::int count FROM translation_jobs")).rows[0].count,
    3
  );
});

test("protected source changes preserve the value and do not queue automation", async () => {
  await database.begin((transaction) =>
    syncTestimonialTranslationIntent(transaction, {
      testimonialId,
      body: "Excelente servicio",
      active: true,
    })
  );
  await db.exec(`
    UPDATE content_translations
       SET translated_value = 'Excellent service',
           translated_source_hash = source_hash, status = 'ready',
           origin = 'manual', protected_from_automation = true
     WHERE testimonial_id = '${testimonialId}'::uuid;
    UPDATE translation_jobs SET status = 'succeeded', completed_at = now();
  `);
  const result = await database.begin((transaction) =>
    syncTestimonialTranslationIntent(transaction, {
      testimonialId,
      body: "Servicio extraordinario",
      active: true,
    })
  );
  assert.equal(result.outcome, "changed");
  assert.equal(result.jobQueued, false);
  const row = await db.query(`
    SELECT status, translated_value, protected_from_automation
      FROM content_translations WHERE testimonial_id = '${testimonialId}'::uuid
  `);
  assert.deepEqual(row.rows[0], {
    status: "stale",
    translated_value: "Excellent service",
    protected_from_automation: true,
  });
  assert.equal(
    (await db.query("SELECT count(*)::int count FROM translation_jobs")).rows[0].count,
    1
  );
});

test("source and translation intents roll back together on later failure", async () => {
  await assert.rejects(
    database.begin(async (transaction) => {
      await transaction.unsafe(
        "UPDATE propiedades SET titulo = $2 WHERE id = $1::uuid",
        [propertyId, "Título revertido"]
      );
      await syncPropertyTranslationIntents(transaction, {
        propertyId,
        title: "Título revertido",
        description: "Descripción original",
        highlighted: false,
      });
      throw new Error("simulated image failure");
    }),
    /simulated image failure/
  );
  assert.equal(
    (await db.query("SELECT titulo FROM propiedades WHERE id = $1::uuid", [propertyId]))
      .rows[0].titulo,
    "Casa en Ponce"
  );
  assert.deepEqual(await counts(), { translations: 0, jobs: 0, events: 0 });
});

test("testimonial body participates while unrelated changes create no new intent", async () => {
  await database.begin((transaction) =>
    syncTestimonialTranslationIntent(transaction, {
      testimonialId,
      body: "Excelente servicio",
      active: true,
    })
  );
  const before = await counts();
  await db.query("UPDATE testimonios SET activo = false WHERE id = $1::uuid", [
    testimonialId,
  ]);
  const result = await database.begin((transaction) =>
    syncTestimonialTranslationIntent(transaction, {
      testimonialId,
      body: "Excelente servicio",
      active: false,
    })
  );
  assert.equal(result.outcome, "unchanged");
  assert.deepEqual(await counts(), before);
  const job = await db.query("SELECT priority FROM translation_jobs");
  assert.equal(job.rows[0].priority, TRANSLATION_JOB_PRIORITIES.activeTestimonial);
});

test("dry-run backfill is read-only and apply mode is local-only", async () => {
  const before = await counts();
  const report = await runTranslationBackfill(database);
  assert.deepEqual(
    {
      properties: report.propertiesInspected,
      testimonials: report.testimonialsInspected,
      fields: report.translatableFields,
      missing: report.missingTranslations,
      jobs: report.jobsWouldQueue,
      writes: report.writesApplied,
    },
    { properties: 1, testimonials: 1, fields: 3, missing: 3, jobs: 3, writes: 0 }
  );
  assert.deepEqual(await counts(), before);
  assert.doesNotThrow(() =>
    assertTranslationBackfillApplyIsSafe({
      databaseUrl: "postgres://local@localhost/test",
      apply: false,
      confirmedLocal: false,
    })
  );
  assert.throws(
    () =>
      assertTranslationBackfillApplyIsSafe({
        databaseUrl: "postgres://redacted@ep-example.neon.tech/prod",
        apply: false,
        confirmedLocal: false,
      }),
    /allow-production-read-only-dry-run/
  );
  assert.throws(
    () =>
      assertTranslationBackfillApplyIsSafe({
        databaseUrl: "postgres://local@localhost/test",
        apply: true,
        confirmedLocal: false,
      }),
    /restricted/
  );
});

test("empty optional descriptions are skipped without placeholder content", async () => {
  const result = await database.begin((transaction) =>
    syncPropertyTranslationIntents(transaction, {
      propertyId,
      title: "Casa en Ponce",
      description: "",
      highlighted: false,
    })
  );
  assert.deepEqual(result.map((item) => item.outcome), ["created", "empty"]);
  assert.deepEqual(await counts(), { translations: 1, jobs: 1, events: 2 });
});

test("admin write flows keep source, images, intents and availability sequencing transactional", async () => {
  const propertyActions = await readFile(
    fileURLToPath(new URL("../app/admin/propiedades/actions.ts", import.meta.url)),
    "utf8"
  );
  const testimonialActions = await readFile(
    fileURLToPath(new URL("../app/admin/testimonios/actions.ts", import.meta.url)),
    "utf8"
  );
  assert.match(
    propertyActions,
    /insertadaId = await sql\.begin[\s\S]*INSERT INTO public\.propiedades[\s\S]*INSERT INTO public\.propiedad_imagenes[\s\S]*syncPropertyTranslationIntents/
  );
  assert.match(
    propertyActions,
    /syncPropertyTranslationIntents[\s\S]*queueAvailabilityNotificationIntentsInTransaction[\s\S]*deliverAvailabilityNotificationIntents/
  );
  assert.match(
    testimonialActions,
    /insertadoId = await sql\.begin[\s\S]*INSERT INTO public\.testimonios[\s\S]*syncTestimonialTranslationIntent/
  );
  assert.match(
    testimonialActions,
    /const rows = await sql\.begin[\s\S]*FOR UPDATE[\s\S]*UPDATE public\.testimonios[\s\S]*syncTestimonialTranslationIntent/
  );
});
