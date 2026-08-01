import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test, { after, before, beforeEach } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { handleTranslationWorkerCron } from "../lib/i18n/translations/cron-handler.ts";
import { GoogleCloudTranslationProvider } from "../lib/i18n/translations/google-provider.ts";
import { createOfficialGoogleTranslationTransport } from "../lib/i18n/translations/google-transport.ts";
import {
  readTranslationWorkerConfig,
  resolveConfiguredTranslationProvider,
} from "../lib/i18n/translations/provider-registry.ts";
import { TranslationProviderError } from "../lib/i18n/translations/provider.ts";
import { syncPropertyTranslationIntents } from "../lib/i18n/translations/source-intents.ts";
import { createTranslationWorkerRepository } from "../lib/i18n/translations/worker-repository.ts";

const migrationSql = await readFile(
  fileURLToPath(new URL("../db/migrations/0019_create_translation_persistence.sql", import.meta.url)),
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
const now = new Date("2031-08-01T12:00:00.000Z");
let propertyId;

before(async () => {
  await db.exec(`
    CREATE TABLE propiedades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), titulo text NOT NULL,
      descripcion text, destacado boolean NOT NULL DEFAULT false
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
});
beforeEach(async () => {
  await db.exec(`
    DELETE FROM translation_revision_events;
    DELETE FROM translation_jobs;
    DELETE FROM content_translations;
    DELETE FROM propiedades;
  `);
  propertyId = (
    await db.query(`
      INSERT INTO propiedades (titulo, descripcion, destacado)
      VALUES ('Casa Borikí', 'Vista al mar', true) RETURNING id::text
    `)
  ).rows[0].id;
});
after(() => db.close());

function enabledEnv(overrides = {}) {
  return {
    CRON_SECRET: "isolated-cron-secret",
    TRANSLATION_WORKER_ENABLED: "true",
    TRANSLATION_PROVIDER: "google-cloud-translation",
    GOOGLE_CLOUD_PROJECT_ID: "isolated-project",
    GOOGLE_CLOUD_TRANSLATION_LOCATION: "us-central1",
    TRANSLATION_WORKER_BATCH_SIZE: "10",
    TRANSLATION_WORKER_CONCURRENCY: "2",
    TRANSLATION_WORKER_LOCK_TIMEOUT_MS: "600000",
    TRANSLATION_PROVIDER_TIMEOUT_MS: "1000",
    TRANSLATION_WORKER_ID: "isolated-cron",
    ...overrides,
  };
}
const authorizedRequest = () =>
  new Request("http://localhost/api/cron/process-translation-jobs", {
    headers: { authorization: "Bearer isolated-cron-secret" },
  });
async function seedProperty() {
  await database.begin((transaction) =>
    syncPropertyTranslationIntents(transaction, {
      propertyId,
      title: "Casa Borikí",
      description: "Vista al mar",
      highlighted: true,
    })
  );
}

test("official transport initializes lazily and maps an Advanced glossary request", async () => {
  let factoryCalls = 0;
  let received;
  const promise = Promise.resolve([
    { glossaryTranslations: [{ translatedText: "Casa Borikí" }] },
    undefined,
    { get: (key) => (key === "x-request-id" ? ["request-123"] : []) },
  ]);
  promise.cancel = () => undefined;
  const transport = createOfficialGoogleTranslationTransport({
    requestTimeoutMs: 4321,
    glossaryId: "borikipr-brands",
    clientFactory: async () => {
      factoryCalls += 1;
      return {
        translateText(request, options) {
          received = { request, options };
          return promise;
        },
      };
    },
  });
  assert.equal(factoryCalls, 0);
  const result = await transport.translate({
    projectId: "isolated-project",
    location: "us-central1",
    sourceLanguageCode: "es",
    targetLanguageCode: "en",
    contents: ["Casa Borikí"],
    mimeType: "text/plain",
  });
  assert.equal(factoryCalls, 1);
  assert.equal(received.request.parent, "projects/isolated-project/locations/us-central1");
  assert.equal(received.request.sourceLanguageCode, "es");
  assert.equal(received.request.targetLanguageCode, "en");
  assert.deepEqual(received.request.contents, ["Casa Borikí"]);
  assert.equal(received.options.timeout, 4321);
  assert.equal(
    received.request.glossaryConfig.glossary,
    "projects/isolated-project/locations/us-central1/glossaries/borikipr-brands"
  );
  assert.equal(result.requestId, "request-123");
});

test("official transport cancels an injected SDK call", async () => {
  const controller = new AbortController();
  let rejectCall;
  let cancelled = false;
  let markStarted;
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  const promise = new Promise((_, reject) => {
    rejectCall = reject;
  });
  promise.cancel = () => {
    cancelled = true;
    rejectCall(new Error("cancelled by fixture"));
  };
  const transport = createOfficialGoogleTranslationTransport({
    requestTimeoutMs: 100,
    clientFactory: async () => ({
      translateText: () => {
        markStarted();
        return promise;
      },
    }),
  });
  const pending = transport.translate({
    projectId: "isolated-project",
    location: "global",
    sourceLanguageCode: "es",
    targetLanguageCode: "en",
    contents: ["Texto"],
    mimeType: "text/plain",
    signal: controller.signal,
  });
  await started;
  controller.abort();
  await assert.rejects(pending, (error) => error.name === "AbortError");
  assert.equal(cancelled, true);
});

test("Google adapter rejects empty sources and changed protected brands", async () => {
  let calls = 0;
  const provider = new GoogleCloudTranslationProvider({
    projectId: "isolated-project",
    location: "global",
    transport: {
      async translate() {
        calls += 1;
        return { translations: [{ translatedText: "Changed home" }] };
      },
    },
  });
  const request = {
    sourceLocale: "es-PR",
    targetLocale: "en-US",
    entityType: "property",
    fieldKey: "title",
    correlationId: "fixture",
  };
  await assert.rejects(
    provider.translate({ ...request, sourceText: "Casa Borikí" }),
    (error) => error.safeCode === "google_brand_protection_failed"
  );
  await assert.rejects(
    provider.translate({ ...request, sourceText: "   " }),
    (error) => error.safeCode === "google_source_empty"
  );
  assert.equal(calls, 1);
  const emptyProvider = new GoogleCloudTranslationProvider({
    projectId: "isolated-project",
    location: "global",
    transport: { async translate() { return { translations: [] }; } },
  });
  await assert.rejects(
    emptyProvider.translate({ ...request, sourceText: "Texto" }),
    (error) => error.safeCode === "provider_empty_result"
  );
  await assert.rejects(
    emptyProvider.translate({ ...request, sourceLocale: "en-US", sourceText: "Text" }),
    (error) => error.safeCode === "google_locale_unsupported"
  );
});

test("Google status errors are classified and redacted", async () => {
  for (const [status, kind, code] of [
    [429, "retryable", "google_rate_limited"],
    [503, "retryable", "google_unavailable"],
    [400, "permanent", "google_request_rejected"],
    [403, "configuration", "google_authentication_failed"],
  ]) {
    const provider = new GoogleCloudTranslationProvider({
      projectId: "isolated-project",
      location: "global",
      transport: {
        async translate() {
          throw Object.assign(new Error("credential=/private/key.json secret"), { status });
        },
      },
    });
    await assert.rejects(
      provider.translate({
        sourceLocale: "es-PR",
        targetLocale: "en-US",
        entityType: "testimonial",
        fieldKey: "body",
        sourceText: "Servicio excelente",
        correlationId: "fixture",
      }),
      (error) =>
        error instanceof TranslationProviderError &&
        error.kind === kind &&
        error.safeCode === code &&
        !error.message.includes("private")
    );
  }
  for (const [grpcCode, kind, code] of [
    [8, "retryable", "google_rate_limited"],
    [4, "retryable", "google_timeout"],
    [3, "permanent", "google_request_rejected"],
    [16, "configuration", "google_authentication_failed"],
    [1, "cancelled", "google_request_cancelled"],
  ]) {
    const provider = new GoogleCloudTranslationProvider({
      projectId: "isolated-project",
      location: "global",
      transport: { async translate() { throw Object.assign(new Error("raw SDK secret"), { code: grpcCode }); } },
    });
    await assert.rejects(
      provider.translate({
        sourceLocale: "es-PR", targetLocale: "en-US",
        entityType: "testimonial", fieldKey: "body",
        sourceText: "Servicio", correlationId: "fixture",
      }),
      (error) => error.kind === kind && error.safeCode === code && !error.message.includes("secret")
    );
  }
});

test("disabled and unauthorized cron paths make zero database calls", async () => {
  let databaseCalls = 0;
  const rejectingDatabase = {
    unsafe: async () => {
      databaseCalls += 1;
      throw new Error("unexpected database call");
    },
    begin: async () => {
      databaseCalls += 1;
      throw new Error("unexpected database call");
    },
  };
  const disabled = await handleTranslationWorkerCron({
    request: authorizedRequest(),
    database: rejectingDatabase,
    env: { CRON_SECRET: "isolated-cron-secret" },
  });
  assert.equal(disabled.status, 200);
  assert.equal((await disabled.json()).state, "disabled");
  for (const request of [
    new Request("http://localhost/api/cron/process-translation-jobs"),
    new Request("http://localhost/api/cron/process-translation-jobs", {
      headers: { authorization: "Bearer wrong" },
    }),
  ]) {
    const response = await handleTranslationWorkerCron({
      request,
      database: rejectingDatabase,
      env: enabledEnv(),
    });
    assert.equal(response.status, 401);
  }
  assert.equal(databaseCalls, 0);
});

test("invalid cron configuration fails closed before claiming", async () => {
  await seedProperty();
  const before = await repository.countEligible(now);
  const response = await handleTranslationWorkerCron({
    request: authorizedRequest(),
    database,
    env: enabledEnv({ GOOGLE_CLOUD_PROJECT_ID: "" }),
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).errorCode, "google_project_missing");
  assert.equal(await repository.countEligible(now), before);
});

test("authenticated isolated cron uses the shared bounded worker safely", async () => {
  await seedProperty();
  let calls = 0;
  const transport = {
    async translate(input) {
      calls += 1;
      return {
        translations: [{
          translatedText: input.contents[0].includes("Borikí")
            ? "Borikí House"
            : "Ocean view",
        }],
        requestId: `fixture-${calls}`,
        serviceVersion: "mock-v3",
      };
    },
  };
  const response = await handleTranslationWorkerCron({
    request: authorizedRequest(), database,
    env: enabledEnv({ TRANSLATION_WORKER_BATCH_SIZE: "1" }),
    googleTransport: transport,
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.summary.claimed, 1);
  assert.equal(body.summary.succeeded, 1);
  assert.equal(body.health.recentSucceeded, 1);
  assert.equal(calls, 1);
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes("Vista al mar"), false);
  assert.equal(serialized.includes("Ocean view"), false);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const second = await handleTranslationWorkerCron({
    request: authorizedRequest(), database, env: enabledEnv(), googleTransport: transport,
  });
  assert.equal((await second.json()).summary.claimed, 1);
  const third = await handleTranslationWorkerCron({
    request: authorizedRequest(), database, env: enabledEnv(), googleTransport: transport,
  });
  assert.equal((await third.json()).summary.claimed, 0);
});

test("operational health exposes aggregates and stale-lock age only", async () => {
  await seedProperty();
  const jobs = await database.unsafe(`SELECT id::text FROM translation_jobs ORDER BY created_at LIMIT 1`);
  await database.unsafe(
    `UPDATE translation_jobs SET status = 'processing', attempts = 1,
       started_at = $2, locked_at = $2, locked_by = 'stale-fixture'
     WHERE id = $1::uuid`,
    [jobs[0].id, new Date(now.getTime() - 700_000).toISOString()]
  );
  const health = await repository.getOperationalHealth({ now, lockTimeoutMs: 600_000 });
  assert.equal(health.queued, 1);
  assert.equal(health.processing, 1);
  assert.equal(health.staleProcessing, 1);
  assert.equal(health.eligibleQueued, 1);
  assert.equal(typeof health.oldestEligibleAgeMs, "number");
  assert.deepEqual(Object.keys(health).sort(), [
    "cancelled", "eligibleQueued", "failed", "lastSucceededAt",
    "oldestEligibleAgeMs", "processing", "queued", "recentSucceeded",
    "staleProcessing",
  ]);
});

test("registry stays explicit and does not discover credentials when disabled", () => {
  assert.equal(readTranslationWorkerConfig({}).enabled, false);
  const config = readTranslationWorkerConfig(enabledEnv());
  let calls = 0;
  const provider = resolveConfiguredTranslationProvider({
    config,
    googleTransport: {
      async translate() {
        calls += 1;
        return { translations: [{ translatedText: "Fixture" }] };
      },
    },
  });
  assert.equal(provider.id, "google-cloud-translation");
  assert.equal(calls, 0);
  assert.throws(
    () => readTranslationWorkerConfig({ TRANSLATION_PROVIDER: "fake" }),
    /invalid/
  );
});
