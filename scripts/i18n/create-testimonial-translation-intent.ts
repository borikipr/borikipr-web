import "dotenv/config";
import postgres from "postgres";
import { createPostgresTranslationDatabase } from "../../lib/i18n/translations/repository";
import { runTranslationReadOnlyInspection } from "../../lib/i18n/translations/read-only";
import {
  applySingleTestimonialTranslationIntent,
  assertTestimonialIntentCliIsSafe,
  inspectSingleTestimonialTranslationIntent,
  parseTestimonialIntentCliArgs,
  safeTestimonialIntentErrorCode,
} from "../../lib/i18n/translations/testimonial-intent";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL || "";
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const options = parseTestimonialIntentCliArgs(process.argv.slice(2));
  assertTestimonialIntentCliIsSafe({
    databaseUrl,
    options,
    environment: process.env,
  });

  const url = new URL(databaseUrl);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const sql = postgres(databaseUrl, {
    ssl: localHosts.has(url.hostname) ? false : "require",
  });
  const database = createPostgresTranslationDatabase(sql);

  try {
    const report = options.apply
      ? await applySingleTestimonialTranslationIntent(
          database,
          options.testimonialId
        )
      : await runTranslationReadOnlyInspection(
          database,
          (readOnlyDatabase) =>
            inspectSingleTestimonialTranslationIntent(
              readOnlyDatabase,
              options.testimonialId
            )
        );
    console.info("TESTIMONIAL_TRANSLATION_INTENT", {
      mode: options.apply ? "apply" : "dry-run",
      ...report,
    });
  } finally {
    await sql.end();
  }
}

void main().catch((error) => {
  console.error("TESTIMONIAL_TRANSLATION_INTENT_FAILED", {
    errorCode: safeTestimonialIntentErrorCode(error),
    sensitiveDetailsSuppressed: true,
  });
  process.exitCode = 1;
});
