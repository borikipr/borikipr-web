import assert from "node:assert/strict";
import "./translation-azure-provider.test.mjs";
import "./translation-property-intent.test.mjs";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertGoogleAuthenticationConfig,
  buildGoogleWorkloadIdentityAudience,
} from "../lib/i18n/translations/google-auth-config.ts";
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

const productionDatabaseUrl =
  "postgres://redacted@ep-fixture.neon.tech/production";
const completeWifEnv = {
  VERCEL_ENV: "production",
  TRANSLATION_WORKER_ENABLED: "true",
  TRANSLATION_PROVIDER: "google-cloud-translation",
  GOOGLE_CLOUD_PROJECT_ID: "fixture-project",
  GOOGLE_CLOUD_PROJECT_NUMBER: "123456789012",
  GOOGLE_CLOUD_SERVICE_ACCOUNT_EMAIL:
    "borikipr-translation-worker@fixture-project.iam.gserviceaccount.com",
  GOOGLE_CLOUD_WORKLOAD_IDENTITY_POOL_ID: "vercel-prod",
  GOOGLE_CLOUD_WORKLOAD_IDENTITY_PROVIDER_ID: "vercel-prod",
};

test("disabled Vercel configuration stays import-safe while enabled WIF fails closed", () => {
  const disabled = readTranslationWorkerConfig({ VERCEL_ENV: "production" });
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.googleAuthentication.mode, "vercel-wif");
  assert.throws(
    () => resolveConfiguredTranslationProvider({ config: disabled }),
    (error) => error.safeCode === "worker_disabled"
  );

  const enabledMissing = readTranslationWorkerConfig({
    VERCEL_ENV: "production",
    TRANSLATION_WORKER_ENABLED: "true",
    TRANSLATION_PROVIDER: "google-cloud-translation",
    GOOGLE_CLOUD_PROJECT_ID: "fixture-project",
  });
  assert.throws(
    () => resolveConfiguredTranslationProvider({ config: enabledMissing }),
    (error) =>
      error.safeCode === "google_authentication_configuration_invalid"
  );
});

test("complete WIF configuration is typed and audience-bound", () => {
  const config = readTranslationWorkerConfig(completeWifEnv);
  assert.equal(config.googleAuthentication.mode, "vercel-wif");
  const authentication = assertGoogleAuthenticationConfig(
    config.googleAuthentication
  );
  assert.equal(
    authentication.workloadIdentityAudience,
    buildGoogleWorkloadIdentityAudience({
      projectNumber: completeWifEnv.GOOGLE_CLOUD_PROJECT_NUMBER,
      poolId: completeWifEnv.GOOGLE_CLOUD_WORKLOAD_IDENTITY_POOL_ID,
      providerId: completeWifEnv.GOOGLE_CLOUD_WORKLOAD_IDENTITY_PROVIDER_ID,
    })
  );
  const provider = resolveConfiguredTranslationProvider({
    config,
    googleTransport: { async translate() { throw new Error("not called"); } },
  });
  assert.equal(provider.id, "google-cloud-translation");
});

test("malformed WIF values and Vercel ADC are rejected only on resolution", () => {
  for (const overrides of [
    { GOOGLE_CLOUD_PROJECT_NUMBER: "not-a-number" },
    { GOOGLE_CLOUD_SERVICE_ACCOUNT_EMAIL: "forged@example.com" },
    { GOOGLE_CLOUD_WORKLOAD_IDENTITY_POOL_ID: "INVALID" },
    { GOOGLE_CLOUD_WORKLOAD_IDENTITY_PROVIDER_ID: "x" },
    { GOOGLE_CLOUD_WORKLOAD_IDENTITY_AUDIENCE: "//wrong/audience" },
  ]) {
    const config = readTranslationWorkerConfig({
      ...completeWifEnv,
      ...overrides,
    });
    assert.throws(
      () => resolveConfiguredTranslationProvider({ config }),
      (error) =>
        error.safeCode === "google_authentication_configuration_invalid"
    );
  }
  const explicitAdc = readTranslationWorkerConfig({
    ...completeWifEnv,
    GOOGLE_CLOUD_AUTH_MODE: "adc",
  });
  assert.throws(
    () => resolveConfiguredTranslationProvider({ config: explicitAdc }),
    /ADC mode is not permitted/
  );
});

test("official WIF boundary stays lazy and injects auth without network", () => {
  const fixture = fileURLToPath(
    new URL("./fixtures/google-wif-auth-fixture.ts", import.meta.url)
  );
  const output = execFileSync(
    process.execPath,
    ["--conditions=react-server", "--import", "tsx", fixture],
    { encoding: "utf8", env: { ...process.env, NODE_ENV: "test" } }
  );
  assert.deepEqual(JSON.parse(output.trim()), {
    authClientCreated: true,
    tokenRetrievedOnlyBySupplier: true,
    authPassedToTranslationClient: true,
  });
});

test("production worker modes require exact read-only confirmation", () => {
  assert.throws(
    () =>
      assertTranslationWorkerCliIsSafe({
        databaseUrl: productionDatabaseUrl,
        run: true,
        confirmedLocal: true,
        allowProductionReadOnlyDryRun: true,
      }),
    /run mode refuses production/
  );
  assert.throws(
    () =>
      assertTranslationWorkerCliIsSafe({
        databaseUrl: productionDatabaseUrl,
        run: false,
        confirmedLocal: false,
        allowProductionReadOnlyDryRun: false,
      }),
    new RegExp(PRODUCTION_READ_ONLY_DRY_RUN_FLAG)
  );
  assert.deepEqual(
    assertTranslationWorkerCliIsSafe({
      databaseUrl: productionDatabaseUrl,
      run: false,
      confirmedLocal: false,
      allowProductionReadOnlyDryRun: true,
    }),
    { productionReadOnlyDryRun: true }
  );
});

test("production backfill apply is impossible and dry-run needs confirmation", () => {
  assert.throws(
    () =>
      assertTranslationBackfillCliIsSafe({
        databaseUrl: productionDatabaseUrl,
        apply: true,
        confirmedLocal: true,
        allowProductionReadOnlyDryRun: true,
      }),
    /apply mode refuses production/
  );
  assert.throws(
    () =>
      assertTranslationBackfillCliIsSafe({
        databaseUrl: productionDatabaseUrl,
        apply: false,
        confirmedLocal: false,
        allowProductionReadOnlyDryRun: false,
      }),
    new RegExp(PRODUCTION_READ_ONLY_DRY_RUN_FLAG)
  );
  assert.deepEqual(
    assertTranslationBackfillCliIsSafe({
      databaseUrl: productionDatabaseUrl,
      apply: false,
      confirmedLocal: false,
      allowProductionReadOnlyDryRun: true,
    }),
    { productionReadOnlyDryRun: true }
  );
});

test("read-only inspection sets transaction state first and blocks mutations", async () => {
  const queries = [];
  let began = 0;
  const database = {
    async unsafe() {
      throw new Error("outside-transaction query");
    },
    async begin(callback) {
      began += 1;
      return callback({
        async unsafe(query) {
          queries.push(query);
          return query.startsWith("SELECT") ? [{ count: 0 }] : [];
        },
      });
    },
  };
  const selected = await runTranslationReadOnlyInspection(
    database,
    (readOnlyDatabase) => readOnlyDatabase.unsafe("SELECT count(*) FROM fixture")
  );
  assert.deepEqual(selected, [{ count: 0 }]);
  assert.equal(began, 1);
  assert.equal(queries[0], "SET TRANSACTION READ ONLY");
  assert.equal(queries[1], "SELECT count(*) FROM fixture");
  for (const statement of [
    "INSERT INTO fixture DEFAULT VALUES",
    "UPDATE fixture SET value = 1",
    "DELETE FROM fixture",
    "WITH changed AS (DELETE FROM fixture RETURNING *) SELECT * FROM changed",
  ]) {
    await assert.rejects(
      runTranslationReadOnlyInspection(database, (readOnlyDatabase) =>
        readOnlyDatabase.unsafe(statement)
      ),
      /SELECT queries only|read-only/i
    );
  }
});

test("worker and backfill CLIs wire every dry-run through the read-only boundary", async () => {
  const [workerSource, backfillSource] = await Promise.all([
    readFile(
      fileURLToPath(
        new URL("../scripts/i18n/process-translation-jobs.ts", import.meta.url)
      ),
      "utf8"
    ),
    readFile(
      fileURLToPath(
        new URL("../scripts/i18n/backfill-translation-intents.ts", import.meta.url)
      ),
      "utf8"
    ),
  ]);
  assert.match(workerSource, /assertTranslationWorkerCliIsSafe/);
  assert.match(workerSource, /runTranslationReadOnlyInspection[\s\S]*getTranslationWorkerDryRun/);
  assert.match(backfillSource, /assertTranslationBackfillApplyIsSafe/);
  assert.match(backfillSource, /runTranslationReadOnlyInspection[\s\S]*runTranslationBackfill/);
  assert.doesNotMatch(workerSource, /resolveConfiguredTranslationProvider/);
  assert.doesNotMatch(backfillSource, /resolveConfiguredTranslationProvider/);
});
