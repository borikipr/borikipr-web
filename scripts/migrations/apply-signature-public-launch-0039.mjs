import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import postgres from "postgres";

const confirmation = "--confirm=APPLY_SIGNATURE_PUBLIC_LAUNCH_0039";

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
      const before = await sql`
        SELECT
          EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'signature_launch_auth_public_scope_check'
          ) AS public_scope_present
      `;
      if (before[0]?.public_scope_present) {
        console.log(JSON.stringify({ applied: [], alreadyPresent: ["0039"] }));
      } else {
        const migration = await readFile(
          "db/migrations/0039_add_public_launch_readiness_scope.sql",
          "utf8"
        );
        await sql.unsafe(migration);
        const after = await sql`
          SELECT
            EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conname = 'signature_launch_auth_public_scope_check'
            ) AS public_scope_present
        `;
        if (!after[0]?.public_scope_present) {
          throw new Error("Migration verification failed.");
        }
        console.log(JSON.stringify({ applied: ["0039"], alreadyPresent: [] }));
      }
    } catch {
      console.error("Signature public-launch migration failed; database details were suppressed.");
      process.exitCode = 1;
    } finally {
      await sql.end({ timeout: 2 });
    }
  }
}
