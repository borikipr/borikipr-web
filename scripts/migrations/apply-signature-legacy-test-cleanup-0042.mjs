import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import postgres from "postgres";

const confirmation = "--confirm=APPLY_SIGNATURE_LEGACY_TEST_CLEANUP_0042";
if (!process.argv.includes(confirmation)) {
  console.error(`Refusing to apply without ${confirmation}.`);
  process.exitCode = 1;
} else {
  dotenv.config({ path: ".env.local", quiet: true });
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not configured.");
    process.exitCode = 1;
  } else {
    const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
    try {
      const [before] = await sql`SELECT is_nullable='YES' AS applied
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='signature_test_cleanup_events'
          AND column_name='internal_canary_authorization_id'`;
      if (before?.applied) {
        console.log(JSON.stringify({ applied: [], alreadyPresent: ["0042"] }));
      } else {
        await sql.unsafe(await readFile("db/migrations/0042_expand_test_signature_cleanup.sql", "utf8"));
        const [after] = await sql`SELECT is_nullable='YES' AS applied
          FROM information_schema.columns
          WHERE table_schema='public' AND table_name='signature_test_cleanup_events'
            AND column_name='internal_canary_authorization_id'`;
        if (!after?.applied) throw new Error("Migration verification failed.");
        console.log(JSON.stringify({ applied: ["0042"], alreadyPresent: [] }));
      }
    } catch (error) {
      console.error(JSON.stringify({
        failed: true,
        code: typeof error === "object" && error && "code" in error ? String(error.code) : "unknown",
        kind: error instanceof Error ? error.name : "unknown",
      }));
      process.exitCode = 1;
    } finally { await sql.end({ timeout: 2 }); }
  }
}
