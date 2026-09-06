import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test, { after, before, beforeEach } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { handleTranslationWorkerCron } from "../lib/i18n/translations/cron-handler.ts";
import {
  readTranslationWorkerConfig,
  resolveConfiguredTranslationProvider,
} from "../lib/i18n/translations/provider-registry.ts";
import { syncPropertyTranslationIntents } from "../lib/i18n/translations/source-intents.ts";
import { createTranslationWorkerRepository } from "../lib/i18n/translations/worker-repository.ts";

const migrationSql = await readFile(fileURLToPath(new URL("../db/migrations/0019_create_translation_persistence.sql", import.meta.url)), "utf8");
const regenerationMigrationSql = await readFile(fileURLToPath(new URL("../db/migrations/0020_add_translation_regeneration_authorization.sql", import.meta.url)), "utf8");
const usageBudgetMigrationSql = await readFile(fileURLToPath(new URL("../db/migrations/0021_add_translation_usage_budget.sql", import.meta.url)), "utf8");
const azureProviderMigrationSql = await readFile(fileURLToPath(new URL("../db/migrations/0053_allow_azure_translation_provider.sql", import.meta.url)), "utf8");
function adapter(db) {
  const executor = (source) => ({ async unsafe(query, parameters = []) {
    return (await source.query(query, parameters)).rows;
  } });
  return { ...executor(db), begin: (callback) => db.transaction((tx) => callback(executor(tx))) };
}

const db = new PGlite();
const database = adapter(db);
const repository = createTranslationWorkerRepository(database);
const now = new Date("2031-08-01T12:00:00.000Z");
let propertyId;

before(async () => {
  await db.exec(`
    CREATE TABLE propiedades (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), titulo text NOT NULL, descripcion text, destacado boolean NOT NULL DEFAULT false, slug text NOT NULL DEFAULT 'fixture-property');
    CREATE TABLE testimonios (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), texto text NOT NULL, activo boolean NOT NULL DEFAULT true);
    CREATE TABLE admin_users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text NOT NULL UNIQUE);
  `);
  await db.exec(migrationSql);
  await db.exec(regenerationMigrationSql);
  await db.exec(usageBudgetMigrationSql);
  await db.exec(azureProviderMigrationSql);
});
beforeEach(async () => {
  await db.exec("DELETE FROM translation_revision_events; DELETE FROM translation_provider_usage_buckets; DELETE FROM translation_jobs; DELETE FROM content_translations; DELETE FROM propiedades;");
  propertyId = (await db.query("INSERT INTO propiedades (titulo, descripcion, destacado) VALUES ('Casa Borikí', 'Vista al mar', true) RETURNING id::text")).rows[0].id;
});
after(() => db.close());

function enabledEnv(overrides = {}) {
  return {
    CRON_SECRET: "isolated-cron-secret",
    TRANSLATION_WORKER_ENABLED: "true",
    TRANSLATION_PROVIDER: "azure-translator",
    AZURE_TRANSLATOR_ENDPOINT: "https://api.cognitive.microsofttranslator.com",
    AZURE_TRANSLATOR_REGION: "eastus",
    AZURE_TRANSLATOR_KEY: "fixture-key",
    TRANSLATION_WORKER_BATCH_SIZE: "10",
    TRANSLATION_WORKER_CONCURRENCY: "2",
    TRANSLATION_WORKER_LOCK_TIMEOUT_MS: "600000",
    TRANSLATION_PROVIDER_TIMEOUT_MS: "1000",
    TRANSLATION_WORKER_ID: "isolated-cron",
    ...overrides,
  };
}
const authorizedRequest = () => new Request("http://localhost/api/cron/process-translation-jobs", { headers: { authorization: "Bearer isolated-cron-secret" } });
async function seedProperty() {
  await database.begin((transaction) => syncPropertyTranslationIntents(transaction, {
    propertyId, title: "Casa Borikí", description: "Vista al mar", highlighted: true,
  }));
}
const azureTransport = {
  async translate(input) {
    return {
      translatedText: input.text.includes("Borikí") ? "Borikí home" : "Ocean view",
      requestId: "azure-operational-fixture",
      serviceVersion: "azure-v3-fixture",
    };
  },
};

test("disabled and unauthorized cron paths make zero database calls", async () => {
  let calls = 0;
  const rejectingDatabase = {
    async unsafe() { calls += 1; throw new Error("unexpected database call"); },
    async begin() { calls += 1; throw new Error("unexpected database call"); },
  };
  const disabled = await handleTranslationWorkerCron({ request: authorizedRequest(), database: rejectingDatabase, env: { CRON_SECRET: "isolated-cron-secret" } });
  assert.equal((await disabled.json()).state, "disabled");
  const unauthorized = await handleTranslationWorkerCron({ request: new Request("http://localhost/api/cron/process-translation-jobs"), database: rejectingDatabase, env: enabledEnv() });
  assert.equal(unauthorized.status, 401);
  assert.equal(calls, 0);
});

test("dedicated translation cron secret takes precedence", async () => {
  const rejectingDatabase = { async unsafe() { throw new Error("unexpected"); }, async begin() { throw new Error("unexpected"); } };
  const env = { CRON_SECRET: "legacy", TRANSLATION_CRON_SECRET: "dedicated" };
  const legacy = await handleTranslationWorkerCron({ request: new Request("http://localhost", { headers: { authorization: "Bearer legacy" } }), database: rejectingDatabase, env });
  assert.equal(legacy.status, 401);
  const dedicated = await handleTranslationWorkerCron({ request: new Request("http://localhost", { headers: { authorization: "Bearer dedicated" } }), database: rejectingDatabase, env });
  assert.equal((await dedicated.json()).state, "disabled");
});

test("invalid Azure configuration fails closed before claiming", async () => {
  await seedProperty();
  const before = await repository.countEligible(now);
  const response = await handleTranslationWorkerCron({ request: authorizedRequest(), database, env: enabledEnv({ AZURE_TRANSLATOR_KEY: "" }) });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).errorCode, "azure_configuration_missing");
  assert.equal(await repository.countEligible(now), before);
});

test("authenticated isolated cron uses the shared bounded Azure worker", async () => {
  await seedProperty();
  const first = await handleTranslationWorkerCron({ request: authorizedRequest(), database, env: enabledEnv({ TRANSLATION_WORKER_BATCH_SIZE: "1" }), azureTransport });
  assert.equal(first.status, 200);
  const body = await first.json();
  assert.equal(body.summary.claimed, 1);
  assert.equal(body.summary.succeeded, 1);
  assert.equal(body.health.recentSucceeded, 1);
  assert.equal(JSON.stringify(body).includes("Vista al mar"), false);
  assert.equal(first.headers.get("cache-control"), "no-store");
  await handleTranslationWorkerCron({ request: authorizedRequest(), database, env: enabledEnv(), azureTransport });
  const third = await handleTranslationWorkerCron({ request: authorizedRequest(), database, env: enabledEnv(), azureTransport });
  assert.equal((await third.json()).summary.claimed, 0);
});

test("operational health exposes aggregates and stale-lock age only", async () => {
  await seedProperty();
  const jobs = await database.unsafe("SELECT id::text FROM translation_jobs ORDER BY created_at LIMIT 1");
  await database.unsafe("UPDATE translation_jobs SET status = 'processing', attempts = 1, started_at = $2, locked_at = $2, locked_by = 'stale-fixture' WHERE id = $1::uuid", [jobs[0].id, new Date(now.getTime() - 700_000).toISOString()]);
  const health = await repository.getOperationalHealth({ now, lockTimeoutMs: 600_000 });
  assert.equal(health.staleProcessing, 1);
  assert.equal(typeof health.oldestEligibleAgeMs, "number");
});

test("registry is Azure-only, lazy, and retired Google fails closed", () => {
  assert.equal(readTranslationWorkerConfig({}).enabled, false);
  const config = readTranslationWorkerConfig(enabledEnv());
  let calls = 0;
  const provider = resolveConfiguredTranslationProvider({ config, azureTransport: { async translate() { calls += 1; throw new Error("not called"); } } });
  assert.equal(provider.id, "azure-translator");
  assert.equal(calls, 0);
  assert.throws(() => readTranslationWorkerConfig({ TRANSLATION_PROVIDER: "google-cloud-translation" }), (error) => error.safeCode === "provider_selection_invalid");
});
