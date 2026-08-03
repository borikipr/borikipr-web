import "dotenv/config";
import postgres from "postgres";
import { createPostgresTranslationDatabase } from "../../lib/i18n/translations/repository";
import { runTranslationReadOnlyInspection } from "../../lib/i18n/translations/read-only";
import {
  applySinglePropertyTranslationIntent,
  assertPropertyIntentCliIsSafe,
  inspectSinglePropertyTranslationIntent,
  parsePropertyIntentCliArgs,
  safePropertyIntentErrorCode,
} from "../../lib/i18n/translations/property-intent";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL || "";
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const options = parsePropertyIntentCliArgs(process.argv.slice(2));
  assertPropertyIntentCliIsSafe({ databaseUrl, options, environment: process.env });

  const url = new URL(databaseUrl);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const sql = postgres(databaseUrl, {
    ssl: localHosts.has(url.hostname) ? false : "require",
  });
  const database = createPostgresTranslationDatabase(sql);

  try {
    const report = options.apply
      ? await applySinglePropertyTranslationIntent(database, options.propertyId)
      : await runTranslationReadOnlyInspection(database, (readOnlyDatabase) =>
          inspectSinglePropertyTranslationIntent(readOnlyDatabase, options.propertyId)
        );
    console.info("PROPERTY_TRANSLATION_INTENT", {
      mode: options.apply ? "apply" : "dry-run",
      ...report,
    });
  } finally {
    await sql.end();
  }
}

void main().catch((error) => {
  console.error("PROPERTY_TRANSLATION_INTENT_FAILED", {
    errorCode: safePropertyIntentErrorCode(error),
    sensitiveDetailsSuppressed: true,
  });
  process.exitCode = 1;
});
