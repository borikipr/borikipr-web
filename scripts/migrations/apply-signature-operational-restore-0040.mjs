import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import postgres from "postgres";

const confirmation = "--confirm=APPLY_SIGNATURE_OPERATIONAL_RESTORE_0040";
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
      const [before] = await sql`SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='signature_documents'
          AND column_name='operationally_restored_at'
      ) AS present`;
      if (before?.present) {
        console.log(JSON.stringify({ applied: [], alreadyPresent: ["0040"] }));
      } else {
        await sql.unsafe(await readFile("db/migrations/0040_add_signature_operational_restore.sql", "utf8"));
        const [after] = await sql`SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='signature_documents'
            AND column_name='operationally_restored_at'
        ) AS present`;
        if (!after?.present) throw new Error("Migration verification failed.");
        console.log(JSON.stringify({ applied: ["0040"], alreadyPresent: [] }));
      }
    } catch (error) {
      console.error(JSON.stringify({
        failed: true,
        code: typeof error === "object" && error && "code" in error ? String(error.code) : "unknown",
        kind: error instanceof Error ? error.name : "unknown",
      }));
      process.exitCode = 1;
    } finally {
      await sql.end({ timeout: 2 });
    }
  }
}
