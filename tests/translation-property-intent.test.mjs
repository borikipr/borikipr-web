import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test, { after, before, beforeEach } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  applySinglePropertyTranslationIntent,
  assertPropertyIntentCliIsSafe,
  inspectSinglePropertyTranslationIntent,
  parsePropertyIntentCliArgs,
} from "../lib/i18n/translations/property-intent.ts";

const migration0019 = await readFile(fileURLToPath(new URL("../db/migrations/0019_create_translation_persistence.sql", import.meta.url)), "utf8");
const migration0020 = await readFile(fileURLToPath(new URL("../db/migrations/0020_add_translation_regeneration_authorization.sql", import.meta.url)), "utf8");
const db = new PGlite();
const executor = (source) => ({ unsafe: async (query, parameters = []) => (await source.query(query, parameters)).rows });
const database = { ...executor(db), begin: (callback) => db.transaction((tx) => callback(executor(tx))) };
let propertyId;

before(async () => {
  await db.exec(`
    CREATE TABLE propiedades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), titulo text NOT NULL,
      descripcion text, destacado boolean NOT NULL DEFAULT false
    );
    CREATE TABLE testimonios (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), texto text NOT NULL);
    CREATE TABLE admin_users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
  `);
  await db.exec(migration0019);
  await db.exec(migration0020);
});

beforeEach(async () => {
  await db.exec(`DELETE FROM translation_revision_events; DELETE FROM translation_jobs; DELETE FROM content_translations; DELETE FROM propiedades;`);
  propertyId = (await db.query(`INSERT INTO propiedades (titulo, descripcion) VALUES ('Casa', 'Descripción') RETURNING id::text`)).rows[0].id;
});

after(() => db.close());

test("property intent dry-run reports exactly title and description without writes", async () => {
  const beforeState = await db.query(`SELECT (SELECT count(*) FROM content_translations)::int AS translations, (SELECT count(*) FROM translation_jobs)::int AS jobs`);
  const report = await inspectSinglePropertyTranslationIntent(database, propertyId);
  const afterState = await db.query(`SELECT (SELECT count(*) FROM content_translations)::int AS translations, (SELECT count(*) FROM translation_jobs)::int AS jobs`);
  assert.deepEqual(report, {
    eligible: true, entityCount: 1, fieldCount: 2,
    fields: ["title", "description"], existingTranslationRows: 0,
    rowsWouldCreate: 2, jobsWouldQueue: 2, revisionEventsWouldCreate: 4,
    writesApplied: 0, providerCalled: false,
  });
  assert.deepEqual(afterState.rows[0], beforeState.rows[0]);
});

test("property intent apply creates exactly two rows, jobs, and paired events", async () => {
  const report = await applySinglePropertyTranslationIntent(database, propertyId);
  assert.deepEqual(report, {
    eligible: true, entityCount: 1, fieldCount: 2,
    translationsCreated: 2, jobsCreated: 2, revisionEventsCreated: 4,
    writesApplied: 8, providerCalled: false,
  });
  const rows = await db.query(`SELECT field_key, status FROM content_translations ORDER BY field_key`);
  assert.deepEqual(rows.rows, [{ field_key: "description", status: "pending" }, { field_key: "title", status: "pending" }]);
});

test("property intent refuses existing translations and active work", async () => {
  await applySinglePropertyTranslationIntent(database, propertyId);
  await assert.rejects(() => inspectSinglePropertyTranslationIntent(database, propertyId), /property_active_job_present/);
});

test("production dry-run and apply require distinct exact confirmations", () => {
  const databaseUrl = "postgres://example.neon.tech/db";
  const base = parsePropertyIntentCliArgs(["--property-id", propertyId]);
  assert.throws(() => assertPropertyIntentCliIsSafe({ databaseUrl, options: base, environment: { VERCEL_ENV: "production" } }), /production_dry_run_confirmation_required/);
  const dryRun = parsePropertyIntentCliArgs(["--property-id", propertyId, "--allow-production-read-only-dry-run"]);
  assert.doesNotThrow(() => assertPropertyIntentCliIsSafe({ databaseUrl, options: dryRun, environment: { VERCEL_ENV: "production" } }));
  const apply = parsePropertyIntentCliArgs(["--property-id", propertyId, "--apply", "--allow-production-single-property-intent", "--confirm-exactly-one-property-title-and-description"]);
  assert.doesNotThrow(() => assertPropertyIntentCliIsSafe({ databaseUrl, options: apply, environment: { VERCEL_ENV: "production", TRANSLATION_WORKER_ENABLED: "false", MULTILINGUAL_ENABLED: "false" } }));
  assert.throws(() => assertPropertyIntentCliIsSafe({ databaseUrl, options: apply, environment: { VERCEL_ENV: "production", TRANSLATION_WORKER_ENABLED: "true", MULTILINGUAL_ENABLED: "false" } }), /worker_must_be_explicitly_disabled/);
});

test("property intent rejects empty description before creating work", async () => {
  await db.query(`UPDATE propiedades SET descripcion = '' WHERE id = $1`, [propertyId]);
  await assert.rejects(() => inspectSinglePropertyTranslationIntent(database, propertyId), /property_description_empty/);
});
