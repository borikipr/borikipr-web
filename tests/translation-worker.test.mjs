import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test, { after, before, beforeEach } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { FakeTranslationProvider } from "../lib/i18n/translations/fake-provider.ts";
import {
  classifyTranslationProviderError,
  TranslationProviderError,
} from "../lib/i18n/translations/provider.ts";
import {
  readTranslationWorkerConfig,
  resolveTranslationProvider,
} from "../lib/i18n/translations/provider-registry.ts";
import { getTranslatedValueOrSpanishFallback } from "../lib/i18n/translations/publishable.ts";
import {
  syncPropertyTranslationIntents,
  syncTestimonialTranslationIntent,
} from "../lib/i18n/translations/source-intents.ts";
import {
  calculateTranslationRetryAt,
  getTranslationWorkerDryRun,
  processTranslationJobs,
} from "../lib/i18n/translations/worker.ts";
import { createTranslationWorkerRepository } from "../lib/i18n/translations/worker-repository.ts";

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
const usageBudgetMigrationSql = await readFile(
  fileURLToPath(new URL("../db/migrations/0021_add_translation_usage_budget.sql", import.meta.url)),
  "utf8"
);
const azureProviderMigrationSql = await readFile(
  fileURLToPath(new URL("../db/migrations/0053_allow_azure_translation_provider.sql", import.meta.url)),
  "utf8"
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
const repository = createTranslationWorkerRepository(database);
const NOW = new Date("2030-07-29T12:00:00.000Z");
const config = {
  enabled: true,
  providerId: "azure-translator",
  batchSize: 10,
  concurrency: 2,
  lockTimeoutMs: 600_000,
  requestTimeoutMs: 100,
  workerIdPrefix: "phase3d-test",
};
let propertyId;
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
  await db.exec(migrationSql);
  await db.exec(regenerationMigrationSql);
  await db.exec(usageBudgetMigrationSql);
  await db.exec(azureProviderMigrationSql);
});
beforeEach(async () => {
  await db.exec(`
    DELETE FROM translation_revision_events;
    DELETE FROM translation_provider_usage_buckets;
    DELETE FROM translation_jobs;
    DELETE FROM content_translations;
    DELETE FROM propiedades;
    DELETE FROM testimonios;
  `);
  propertyId = (
    await db.query(`
      INSERT INTO propiedades (titulo, descripcion, destacado)
      VALUES ('Casa Borikí', 'Descripción pública', true) RETURNING id::text
    `)
  ).rows[0].id;
  testimonialId = (
    await db.query(`
      INSERT INTO testimonios (texto, activo)
      VALUES ('Servicio excelente', true) RETURNING id::text
    `)
  ).rows[0].id;
});
after(async () => db.close());

async function seedAll() {
  await database.begin(async (tx) => {
    await syncPropertyTranslationIntents(tx, {
      propertyId,
      title: "Casa Borikí",
      description: "Descripción pública",
      highlighted: true,
    });
    await syncTestimonialTranslationIntent(tx, {
      testimonialId,
      body: "Servicio excelente",
      active: true,
    });
  });
}
async function seedTestimonial() {
  await database.begin((tx) =>
    syncTestimonialTranslationIntent(tx, {
      testimonialId,
      body: "Servicio excelente",
      active: true,
    })
  );
}

test("registry defaults disabled and has no silent provider fallback", () => {
  const disabled = readTranslationWorkerConfig({});
  assert.equal(disabled.enabled, false);
  assert.throws(
    () => resolveTranslationProvider({ config: disabled, env: {} }),
    (error) =>
      error instanceof TranslationProviderError &&
      error.safeCode === "worker_disabled"
  );
  const enabled = readTranslationWorkerConfig({
    TRANSLATION_WORKER_ENABLED: "true",
    TRANSLATION_PROVIDER: "azure-translator",
  });
  assert.throws(
    () => resolveTranslationProvider({ config: enabled, env: {} }),
    (error) =>
      error instanceof TranslationProviderError &&
      error.safeCode === "azure_transport_disabled"
  );
  assert.throws(
    () => readTranslationWorkerConfig({ TRANSLATION_PROVIDER: "fake" }),
    /invalid/
  );
});

test("fake provider is deterministic and unknown errors are redacted", async () => {
  const provider = new FakeTranslationProvider();
  const result = await provider.translate({
    sourceLocale: "es-PR",
    targetLocale: "en-US",
    entityType: "testimonial",
    fieldKey: "body",
    sourceText: "Excelente",
    correlationId: "fixture",
  });
  assert.equal(result.translatedText, "[FAKE en-US] Excelente");
  assert.deepEqual(
    classifyTranslationProviderError(
      new Error("credential=secret complete source")
    ),
    {
      kind: "retryable",
      code: "provider_unavailable",
      message: "Translation provider is temporarily unavailable.",
    }
  );
});

test("retry schedule has five tiers and bounded deterministic jitter", () => {
  const delay = (attempt, random) =>
    calculateTranslationRetryAt({ attempt, now: NOW, random }).getTime() -
    NOW.getTime();
  assert.equal(delay(1, () => 0.5), 60_000);
  assert.equal(delay(5, () => 0.5), 43_200_000);
  assert.equal(delay(1, () => 0), 48_000);
  assert.equal(delay(1, () => 1), 72_000);
});

test("dry-run is read-only and claim respects priority, ownership, and attempts", async () => {
  await seedAll();
  const before = await db.query("SELECT status, attempts FROM translation_jobs");
  assert.deepEqual(await getTranslationWorkerDryRun(database, NOW), {
    eligible: 3,
    dryRun: true,
  });
  assert.deepEqual(
    (await db.query("SELECT status, attempts FROM translation_jobs")).rows,
    before.rows
  );
  const jobs = await repository.claimEligible({
    workerId: "worker-a",
    limit: 2,
    now: NOW,
  });
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((job) => job.attempts === 1));
  const rows = await db.query(
    `SELECT tj.priority, tj.locked_by, ct.status translation_status
       FROM translation_jobs tj JOIN content_translations ct
         ON ct.id = tj.translation_id
      WHERE tj.id = ANY($1::uuid[]) ORDER BY priority`,
    [jobs.map((job) => job.jobId)]
  );
  assert.deepEqual(rows.rows.map((row) => row.priority), [50, 50]);
  assert.ok(rows.rows.every((row) => row.locked_by === "worker-a"));
  assert.ok(rows.rows.every((row) => row.translation_status === "processing"));
});

test("isolated fixture rehearsal completes jobs and makes fake values publishable", async () => {
  await seedAll();
  const provider = new FakeTranslationProvider();
  const logs = [];
  const summary = await processTranslationJobs({
    database,
    provider,
    config,
    now: () => NOW,
    random: () => 0.5,
    logger: (event, details) => logs.push({ event, details }),
  });
  assert.equal(summary.claimed, 3);
  assert.equal(summary.succeeded, 3);
  assert.equal(provider.requests.length, 3);
  const rows = await db.query(`
    SELECT status, source_hash, translated_source_hash, translated_value,
           provider, protected_from_automation
      FROM content_translations ORDER BY field_key
  `);
  assert.ok(rows.rows.every((row) => row.status === "ready"));
  assert.ok(rows.rows.every((row) => row.source_hash === row.translated_source_hash));
  assert.ok(rows.rows.every((row) => row.provider === "fake"));
  assert.match(
    getTranslatedValueOrSpanishFallback(
      {
        status: rows.rows[0].status,
        translatedValue: rows.rows[0].translated_value,
        sourceHash: rows.rows[0].source_hash,
        translatedSourceHash: rows.rows[0].translated_source_hash,
      },
      "Español"
    ),
    /^\[FAKE en-US\]/
  );
  assert.equal(
    (
      await db.query(`
        SELECT count(*)::int count FROM translation_revision_events
         WHERE event_type = 'generation_succeeded'
      `)
    ).rows[0].count,
    3
  );
  assert.doesNotMatch(
    JSON.stringify(logs),
    /Casa Borikí|Descripción pública|Servicio excelente/
  );
});

test("worker publishes entity context after commit and cache failure cannot roll back success", async () => {
  await seedTestimonial();
  const published = [];
  const logs = [];
  const summary = await processTranslationJobs({
    database,
    provider: new FakeTranslationProvider(),
    config,
    now: () => NOW,
    logger: (event, details) => logs.push({ event, details }),
    onTranslationPublished: async (target) => {
      published.push(target);
      throw new Error("cache unavailable");
    },
  });

  assert.equal(summary.succeeded, 1);
  assert.deepEqual(published, [
    { entityType: "testimonial", ownerId: testimonialId, propertySlug: null },
  ]);
  assert.equal(
    (await db.query("SELECT status FROM translation_jobs")).rows[0].status,
    "succeeded"
  );
  assert.equal(
    (await db.query("SELECT status FROM content_translations")).rows[0].status,
    "ready"
  );
  assert.ok(logs.some(({ event }) => event === "translation_public_revalidation_failed"));
  assert.doesNotMatch(JSON.stringify(logs), /Servicio excelente|cache unavailable/);
});

test("switching configured providers does not retranslate current ready content", async () => {
  await seedTestimonial();
  const googleFixture = new FakeTranslationProvider();
  const first = await processTranslationJobs({
    database,
    provider: googleFixture,
    config,
    now: () => NOW,
  });
  assert.equal(first.succeeded, 1);
  const before = (
    await db.query(`
      SELECT translated_value, provider, source_hash, translated_source_hash
        FROM content_translations
    `)
  ).rows[0];
  const azureFixture = new FakeTranslationProvider();
  const second = await processTranslationJobs({
    database,
    provider: azureFixture,
    config: { ...config, providerId: "azure-translator" },
    now: () => new Date(NOW.getTime() + 1_000),
  });
  const after = (
    await db.query(`
      SELECT translated_value, provider, source_hash, translated_source_hash
        FROM content_translations
    `)
  ).rows[0];
  assert.equal(second.claimed, 0);
  assert.equal(azureFixture.requests.length, 0);
  assert.deepEqual(after, before);
  assert.equal(after.source_hash, after.translated_source_hash);
});

test("obsolete work cancels and protected work remains unclaimed without reaching provider", async () => {
  await seedAll();
  await db.query("UPDATE propiedades SET titulo = 'Título nuevo' WHERE id = $1", [
    propertyId,
  ]);
  await db.query(
    `UPDATE content_translations
        SET protected_from_automation = true, origin = 'manual'
      WHERE testimonial_id = $1`,
    [testimonialId]
  );
  const provider = new FakeTranslationProvider();
  const summary = await processTranslationJobs({
    database,
    provider,
    config,
    now: () => NOW,
  });
  assert.equal(summary.cancelled, 1);
  assert.equal(summary.skippedObsolete, 1);
  assert.equal(summary.skippedProtected, 0);
  assert.equal(summary.succeeded, 1);
  assert.equal(provider.requests.length, 1);
  const protectedJob = (
    await db.query(
      `SELECT tj.status
         FROM translation_jobs tj
         JOIN content_translations ct ON ct.id = tj.translation_id
        WHERE ct.testimonial_id = $1`,
      [testimonialId]
    )
  ).rows[0];
  assert.equal(protectedJob.status, "queued");
});

test("retryable failure requeues; permanent and exhausted failures terminate", async () => {
  await seedTestimonial();
  let summary = await processTranslationJobs({
    database,
    provider: new FakeTranslationProvider([{ type: "retryable" }]),
    config,
    now: () => NOW,
    random: () => 0.5,
  });
  assert.equal(summary.retried, 1);
  let row = (await db.query("SELECT * FROM translation_jobs")).rows[0];
  assert.equal(row.status, "queued");
  assert.equal(new Date(row.available_at).getTime(), NOW.getTime() + 60_000);
  assert.equal(row.last_error_code, "fake_retryable");
  assert.equal(row.locked_by, null);

  await db.exec(`
    DELETE FROM translation_revision_events;
    DELETE FROM translation_jobs;
    DELETE FROM content_translations;
  `);
  await seedTestimonial();
  summary = await processTranslationJobs({
    database,
    provider: new FakeTranslationProvider([{ type: "permanent" }]),
    config,
    now: () => NOW,
  });
  assert.equal(summary.failed, 1);
  assert.equal(
    (await db.query("SELECT status FROM translation_jobs")).rows[0].status,
    "failed"
  );

  await db.exec(`
    DELETE FROM translation_revision_events;
    DELETE FROM translation_jobs;
    DELETE FROM content_translations;
  `);
  await seedTestimonial();
  await db.exec("UPDATE translation_jobs SET attempts = 1");
  summary = await processTranslationJobs({
    database,
    provider: new FakeTranslationProvider([{ type: "retryable" }]),
    config,
    now: () => NOW,
  });
  assert.equal(summary.failed, 1);
  row = (await db.query("SELECT status, attempts FROM translation_jobs")).rows[0];
  assert.deepEqual(row, { status: "failed", attempts: 2 });
});

test("timeout aborts provider and stale-lock recovery respects lock age", async () => {
  await seedTestimonial();
  const timeout = await processTranslationJobs({
    database,
    provider: new FakeTranslationProvider([{ type: "timeout", delayMs: 500 }]),
    config: { ...config, requestTimeoutMs: 20 },
    now: () => NOW,
    random: () => 0.5,
  });
  assert.equal(timeout.retried, 1);
  assert.equal(
    (await db.query("SELECT last_error_code FROM translation_jobs")).rows[0]
      .last_error_code,
    "provider_timeout"
  );
  await db.exec(`
    UPDATE translation_jobs
       SET status = 'processing', locked_at = '${NOW.toISOString()}',
           locked_by = 'stale-worker', started_at = '${NOW.toISOString()}',
           available_at = '${NOW.toISOString()}';
    UPDATE content_translations SET status = 'processing';
  `);
  let recovery = await repository.recoverStaleLocks({
    now: new Date(NOW.getTime() + 300_000),
    lockTimeoutMs: 600_000,
    limit: 10,
  });
  assert.equal(recovery.recovered, 0);
  recovery = await repository.recoverStaleLocks({
    now: new Date(NOW.getTime() + 660_000),
    lockTimeoutMs: 600_000,
    limit: 10,
  });
  assert.equal(recovery.requeued, 1);
});

test("disabled worker refuses before claim", async () => {
  await seedAll();
  await assert.rejects(
    processTranslationJobs({
      database,
      provider: new FakeTranslationProvider(),
      config: { ...config, enabled: false },
      now: () => NOW,
    }),
    /disabled/
  );
  assert.ok(
    (await db.query("SELECT bool_and(status = 'queued') ok FROM translation_jobs"))
      .rows[0].ok
  );
});

test("concurrent workers never claim the same job", async () => {
  await seedAll();
  const [first, second] = await Promise.all([
    repository.claimEligible({ workerId: "worker-a", limit: 2, now: NOW }),
    repository.claimEligible({ workerId: "worker-b", limit: 2, now: NOW }),
  ]);
  const ids = [...first, ...second].map((job) => job.jobId);
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, 3);
});

test("source changes during provider execution reject delayed results", async () => {
  await seedTestimonial();
  let providerCalls = 0;
  const provider = {
    id: "fixture-race",
    implementationVersion: "1",
    model: null,
    async translate() {
      providerCalls += 1;
      await database.begin(async (tx) => {
        await tx.unsafe("UPDATE testimonios SET texto = $2 WHERE id = $1::uuid", [
          testimonialId,
          "Fuente española más reciente",
        ]);
        await syncTestimonialTranslationIntent(tx, {
          testimonialId,
          body: "Fuente española más reciente",
          active: true,
        });
      });
      return {
        translatedText: "Obsolete result",
        providerId: "fixture-race",
        providerModel: null,
        providerVersion: "1",
        providerRequestId: null,
        usage: null,
      };
    },
  };
  const summary = await processTranslationJobs({
    database,
    provider,
    config,
    now: () => NOW,
  });
  assert.equal(providerCalls, 1);
  assert.equal(summary.cancelled, 1);
  const translation = (
    await db.query(`
      SELECT status, translated_value FROM content_translations
       WHERE testimonial_id = $1::uuid
    `, [testimonialId])
  ).rows[0];
  assert.equal(translation.translated_value, null);
  assert.equal(translation.status, "pending");
  assert.equal(
    (
      await db.query(`
        SELECT count(*)::int count FROM translation_jobs
         WHERE status = 'queued'
      `)
    ).rows[0].count,
    1
  );
});

test("manual protection during provider execution blocks completion", async () => {
  await seedTestimonial();
  const provider = {
    id: "fixture-protection",
    implementationVersion: "1",
    model: null,
    async translate() {
      await db.query(`
        UPDATE content_translations
           SET translated_value = 'Manual value',
               translated_source_hash = source_hash,
               origin = 'manual',
               protected_from_automation = true
      `);
      return {
        translatedText: "Machine value",
        providerId: "fixture-protection",
        providerModel: null,
        providerVersion: "1",
        providerRequestId: null,
        usage: null,
      };
    },
  };
  const summary = await processTranslationJobs({
    database,
    provider,
    config,
    now: () => NOW,
  });
  assert.equal(summary.cancelled, 1);
  const row = (
    await db.query(`
      SELECT translated_value, protected_from_automation, status
        FROM content_translations
    `)
  ).rows[0];
  assert.equal(row.translated_value, "Manual value");
  assert.equal(row.protected_from_automation, true);
  assert.equal(row.status, "stale");
});

test("wrong worker cannot finalize a claimed translation", async () => {
  await seedTestimonial();
  const [job] = await repository.claimEligible({
    workerId: "owner-worker",
    limit: 1,
    now: NOW,
  });
  assert.equal(
    await repository.completeSuccess({
      jobId: job.jobId,
      workerId: "different-worker",
      sourceHash: job.sourceHash,
      translatedText: "Must not persist",
      providerId: "fake",
      providerModel: null,
      providerVersion: "1",
      now: NOW,
    }),
    false
  );
  assert.equal(
    (await db.query("SELECT translated_value FROM content_translations")).rows[0]
      .translated_value,
    null
  );
});

test("empty provider result is permanent and stale recovery cancels invalid work", async () => {
  await seedTestimonial();
  const empty = await processTranslationJobs({
    database,
    provider: new FakeTranslationProvider([{ type: "success", text: "   " }]),
    config,
    now: () => NOW,
  });
  assert.equal(empty.failed, 1);
  assert.equal(
    (await db.query("SELECT last_error_code FROM translation_jobs")).rows[0]
      .last_error_code,
    "provider_empty_result"
  );

  await db.exec(`
    DELETE FROM translation_revision_events;
    DELETE FROM translation_jobs;
    DELETE FROM content_translations;
  `);
  await seedTestimonial();
  await repository.claimEligible({
    workerId: "expired-worker",
    limit: 1,
    now: NOW,
  });
  await db.query("UPDATE testimonios SET texto = 'Changed outside worker' WHERE id = $1", [
    testimonialId,
  ]);
  const recovery = await repository.recoverStaleLocks({
    now: new Date(NOW.getTime() + 660_000),
    lockTimeoutMs: 600_000,
    limit: 10,
  });
  assert.equal(recovery.cancelled, 1);
  assert.equal(
    (await db.query("SELECT status FROM translation_jobs")).rows[0].status,
    "cancelled"
  );
});

test("stale recovery cancels protected work and fails exhausted work", async () => {
  await seedTestimonial();
  await repository.claimEligible({
    workerId: "protected-worker",
    limit: 1,
    now: NOW,
  });
  await db.exec(`
    UPDATE content_translations
       SET protected_from_automation = true, origin = 'manual',
           translated_value = 'Manual', translated_source_hash = source_hash;
  `);
  let recovery = await repository.recoverStaleLocks({
    now: new Date(NOW.getTime() + 660_000),
    lockTimeoutMs: 600_000,
    limit: 10,
  });
  assert.equal(recovery.cancelled, 1);
  assert.deepEqual(
    (
      await db.query(
        "SELECT status, translated_value, protected_from_automation FROM content_translations"
      )
    ).rows[0],
    {
      status: "stale",
      translated_value: "Manual",
      protected_from_automation: true,
    }
  );

  await db.exec(`
    DELETE FROM translation_revision_events;
    DELETE FROM translation_jobs;
    DELETE FROM content_translations;
  `);
  await seedTestimonial();
  await db.exec("UPDATE translation_jobs SET attempts = max_attempts - 1");
  await repository.claimEligible({
    workerId: "exhausted-worker",
    limit: 1,
    now: NOW,
  });
  recovery = await repository.recoverStaleLocks({
    now: new Date(NOW.getTime() + 660_000),
    lockTimeoutMs: 600_000,
    limit: 10,
  });
  assert.equal(recovery.failed, 1);
  assert.equal(
    (await db.query("SELECT status FROM translation_jobs")).rows[0].status,
    "failed"
  );
  assert.equal(
    (await db.query("SELECT status FROM content_translations")).rows[0].status,
    "failed"
  );
});

test("zero-job runs are quiet and provider concurrency remains bounded", async () => {
  const emptyProvider = new FakeTranslationProvider();
  const empty = await processTranslationJobs({
    database,
    provider: emptyProvider,
    config,
    now: () => NOW,
  });
  assert.equal(empty.claimed, 0);
  assert.equal(empty.succeeded, 0);
  assert.equal(emptyProvider.requests.length, 0);

  await seedAll();
  let active = 0;
  let maximumActive = 0;
  const provider = {
    id: "bounded-fixture",
    implementationVersion: "1",
    model: null,
    async translate(request) {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
      return {
        translatedText: `[BOUNDED] ${request.sourceText}`,
        providerId: "bounded-fixture",
        providerModel: null,
        providerVersion: "1",
        providerRequestId: null,
        usage: null,
      };
    },
  };
  const summary = await processTranslationJobs({
    database,
    provider,
    config: { ...config, concurrency: 2 },
    now: () => NOW,
  });
  assert.equal(summary.succeeded, 3);
  assert.ok(maximumActive <= 2);
  assert.ok(maximumActive >= 1);
});
