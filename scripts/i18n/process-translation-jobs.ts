import "dotenv/config";
import postgres from "postgres";
import { createPostgresTranslationDatabase } from "../../lib/i18n/translations/repository";
import { getTranslationWorkerDryRun } from "../../lib/i18n/translations/worker";
import { runConfiguredTranslationWorker } from "../../lib/i18n/translations/worker-entry";

const databaseUrl = process.env.DATABASE_URL || "";
if (!databaseUrl) throw new Error("DATABASE_URL is required.");
const url = new URL(databaseUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
if (
  url.hostname.endsWith(".neon.tech") ||
  process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production"
) {
  throw new Error("Translation worker refuses production configuration.");
}

const args = new Set(process.argv.slice(2));
const run = args.has("--run");
if (run && (!args.has("--confirm-local") || !localHosts.has(url.hostname))) {
  throw new Error(
    "Worker run mode requires --run, --confirm-local, and a local database."
  );
}

const sql = postgres(databaseUrl, {
  ssl: localHosts.has(url.hostname) ? false : "require",
});
const database = createPostgresTranslationDatabase(sql);

try {
  if (!run) {
    console.info("TRANSLATION_WORKER_DRY_RUN", {
      ...(await getTranslationWorkerDryRun(database)),
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
