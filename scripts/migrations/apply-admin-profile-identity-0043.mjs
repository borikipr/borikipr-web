import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local", quiet: true });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not configured.");
  process.exitCode = 1;
} else {
  const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
  try {
    const rows = await sql.unsafe(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'admin_users'
            AND column_name = 'professional_title'
       ) AS exists`
    );
    if (rows[0]?.exists) throw new Error("0043 is already applied.");
    await sql.unsafe(await readFile("db/migrations/0043_add_admin_profile_identity.sql", "utf8"));
    console.log("Applied migration 0043.");
  } catch {
    console.error("Admin profile identity migration failed; database details were intentionally suppressed.");
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
