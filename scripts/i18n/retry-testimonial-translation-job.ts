import "dotenv/config";
import postgres from "postgres";
import { createPostgresTranslationDatabase } from "../../lib/i18n/translations/repository";
import { runTranslationReadOnlyInspection } from "../../lib/i18n/translations/read-only";
import {
  applySingleTestimonialFailedJobRetry,
  assertTestimonialRetryCliIsSafe,
  inspectSingleTestimonialFailedJobRetry,
  parseTestimonialRetryCliArgs,
  safeTestimonialRetryErrorCode,
} from "../../lib/i18n/translations/testimonial-retry";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL || "";
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const options = parseTestimonialRetryCliArgs(process.argv.slice(2));
  assertTestimonialRetryCliIsSafe({
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
      ? await applySingleTestimonialFailedJobRetry(
          database,
          options.testimonialId
        )
      : await runTranslationReadOnlyInspection(
          database,
          (readOnlyDatabase) =>
            inspectSingleTestimonialFailedJobRetry(
              readOnlyDatabase,
              options.testimonialId
            )
        );
    console.info("TESTIMONIAL_TRANSLATION_RETRY", {
      mode: options.apply ? "apply" : "dry-run",
      ...report,
    });
  } finally {
    await sql.end();
  }
}

void main().catch((error) => {
  console.error("TESTIMONIAL_TRANSLATION_RETRY_FAILED", {
    errorCode: safeTestimonialRetryErrorCode(error),
    sensitiveDetailsSuppressed: true,
  });
  process.exitCode = 1;
});
