import "dotenv/config";
import postgres from "postgres";
import {
  assertTranslationBackfillApplyIsSafe,
  runTranslationBackfill,
} from "../../lib/i18n/translations/backfill";
import { createPostgresTranslationDatabase } from "../../lib/i18n/translations/repository";

const databaseUrl = process.env.DATABASE_URL || "";
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const confirmedLocal = args.has("--confirm-local");
assertTranslationBackfillApplyIsSafe({
  databaseUrl,
  apply,
  confirmedLocal,
});

const sql = postgres(databaseUrl, {
  ssl: new URL(databaseUrl).hostname === "localhost" ? false : "require",
});

try {
  const report = await runTranslationBackfill(
    createPostgresTranslationDatabase(sql),
    { apply }
  );
  console.info("TRANSLATION_BACKFILL", {
    mode: apply ? "apply" : "dry-run",
    ...report,
  });
} finally {
  await sql.end();
}
