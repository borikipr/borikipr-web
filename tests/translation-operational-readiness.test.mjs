import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import "./translation-azure-provider.test.mjs";
import "./translation-property-intent.test.mjs";
import {
  assertTranslationBackfillCliIsSafe,
  assertTranslationWorkerCliIsSafe,
  PRODUCTION_READ_ONLY_DRY_RUN_FLAG,
} from "../lib/i18n/translations/cli-safety.ts";
import { runTranslationReadOnlyInspection } from "../lib/i18n/translations/read-only.ts";
import {
  readTranslationWorkerConfig,
  resolveConfiguredTranslationProvider,
} from "../lib/i18n/translations/provider-registry.ts";

const productionDatabaseUrl = "postgres://redacted@ep-fixture.neon.tech/production";
const completeAzureEnv = {
  VERCEL_ENV: "production",
  TRANSLATION_WORKER_ENABLED: "true",
  TRANSLATION_PROVIDER: "azure-translator",
  AZURE_TRANSLATOR_ENDPOINT: "https://api.cognitive.microsofttranslator.com",
  AZURE_TRANSLATOR_REGION: "eastus",
  AZURE_TRANSLATOR_KEY: "fixture-key",
};

test("disabled configuration stays import-safe while enabled Azure fails closed", () => {
  const disabled = readTranslationWorkerConfig({ VERCEL_ENV: "production" });
  assert.equal(disabled.enabled, false);
  assert.throws(
    () => resolveConfiguredTranslationProvider({ config: disabled }),
    (error) => error.safeCode === "worker_disabled"
  );
  const enabledMissing = readTranslationWorkerConfig({
    VERCEL_ENV: "production",
    TRANSLATION_WORKER_ENABLED: "true",
    TRANSLATION_PROVIDER: "azure-translator",
  });
  assert.throws(
    () => resolveConfiguredTranslationProvider({ config: enabledMissing }),
    (error) => error.safeCode === "azure_configuration_missing"
  );
});

test("Azure is the sole operational provider and retired Google fails closed", () => {
  const config = readTranslationWorkerConfig(completeAzureEnv);
  const provider = resolveConfiguredTranslationProvider({
    config,
    azureTransport: { async translate() { throw new Error("not called"); } },
  });
  assert.equal(provider.id, "azure-translator");
  assert.throws(
    () => readTranslationWorkerConfig({
      TRANSLATION_WORKER_ENABLED: "true",
      TRANSLATION_PROVIDER: "google-cloud-translation",
      GOOGLE_CLOUD_PROJECT_ID: "retired-project",
    }),
    (error) => error.safeCode === "provider_selection_invalid"
  );
});

test("production worker modes require exact read-only confirmation", () => {
  assert.throws(() => assertTranslationWorkerCliIsSafe({
    databaseUrl: productionDatabaseUrl, run: true, confirmedLocal: true,
    allowProductionReadOnlyDryRun: true,
  }), /run mode refuses production/);
  assert.throws(() => assertTranslationWorkerCliIsSafe({
    databaseUrl: productionDatabaseUrl, run: false, confirmedLocal: false,
    allowProductionReadOnlyDryRun: false,
  }), new RegExp(PRODUCTION_READ_ONLY_DRY_RUN_FLAG));
  assert.deepEqual(assertTranslationWorkerCliIsSafe({
    databaseUrl: productionDatabaseUrl, run: false, confirmedLocal: false,
    allowProductionReadOnlyDryRun: true,
  }), { productionReadOnlyDryRun: true });
});

test("production backfill apply is impossible and dry-run needs confirmation", () => {
  assert.throws(() => assertTranslationBackfillCliIsSafe({
    databaseUrl: productionDatabaseUrl, apply: true, confirmedLocal: true,
    allowProductionReadOnlyDryRun: true,
  }), /apply mode refuses production/);
  assert.throws(() => assertTranslationBackfillCliIsSafe({
    databaseUrl: productionDatabaseUrl, apply: false, confirmedLocal: false,
    allowProductionReadOnlyDryRun: false,
  }), new RegExp(PRODUCTION_READ_ONLY_DRY_RUN_FLAG));
});

test("read-only inspection sets transaction state first and blocks mutations", async () => {
  const queries = [];
  const database = {
    async unsafe() { throw new Error("outside-transaction query"); },
    async begin(callback) {
      return callback({ async unsafe(query) {
        queries.push(query);
        return query.startsWith("SELECT") ? [{ count: 0 }] : [];
      } });
    },
  };
  assert.deepEqual(await runTranslationReadOnlyInspection(
    database,
    (readOnlyDatabase) => readOnlyDatabase.unsafe("SELECT count(*) FROM fixture")
  ), [{ count: 0 }]);
  assert.deepEqual(queries.slice(0, 2), [
    "SET TRANSACTION READ ONLY",
    "SELECT count(*) FROM fixture",
  ]);
  await assert.rejects(
    runTranslationReadOnlyInspection(database, (readOnlyDatabase) =>
      readOnlyDatabase.unsafe("DELETE FROM fixture")
    ),
    /SELECT queries only|read-only/i
  );
});

test("worker and backfill CLIs wire dry-runs through the read-only boundary", async () => {
  const [workerSource, backfillSource] = await Promise.all([
    readFile(fileURLToPath(new URL("../scripts/i18n/process-translation-jobs.ts", import.meta.url)), "utf8"),
    readFile(fileURLToPath(new URL("../scripts/i18n/backfill-translation-intents.ts", import.meta.url)), "utf8"),
  ]);
  assert.match(workerSource, /runTranslationReadOnlyInspection[\s\S]*getTranslationWorkerDryRun/);
  assert.match(backfillSource, /runTranslationReadOnlyInspection[\s\S]*runTranslationBackfill/);
  assert.doesNotMatch(workerSource, /resolveConfiguredTranslationProvider/);
  assert.doesNotMatch(backfillSource, /resolveConfiguredTranslationProvider/);
});
