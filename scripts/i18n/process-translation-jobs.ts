import "dotenv/config";
import postgres from "postgres";
import { createPostgresTranslationDatabase } from "../../lib/i18n/translations/repository";
import { getTranslationWorkerDryRun } from "../../lib/i18n/translations/worker";
import { runConfiguredTranslationWorker } from "../../lib/i18n/translations/worker-entry";
import {
  assertTranslationWorkerCliIsSafe,
  PRODUCTION_READ_ONLY_DRY_RUN_FLAG,
} from "../../lib/i18n/translations/cli-safety";
import { runTranslationReadOnlyInspection } from "../../lib/i18n/translations/read-only";

const databaseUrl = process.env.DATABASE_URL || "";
if (!databaseUrl) throw new Error("DATABASE_URL is required.");
const args = new Set(process.argv.slice(2));
const run = args.has("--run");
const url = new URL(databaseUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
assertTranslationWorkerCliIsSafe({
  databaseUrl,
  run,
  confirmedLocal: args.has("--confirm-local"),
  allowProductionReadOnlyDryRun: args.has(PRODUCTION_READ_ONLY_DRY_RUN_FLAG),
  environment: process.env,
});

const sql = postgres(databaseUrl, {
  ssl: localHosts.has(url.hostname) ? false : "require",
});
const database = createPostgresTranslationDatabase(sql);

try {
  if (!run) {
    console.info("TRANSLATION_WORKER_DRY_RUN", {
      ...(await runTranslationReadOnlyInspection(database, (readOnlyDatabase) =>
        getTranslationWorkerDryRun(readOnlyDatabase)
      )),
      providerCalled: false,
    });
  } else {
    console.info(
      "TRANSLATION_WORKER_RUN",
      await runConfiguredTranslationWorker({ database })
    );
  }
} finally {
  await sql.end();
}
