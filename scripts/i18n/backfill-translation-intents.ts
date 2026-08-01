import "dotenv/config";
import postgres from "postgres";
import {
  assertTranslationBackfillApplyIsSafe,
  runTranslationBackfill,
} from "../../lib/i18n/translations/backfill";
import { createPostgresTranslationDatabase } from "../../lib/i18n/translations/repository";
import { PRODUCTION_READ_ONLY_DRY_RUN_FLAG } from "../../lib/i18n/translations/cli-safety";
import { runTranslationReadOnlyInspection } from "../../lib/i18n/translations/read-only";

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

const sql = postgres(databaseUrl, {
  ssl: new URL(databaseUrl).hostname === "localhost" ? false : "require",
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
  });
} finally {
  await sql.end();
}
