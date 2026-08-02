import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test, { after, before, beforeEach } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { runTranslationReadOnlyInspection } from "../lib/i18n/translations/read-only.ts";
import {
  applySingleTestimonialTranslationIntent,
  assertTestimonialIntentCliIsSafe,
  inspectSingleTestimonialTranslationIntent,
  parseTestimonialIntentCliArgs,
  PRODUCTION_SINGLE_TESTIMONIAL_INTENT_FLAG,
  SINGLE_TESTIMONIAL_CONFIRMATION_FLAG,
} from "../lib/i18n/translations/testimonial-intent.ts";
import { PRODUCTION_READ_ONLY_DRY_RUN_FLAG } from "../lib/i18n/translations/cli-safety.ts";

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
  fileURLToPath(
    new URL(
      "../db/migrations/0020_add_translation_regeneration_authorization.sql",
      import.meta.url
    )
  ),
  "utf8"
);
const productionDatabaseUrl =
  "postgres://redacted@ep-fixture.neon.tech/production";
const canonicalId = "11111111-1111-4111-8111-111111111111";

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
let secondTestimonialId;

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
      "INSERT INTO testimonios (texto, activo) VALUES ('Servicio excelente', true) RETURNING id::text"
    )
  ).rows[0].id;
  secondTestimonialId = (
    await db.query(
      "INSERT INTO testimonios (texto, activo) VALUES ('Atención profesional', true) RETURNING id::text"
    )
  ).rows[0].id;
});

after(async () => db.close());

async function scopedCounts() {
  const rows = await db.query(`SELECT
    (SELECT count(*)::int FROM content_translations) translations,
    (SELECT count(*)::int FROM translation_jobs) jobs,
    (SELECT count(*)::int FROM translation_revision_events) events`);
  return rows.rows[0];
}

function productionOptions(overrides = {}) {
  return {
    testimonialId: canonicalId,
    apply: false,
    confirmedLocal: false,
    allowProductionReadOnlyDryRun: false,
    allowProductionSingleIntent: false,
    confirmedExactlyOneBody: false,
    ...overrides,
  };
}

test("CLI parser fixes scope to one canonical testimonial body", () => {
  assert.deepEqual(
    parseTestimonialIntentCliArgs([
      "--testimonial-id",
      canonicalId.toUpperCase(),
      "--dry-run",
    ]),
    productionOptions({ testimonialId: canonicalId })
  );
  for (const args of [
    [],
    ["--testimonial-id", "not-a-uuid"],
    ["--testimonial-id", canonicalId, "--testimonial-id", canonicalId],
    ["--testimonial-id", `${canonicalId},${canonicalId}`],
    ["--testimonial-id", "*"],
    ["--testimonial-id", "all"],
    ["--testimonial-id", canonicalId, "--entity", "property"],
    ["--testimonial-id", canonicalId, "--field", "title"],
    ["--testimonial-id", canonicalId, "--source-locale", "es"],
    ["--testimonial-id", canonicalId, "--target-locale", "en"],
    ["--testimonial-id", canonicalId, "--apply", "--dry-run"],
  ]) {
    assert.throws(() => parseTestimonialIntentCliArgs(args));
  }
});

test("production dry-run and apply require distinct exact confirmations", () => {
  assert.throws(
    () =>
      assertTestimonialIntentCliIsSafe({
        databaseUrl: productionDatabaseUrl,
        options: productionOptions(),
      }),
    /production_dry_run_confirmation_required/
  );
  assert.deepEqual(
    assertTestimonialIntentCliIsSafe({
      databaseUrl: productionDatabaseUrl,
      options: productionOptions({ allowProductionReadOnlyDryRun: true }),
    }),
    { productionReadOnlyDryRun: true }
  );
  assert.throws(
    () =>
      assertTestimonialIntentCliIsSafe({
        databaseUrl: productionDatabaseUrl,
        options: productionOptions({ apply: true }),
      }),
    /production_single_intent_authorization_required/
  );
  assert.throws(
    () =>
      assertTestimonialIntentCliIsSafe({
        databaseUrl: productionDatabaseUrl,
        options: productionOptions({
          apply: true,
          allowProductionSingleIntent: true,
        }),
      }),
    /exactly_one_body_confirmation_required/
  );
  assert.deepEqual(
    assertTestimonialIntentCliIsSafe({
      databaseUrl: productionDatabaseUrl,
      options: productionOptions({
        apply: true,
        allowProductionSingleIntent: true,
        confirmedExactlyOneBody: true,
      }),
      environment: {
        TRANSLATION_WORKER_ENABLED: "false",
        MULTILINGUAL_ENABLED: "false",
      },
    }),
    { productionApply: true }
  );
});

test("worker and multilingual enablement block intent apply", () => {
  const options = productionOptions({
    apply: true,
    allowProductionSingleIntent: true,
    confirmedExactlyOneBody: true,
  });
  assert.throws(
    () =>
      assertTestimonialIntentCliIsSafe({
        databaseUrl: productionDatabaseUrl,
        options,
        environment: { TRANSLATION_WORKER_ENABLED: "true" },
      }),
    /worker_must_be_explicitly_disabled/
  );
  assert.throws(
    () =>
      assertTestimonialIntentCliIsSafe({
        databaseUrl: productionDatabaseUrl,
        options,
        environment: {
          TRANSLATION_WORKER_ENABLED: "false",
          MULTILINGUAL_ENABLED: "true",
        },
      }),
    /multilingual_mode_must_be_explicitly_disabled/
  );
});

test("environment variables alone cannot authorize production apply", () => {
  assert.throws(
    () =>
      assertTestimonialIntentCliIsSafe({
        databaseUrl: productionDatabaseUrl,
        options: productionOptions({ apply: true }),
        environment: {
          TRANSLATION_WORKER_ENABLED: "false",
          MULTILINGUAL_ENABLED: "false",
          ALLOW_PRODUCTION_SINGLE_TESTIMONIAL_INTENT: "true",
          CONFIRM_EXACTLY_ONE_TESTIMONIAL_BODY: "true",
        },
      }),
    /production_single_intent_authorization_required/
  );
});

test("production apply requires both dormant flags to be explicitly false", () => {
  const options = productionOptions({
    apply: true,
    allowProductionSingleIntent: true,
    confirmedExactlyOneBody: true,
  });
  assert.throws(
    () =>
      assertTestimonialIntentCliIsSafe({
        databaseUrl: productionDatabaseUrl,
        options,
        environment: {},
      }),
    /worker_must_be_explicitly_disabled/
  );
  assert.throws(
    () =>
      assertTestimonialIntentCliIsSafe({
        databaseUrl: productionDatabaseUrl,
        options,
        environment: { TRANSLATION_WORKER_ENABLED: "false" },
      }),
    /multilingual_mode_must_be_explicitly_disabled/
  );
});

test("dry-run is aggregate-only and applies zero writes", async () => {
  const before = await scopedCounts();
  const report = await runTranslationReadOnlyInspection(
    database,
    (readOnlyDatabase) =>
      inspectSingleTestimonialTranslationIntent(
        readOnlyDatabase,
        testimonialId
      )
  );
  assert.deepEqual(report, {
    eligible: true,
    entityCount: 1,
    fieldCount: 1,
    existingTranslationState: "missing",
    activeJobPresent: false,
    rowsWouldCreate: 1,
    jobsWouldQueue: 1,
    revisionEventsWouldCreate: 2,
    writesApplied: 0,
    providerCalled: false,
  });
  assert.deepEqual(await scopedCounts(), before);
  assert.equal(JSON.stringify(report).includes("Servicio excelente"), false);
});

test("apply creates exactly one body translation, job and expected events", async () => {
  const report = await applySingleTestimonialTranslationIntent(
    database,
    testimonialId
  );
  assert.deepEqual(report, {
    eligible: true,
    entityCount: 1,
    fieldCount: 1,
    translationsCreated: 1,
    jobsCreated: 1,
    revisionEventsCreated: 2,
    writesApplied: 4,
    providerCalled: false,
  });
  assert.deepEqual(await scopedCounts(), {
    translations: 1,
    jobs: 1,
    events: 2,
  });
  const translation = await db.query(`
    SELECT testimonial_id::text, field_key, target_locale, status
      FROM content_translations
  `);
  assert.deepEqual(translation.rows, [
    {
      testimonial_id: testimonialId,
      field_key: "body",
      target_locale: "en-US",
      status: "pending",
    },
  ]);
  assert.notEqual(translation.rows[0].testimonial_id, secondTestimonialId);
  assert.deepEqual(
    (await db.query("SELECT event_type FROM translation_revision_events ORDER BY created_at, id")).rows.map(
      (row) => row.event_type
    ).sort(),
    ["created", "job_queued"]
  );
});

test("repeated, queued and processing invocations remain idempotent", async () => {
  await applySingleTestimonialTranslationIntent(database, testimonialId);
  await assert.rejects(
    applySingleTestimonialTranslationIntent(database, testimonialId),
    /testimonial_intent_not_eligible_active_job/
  );
  assert.deepEqual(await scopedCounts(), {
    translations: 1,
    jobs: 1,
    events: 2,
  });
  await db.exec(`
    UPDATE translation_jobs
       SET status = 'processing', locked_at = now(), locked_by = 'fixture',
           started_at = now()
  `);
  await assert.rejects(
    applySingleTestimonialTranslationIntent(database, testimonialId),
    /testimonial_intent_not_eligible_active_job/
  );
  assert.deepEqual(await scopedCounts(), {
    translations: 1,
    jobs: 1,
    events: 2,
  });
});

test("current and failed-job states do not create unsafe duplicate work", async () => {
  await applySingleTestimonialTranslationIntent(database, testimonialId);
  await db.exec(`
    UPDATE translation_jobs
       SET status = 'failed', completed_at = now(), last_error_code = 'fixture'
  `);
  await assert.rejects(
    applySingleTestimonialTranslationIntent(database, testimonialId),
    /testimonial_intent_not_eligible_current/
  );
  assert.deepEqual(await scopedCounts(), {
    translations: 1,
    jobs: 1,
    events: 2,
  });
});

test("stale machine translation follows the existing source-intent rules", async () => {
  await applySingleTestimonialTranslationIntent(database, testimonialId);
  await db.exec(`
    UPDATE translation_jobs SET status = 'succeeded', completed_at = now();
    UPDATE testimonios SET texto = 'Servicio extraordinario'
     WHERE id = '${testimonialId}'::uuid;
  `);
  const report = await applySingleTestimonialTranslationIntent(
    database,
    testimonialId
  );
  assert.equal(report.translationsCreated, 0);
  assert.equal(report.jobsCreated, 1);
  assert.equal(report.revisionEventsCreated, 2);
  assert.deepEqual(await scopedCounts(), {
    translations: 1,
    jobs: 2,
    events: 4,
  });
});

test("manual, reviewed and protected translations are rejected", async (t) => {
  for (const state of ["manual", "reviewed", "protected"]) {
    await t.test(state, async () => {
      await db.exec(`
        DELETE FROM translation_revision_events;
        DELETE FROM translation_jobs;
        DELETE FROM content_translations;
      `);
      await applySingleTestimonialTranslationIntent(database, testimonialId);
      await db.exec(`UPDATE translation_jobs SET status = 'succeeded', completed_at = now()`);
      if (state === "manual") {
        await db.exec(`UPDATE content_translations
          SET origin = 'manual', protected_from_automation = true`);
      } else if (state === "reviewed") {
        await db.exec(`UPDATE content_translations
          SET review_status = 'reviewed', protected_from_automation = true`);
      } else {
        await db.exec(`UPDATE content_translations
          SET protected_from_automation = true`);
      }
      await assert.rejects(
        applySingleTestimonialTranslationIntent(database, testimonialId),
        new RegExp(`testimonial_intent_not_eligible_${state}`)
      );
      assert.deepEqual(await scopedCounts(), {
        translations: 1,
        jobs: 1,
        events: 2,
      });
    });
  }
});

test("concurrent invocation creates at most one translation and active job", async () => {
  const results = await Promise.allSettled([
    applySingleTestimonialTranslationIntent(database, testimonialId),
    applySingleTestimonialTranslationIntent(database, testimonialId),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.deepEqual(await scopedCounts(), {
    translations: 1,
    jobs: 1,
    events: 2,
  });
});

test("cardinality mismatch aborts and rolls back every write", async () => {
  let scopedCountReads = 0;
  const lyingDatabase = {
    ...database,
    begin: (callback) =>
      database.begin((transaction) =>
        callback({
          async unsafe(query, parameters = []) {
            const rows = await transaction.unsafe(query, parameters);
            if (query.includes("AS translations") && rows[0]) {
              scopedCountReads += 1;
              if (scopedCountReads === 2) {
                return [{ ...rows[0], events: rows[0].events + 1 }];
              }
            }
            return rows;
          },
        })
      ),
  };
  await assert.rejects(
    applySingleTestimonialTranslationIntent(lyingDatabase, testimonialId),
    /testimonial_intent_cardinality_mismatch/
  );
  assert.deepEqual(await scopedCounts(), {
    translations: 0,
    jobs: 0,
    events: 0,
  });
});

test("missing testimonial and empty body are rejected without writes", async () => {
  await assert.rejects(
    inspectSingleTestimonialTranslationIntent(database, canonicalId),
    /testimonial_not_found/
  );
  await db.query("UPDATE testimonios SET texto = '' WHERE id = $1::uuid", [
    testimonialId,
  ]);
  await assert.rejects(
    inspectSingleTestimonialTranslationIntent(database, testimonialId),
    /testimonial_body_empty/
  );
  assert.deepEqual(await scopedCounts(), {
    translations: 0,
    jobs: 0,
    events: 0,
  });
});

test("all three CLI entry points start under the CommonJS package boundary", () => {
  const tsxCli = fileURLToPath(
    new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url)
  );
  const cases = [
    {
      script: "../scripts/i18n/process-translation-jobs.ts",
      args: [],
      marker: "TRANSLATION_WORKER_CLI_FAILED",
    },
    {
      script: "../scripts/i18n/backfill-translation-intents.ts",
      args: [],
      marker: "TRANSLATION_BACKFILL_CLI_FAILED",
    },
    {
      script: "../scripts/i18n/create-testimonial-translation-intent.ts",
      args: [],
      marker: "TESTIMONIAL_TRANSLATION_INTENT_FAILED",
    },
  ];
  for (const item of cases) {
    const result = spawnSync(
      process.execPath,
      [tsxCli, fileURLToPath(new URL(item.script, import.meta.url)), ...item.args],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DATABASE_URL: productionDatabaseUrl,
          TRANSLATION_WORKER_ENABLED: "false",
          MULTILINGUAL_ENABLED: "false",
        },
      }
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(item.marker));
    assert.doesNotMatch(result.stderr, /top-level await|redacted@|neon\.tech/i);
    assert.doesNotMatch(result.stdout, /redacted@|neon\.tech/i);
  }
});

test("documented flags remain exact command-line-only boundaries", () => {
  const parsed = parseTestimonialIntentCliArgs([
    "--testimonial-id",
    canonicalId,
    "--apply",
    PRODUCTION_SINGLE_TESTIMONIAL_INTENT_FLAG,
    SINGLE_TESTIMONIAL_CONFIRMATION_FLAG,
  ]);
  assert.equal(parsed.apply, true);
  assert.equal(parsed.allowProductionSingleIntent, true);
  assert.equal(parsed.confirmedExactlyOneBody, true);
  assert.throws(() =>
    parseTestimonialIntentCliArgs([
      "--testimonial-id",
      canonicalId,
      "--apply",
      PRODUCTION_READ_ONLY_DRY_RUN_FLAG,
    ])
  );
});
