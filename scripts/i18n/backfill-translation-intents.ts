import "dotenv/config";
import postgres from "postgres";
import {
  assertTranslationBackfillApplyIsSafe,
  runTranslationBackfill,
} from "../../lib/i18n/translations/backfill";
import { createPostgresTranslationDatabase } from "../../lib/i18n/translations/repository";
import { PRODUCTION_READ_ONLY_DRY_RUN_FLAG } from "../../lib/i18n/translations/cli-safety";
import { runTranslationReadOnlyInspection } from "../../lib/i18n/translations/read-only";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL || "";
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");

  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const confirmedLocal = args.has("--confirm-local");
  assertTranslationBackfillApplyIsSafe({
    databaseUrl,
    apply,
    confirmedLocal,
    allowProductionReadOnlyDryRun: args.has(PRODUCTION_READ_ONLY_DRY_RUN_FLAG),
    environment: process.env,
  });

  const url = new URL(databaseUrl);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const sql = postgres(databaseUrl, {
    ssl: localHosts.has(url.hostname) ? false : "require",
  });

  try {
    const database = createPostgresTranslationDatabase(sql);
    const report = apply
      ? await runTranslationBackfill(database, { apply: true })
      : await runTranslationReadOnlyInspection(database, (readOnlyDatabase) =>
          runTranslationBackfill(readOnlyDatabase, { apply: false })
        );
    console.info("TRANSLATION_BACKFILL", {
      mode: apply ? "apply" : "dry-run",
      ...report,
      providerCalled: false,
    });
  } finally {
    await sql.end();
  }
}

void main().catch(() => {
  console.error(
    "TRANSLATION_BACKFILL_CLI_FAILED",
    { errorCode: "backfill_cli_failed", sensitiveDetailsSuppressed: true }
  );
  process.exitCode = 1;
});
