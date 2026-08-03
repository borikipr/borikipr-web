import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test, { after, before, beforeEach } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { runTranslationReadOnlyInspection } from "../lib/i18n/translations/read-only.ts";
import { applySingleTestimonialTranslationIntent } from "../lib/i18n/translations/testimonial-intent.ts";
import {
  applySingleTestimonialFailedJobRetry,
  assertTestimonialRetryCliIsSafe,
  inspectSingleTestimonialFailedJobRetry,
  parseTestimonialRetryCliArgs,
  PRODUCTION_SINGLE_TESTIMONIAL_RETRY_FLAG,
  PROVIDER_EMPTY_RESULT_RETRY_CONFIRMATION_FLAG,
} from "../lib/i18n/translations/testimonial-retry.ts";
import { PRODUCTION_READ_ONLY_DRY_RUN_FLAG } from "../lib/i18n/translations/cli-safety.ts";

const migrationSql = await readFile(
  fileURLToPath(
    new URL("../db/migrations/0019_create_translation_persistence.sql", import.meta.url)
  ),
  "utf8"
);
const regenerationMigrationSql = await readFile(
  fileURLToPath(
    new URL("../db/migrations/0020_add_translation_regeneration_authorization.sql", import.meta.url)
  ),
  "utf8"
);
const canonicalId = "11111111-1111-4111-8111-111111111111";
const productionDatabaseUrl =
  "postgres://redacted@ep-fixture.neon.tech/production";

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
    DELETE FROM testimonios;
  `);
  testimonialId = (
    await db.query(
      "INSERT INTO testimonios (texto, activo) VALUES ('Fixture testimonial', true) RETURNING id::text"
    )
  ).rows[0].id;
  await applySingleTestimonialTranslationIntent(database, testimonialId);
  await db.exec(`
    UPDATE translation_jobs
       SET status = 'failed', attempts = 1, completed_at = now(),
           last_error_code = 'provider_empty_result',
           last_error_message = 'Translation provider returned an empty result.';
    UPDATE content_translations SET status = 'failed';
    INSERT INTO translation_revision_events (
      translation_id, job_id, event_type,
      previous_source_hash, new_source_hash,
      previous_status, new_status
    )
    SELECT ct.id, tj.id, 'generation_failed', ct.source_hash, ct.source_hash,
           'processing', 'failed'
      FROM content_translations ct
      JOIN translation_jobs tj ON tj.translation_id = ct.id;
  `);
});

after(async () => db.close());

async function counts() {
  return (
    await db.query(`SELECT
      (SELECT count(*)::int FROM content_translations) translations,
      (SELECT count(*)::int FROM translation_jobs) jobs,
      (SELECT count(*)::int FROM translation_revision_events) events,
      (SELECT count(*)::int FROM translation_jobs WHERE status = 'queued') queued,
      (SELECT count(*)::int FROM translation_jobs WHERE status = 'processing') processing`)
  ).rows[0];
}

function options(overrides = {}) {
  return {
    testimonialId: canonicalId,
    apply: false,
    confirmedLocal: false,
    allowProductionReadOnlyDryRun: false,
    allowProductionSingleRetry: false,
    confirmedProviderEmptyResultJob: false,
    ...overrides,
  };
}

test("retry CLI accepts one testimonial ID and rejects broad scopes", () => {
  assert.deepEqual(
    parseTestimonialRetryCliArgs([
      "--testimonial-id",
      canonicalId.toUpperCase(),
      "--dry-run",
    ]),
    options({ testimonialId: canonicalId })
  );
  for (const args of [
    [],
    ["--testimonial-id", "not-a-uuid"],
    ["--testimonial-id", canonicalId, "--testimonial-id", canonicalId],
    ["--testimonial-id", `${canonicalId},${canonicalId}`],
    ["--testimonial-id", "*"],
    ["--testimonial-id", canonicalId, "--field", "title"],
    ["--testimonial-id", canonicalId, "--entity", "property"],
    ["--testimonial-id", canonicalId, "--apply", "--dry-run"],
  ]) {
    assert.throws(() => parseTestimonialRetryCliArgs(args));
  }
});

test("production dry-run and apply require distinct command-line confirmations", () => {
  assert.throws(
    () =>
      assertTestimonialRetryCliIsSafe({
        databaseUrl: productionDatabaseUrl,
        options: options(),
      }),
    /production_dry_run_confirmation_required/
  );
  assert.deepEqual(
    assertTestimonialRetryCliIsSafe({
      databaseUrl: productionDatabaseUrl,
      options: options({ allowProductionReadOnlyDryRun: true }),
    }),
    { productionReadOnlyDryRun: true }
  );
  const applyOptions = options({
    apply: true,
    allowProductionSingleRetry: true,
    confirmedProviderEmptyResultJob: true,
  });
  assert.deepEqual(
    assertTestimonialRetryCliIsSafe({
      databaseUrl: productionDatabaseUrl,
      options: applyOptions,
      environment: {
        TRANSLATION_WORKER_ENABLED: "false",
        MULTILINGUAL_ENABLED: "false",
      },
    }),
    { productionApply: true }
  );
  assert.throws(
    () =>
      assertTestimonialRetryCliIsSafe({
        databaseUrl: productionDatabaseUrl,
        options: options({ apply: true }),
      }),
    /production_single_retry_authorization_required/
  );
  assert.throws(
    () =>
      assertTestimonialRetryCliIsSafe({
        databaseUrl: productionDatabaseUrl,
        options: applyOptions,
        environment: {
          TRANSLATION_WORKER_ENABLED: "true",
          MULTILINGUAL_ENABLED: "false",
        },
      }),
    /worker_must_be_explicitly_disabled/
  );
});

test("production authorization cannot be supplied by environment variables", () => {
  assert.throws(
    () =>
      assertTestimonialRetryCliIsSafe({
        databaseUrl: productionDatabaseUrl,
        options: options({ apply: true }),
        environment: {
          TRANSLATION_WORKER_ENABLED: "false",
          MULTILINGUAL_ENABLED: "false",
          ALLOW_PRODUCTION_SINGLE_TESTIMONIAL_RETRY: "true",
        },
      }),
    /production_single_retry_authorization_required/
  );
});

test("failed provider_empty_result dry-run is aggregate-only and read-only", async () => {
  const before = await counts();
  const report = await runTranslationReadOnlyInspection(
    database,
    (readOnlyDatabase) =>
      inspectSingleTestimonialFailedJobRetry(readOnlyDatabase, testimonialId)
  );
  assert.deepEqual(report, {
    eligible: true,
    entityCount: 1,
    fieldCount: 1,
    existingTranslationRows: 1,
    newTranslationRowsWouldCreate: 0,
    failedJobsMatched: 1,
    activeJobsPresent: false,
    jobsWouldRequeue: 1,
    replacementJobsWouldCreate: 0,
    revisionEventsWouldCreate: 1,
    writesApplied: 0,
    providerCalled: false,
  });
  assert.deepEqual(await counts(), before);
  assert.equal(JSON.stringify(report).includes("Fixture testimonial"), false);
});

test("apply requeues the same job, preserves failure history and creates no duplicate", async () => {
  const beforeJob = (await db.query("SELECT id::text, attempts FROM translation_jobs")).rows[0];
  const report = await applySingleTestimonialFailedJobRetry(database, testimonialId);
  assert.deepEqual(report, {
    eligible: true,
    entityCount: 1,
    fieldCount: 1,
    translationRowsCreated: 0,
    jobsRequeued: 1,
    replacementJobsCreated: 0,
    revisionEventsCreated: 1,
    writesApplied: 3,
    providerCalled: false,
  });
  assert.deepEqual(await counts(), {
    translations: 1,
    jobs: 1,
    events: 4,
    queued: 1,
    processing: 0,
  });
  const job = (await db.query("SELECT id::text, status, attempts, last_error_code FROM translation_jobs")).rows[0];
  assert.equal(job.id, beforeJob.id);
  assert.equal(job.attempts, beforeJob.attempts);
  assert.equal(job.status, "queued");
  assert.equal(job.last_error_code, null);
  assert.equal((await db.query("SELECT status FROM content_translations")).rows[0].status, "pending");
  assert.deepEqual(
    (await db.query("SELECT event_type FROM translation_revision_events ORDER BY created_at, id")).rows.map(
      (row) => row.event_type
    ).sort(),
    ["created", "generation_failed", "job_queued", "job_queued"]
  );
  await assert.rejects(
    applySingleTestimonialFailedJobRetry(database, testimonialId),
    /testimonial_retry_not_eligible/
  );
});

test("retry rejects unsafe or obsolete failed states without writes", async (t) => {
  const cases = [
    ["wrong error", "UPDATE translation_jobs SET last_error_code = 'other_error'"],
    ["exhausted", "UPDATE translation_jobs SET attempts = max_attempts"],
    ["active job", "UPDATE translation_jobs SET status = 'queued', completed_at = NULL"],
    ["source changed", "UPDATE testimonios SET texto = 'Changed source'"],
    ["manual", "UPDATE content_translations SET origin = 'manual', protected_from_automation = true"],
    ["protected", "UPDATE content_translations SET protected_from_automation = true"],
  ];
  for (const [name, sql] of cases) {
    await t.test(name, async () => {
      await db.exec(sql);
      const before = await counts();
      const report = await inspectSingleTestimonialFailedJobRetry(database, testimonialId);
      assert.equal(report.eligible, false);
      await assert.rejects(
        applySingleTestimonialFailedJobRetry(database, testimonialId),
        /testimonial_retry_not_eligible/
      );
      assert.deepEqual(await counts(), before);
      await db.exec(`
        DELETE FROM translation_revision_events;
        DELETE FROM translation_jobs;
        DELETE FROM content_translations;
      `);
      await applySingleTestimonialTranslationIntent(database, testimonialId);
      await db.exec(`
        UPDATE translation_jobs
           SET status = 'failed', attempts = 1, completed_at = now(),
               last_error_code = 'provider_empty_result';
        UPDATE content_translations SET status = 'failed';
      `);
    });
  }
});

test("a revision write failure rolls back the translation and job requeue", async () => {
  const before = await counts();
  const failingDatabase = {
    ...database,
    begin: (callback) =>
      database.begin((transaction) =>
        callback({
          unsafe(query, parameters = []) {
            if (query.includes("INSERT INTO public.translation_revision_events")) {
              throw new Error("isolated event failure");
            }
            return transaction.unsafe(query, parameters);
          },
        })
      ),
  };
  await assert.rejects(
    applySingleTestimonialFailedJobRetry(failingDatabase, testimonialId),
    /isolated event failure/
  );
  assert.deepEqual(await counts(), before);
  assert.equal((await db.query("SELECT status FROM translation_jobs")).rows[0].status, "failed");
  assert.equal((await db.query("SELECT status FROM content_translations")).rows[0].status, "failed");
});

test("documented retry flags remain exact command-line-only boundaries", () => {
  const parsed = parseTestimonialRetryCliArgs([
    "--testimonial-id",
    canonicalId,
    "--apply",
    PRODUCTION_SINGLE_TESTIMONIAL_RETRY_FLAG,
    PROVIDER_EMPTY_RESULT_RETRY_CONFIRMATION_FLAG,
  ]);
  assert.equal(parsed.apply, true);
  assert.equal(parsed.allowProductionSingleRetry, true);
  assert.equal(parsed.confirmedProviderEmptyResultJob, true);
  assert.throws(() =>
    parseTestimonialRetryCliArgs([
      "--testimonial-id",
      canonicalId,
      "--apply",
      PRODUCTION_READ_ONLY_DRY_RUN_FLAG,
    ])
  );
});
