import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test, { after, before, beforeEach } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { FakeTranslationProvider } from "../lib/i18n/translations/fake-provider.ts";
import { syncTestimonialTranslationIntent } from "../lib/i18n/translations/source-intents.ts";
import { processTranslationJobs } from "../lib/i18n/translations/worker.ts";
import {
  getTranslationUsageStatus,
  reserveTranslationProviderUsage,
  TRANSLATION_USAGE_LIMITS,
  TranslationUsageBudgetError,
} from "../lib/i18n/translations/usage-budget.ts";

const migrations = await Promise.all(
  [
    "0019_create_translation_persistence.sql",
    "0020_add_translation_regeneration_authorization.sql",
    "0021_add_translation_usage_budget.sql",
  ].map((name) =>
    readFile(fileURLToPath(new URL(`../db/migrations/${name}`, import.meta.url)), "utf8")
  )
);
function adapter(db) {
  const executor = (source) => ({
    async unsafe(query, parameters = []) {
      return (await source.query(query, parameters)).rows;
    },
  });
  return {
    ...executor(db),
    begin: (callback) => db.transaction((tx) => callback(executor(tx))),
  };
}

const db = new PGlite();
const database = adapter(db);
const NOW = new Date("2032-04-15T12:00:00.000Z");
const config = {
  enabled: true,
  providerId: "google-cloud-translation",
  batchSize: 1,
  concurrency: 1,
  lockTimeoutMs: 600_000,
  requestTimeoutMs: 100,
  workerIdPrefix: "budget-test",
  maximumAutomaticAttempts: 2,
  maximumSourceCharacters: 5_000,
};
let testimonialId;

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
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text NOT NULL UNIQUE
    );
  `);
  for (const migration of migrations) await db.exec(migration);
});
beforeEach(async () => {
  await db.exec(`
    DELETE FROM translation_revision_events;
    DELETE FROM translation_provider_usage_buckets;
    DELETE FROM translation_jobs;
    DELETE FROM content_translations;
    DELETE FROM testimonios;
  `);
  testimonialId = (
    await db.query("INSERT INTO testimonios (texto) VALUES ('Texto sintético') RETURNING id::text")
  ).rows[0].id;
});
after(() => db.close());

async function seedJob(body = "Texto sintético") {
  await database.begin((transaction) =>
    syncTestimonialTranslationIntent(transaction, {
      testimonialId,
      body,
      active: true,
    })
  );
}

test("atomic reservation records aggregate counts without content or identifiers", async () => {
  await reserveTranslationProviderUsage(database, {
    provider: "google-cloud-translation",
    sourceText: "🏠abc",
    now: NOW,
  });
  const rows = (await db.query(`
    SELECT period_kind, attempted_characters, provider_attempts
      FROM translation_provider_usage_buckets ORDER BY period_kind
  `)).rows;
  assert.deepEqual(rows, [
    { period_kind: "day", attempted_characters: 4, provider_attempts: 1 },
    { period_kind: "month", attempted_characters: 4, provider_attempts: 1 },
  ]);
  const columns = (await db.query(`
    SELECT column_name FROM information_schema.columns
     WHERE table_name='translation_provider_usage_buckets' ORDER BY column_name
  `)).rows.map((row) => row.column_name);
  for (const forbidden of ["source_text", "translated_text", "job_id", "translation_id", "email", "phone"]) {
    assert.equal(columns.includes(forbidden), false);
  }
});

for (const scenario of [
  { name: "daily character cap", kind: "day", chars: 9_999, attempts: 1, text: "ab", reason: "daily_characters" },
  { name: "monthly character cap", kind: "month", chars: 249_999, attempts: 1, text: "ab", reason: "monthly_characters" },
  { name: "daily attempt cap", kind: "day", chars: 1, attempts: 20, text: "a", reason: "daily_attempts" },
  { name: "monthly attempt cap", kind: "month", chars: 1, attempts: 100, text: "a", reason: "monthly_attempts" },
]) {
  test(scenario.name, async () => {
    const periodStart = scenario.kind === "day" ? "2032-04-15" : "2032-04-01";
    await db.query(
      `INSERT INTO translation_provider_usage_buckets
        (provider, period_kind, period_start, attempted_characters, provider_attempts)
       VALUES ('google-cloud-translation', $1, $2::date, $3, $4)`,
      [scenario.kind, periodStart, scenario.chars, scenario.attempts]
    );
    await assert.rejects(
      reserveTranslationProviderUsage(database, {
        provider: "google-cloud-translation",
        sourceText: scenario.text,
        now: NOW,
      }),
      (error) => error instanceof TranslationUsageBudgetError && error.reason === scenario.reason
    );
  });
}

test("source texts above 5,000 Unicode characters fail before database or provider work", async () => {
  await assert.rejects(
    reserveTranslationProviderUsage(database, {
      provider: "google-cloud-translation",
      sourceText: "á".repeat(TRANSLATION_USAGE_LIMITS.maximumSourceCharacters + 1),
      now: NOW,
    }),
    (error) => error.reason === "source_too_large"
  );
  assert.equal((await db.query("SELECT count(*)::int count FROM translation_provider_usage_buckets")).rows[0].count, 0);
});

test("concurrent reservations cannot oversubscribe the daily character cap", async () => {
  await db.query(`
    INSERT INTO translation_provider_usage_buckets
      (provider, period_kind, period_start, attempted_characters, provider_attempts)
    VALUES ('google-cloud-translation', 'day', DATE '2032-04-15', 9990, 1)
  `);
  const results = await Promise.allSettled([
    reserveTranslationProviderUsage(database, { provider: "google-cloud-translation", sourceText: "1234567890", now: NOW }),
    reserveTranslationProviderUsage(database, { provider: "google-cloud-translation", sourceText: "abcdefghij", now: NOW }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  const daily = (await db.query(`SELECT attempted_characters FROM translation_provider_usage_buckets WHERE period_kind='day'`)).rows[0];
  assert.equal(daily.attempted_characters, 10_000);
});

test("budget exhaustion pauses a claimed job without consuming an attempt or calling provider", async () => {
  await seedJob();
  await db.query(`
    INSERT INTO translation_provider_usage_buckets
      (provider, period_kind, period_start, attempted_characters, provider_attempts)
    VALUES ('google-cloud-translation', 'day', DATE '2032-04-15', 10000, 1)
  `);
  const provider = new FakeTranslationProvider();
  const result = await processTranslationJobs({ database, provider, config, now: () => NOW });
  assert.equal(result.pausedByBudget, 1);
  assert.equal(provider.requests.length, 0);
  const job = (await db.query("SELECT status, attempts, last_error_code FROM translation_jobs")).rows[0];
  assert.deepEqual(job, {
    status: "queued",
    attempts: 0,
    last_error_code: "translation_budget_daily_characters",
  });
});

test("usage-ledger failure fails closed and makes zero provider calls", async () => {
  await seedJob();
  await db.exec("DROP TABLE translation_provider_usage_buckets");
  const provider = new FakeTranslationProvider();
  const result = await processTranslationJobs({ database, provider, config, now: () => NOW });
  assert.equal(result.pausedByBudget, 1);
  assert.equal(provider.requests.length, 0);
  assert.equal((await db.query("SELECT status FROM translation_jobs")).rows[0].status, "queued");
  await db.exec(migrations[2]);
});

test("a retry reserves usage again and the two-attempt ceiling remains terminal", async () => {
  await seedJob();
  const provider = new FakeTranslationProvider([
    { type: "retryable" },
    { type: "retryable" },
  ]);
  const first = await processTranslationJobs({
    database,
    provider,
    config,
    now: () => NOW,
    random: () => 0.5,
  });
  assert.equal(first.retried, 1);
  const later = new Date(NOW.getTime() + 60_001);
  const second = await processTranslationJobs({
    database,
    provider,
    config,
    now: () => later,
    random: () => 0.5,
  });
  assert.equal(second.failed, 1);
  assert.equal(provider.requests.length, 2);
  const status = await getTranslationUsageStatus(database, later);
  assert.equal(status.attemptsToday, 2);
  assert.equal((await db.query("SELECT attempts, max_attempts, status FROM translation_jobs")).rows[0].attempts, 2);
});

test("production worker configuration is fixed at batch one and concurrency one", async () => {
  const { readTranslationWorkerConfig } = await import("../lib/i18n/translations/provider-registry.ts");
  const base = { VERCEL_ENV: "production", TRANSLATION_WORKER_ENABLED: "false" };
  assert.equal(readTranslationWorkerConfig(base).batchSize, 1);
  assert.equal(readTranslationWorkerConfig(base).concurrency, 1);
  assert.throws(() => readTranslationWorkerConfig({ ...base, TRANSLATION_WORKER_BATCH_SIZE: "2" }));
  assert.throws(() => readTranslationWorkerConfig({ ...base, TRANSLATION_WORKER_CONCURRENCY: "2" }));
});
