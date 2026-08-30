import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import postgres from "postgres";

const confirmation = "--confirm=APPLY_PROFESSIONAL_PHONE_E164_CONSTRAINT_0052";
if (!process.argv.includes(confirmation)) {
  console.error(`Refusing to apply without ${confirmation}.`);
  process.exitCode = 1;
} else {
  dotenv.config({ path: ".env.local", quiet: true });
  const sql = process.env.DATABASE_URL ? postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" }) : null;
  if (!sql) { console.error("DATABASE_URL is not configured."); process.exitCode = 1; }
  else try {
    const [before] = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.admin_users'::regclass
           AND conname = 'admin_users_professional_phone_e164_check'
           AND pg_get_constraintdef(oid) LIKE '%^[+]%'
      ) AS applied
    `;
    if (before.applied) console.log(JSON.stringify({ applied: [], alreadyPresent: ["0052"] }));
    else {
      await sql.unsafe(await readFile("db/migrations/0052_fix_professional_phone_e164_constraint.sql", "utf8"));
      const [verification] = await sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_constraint
           WHERE conrelid = 'public.admin_users'::regclass
             AND conname = 'admin_users_professional_phone_e164_check'
             AND pg_get_constraintdef(oid) LIKE '%^[+]%'
        ) AS applied
      `;
      if (!verification.applied) throw new Error("Migration verification failed.");
      console.log(JSON.stringify({ applied: ["0052"], alreadyPresent: [] }));
    }
  } catch (error) {
    console.error(JSON.stringify({ failed: true, code: typeof error === "object" && error && "code" in error ? String(error.code) : "unknown" }));
    process.exitCode = 1;
  } finally { await sql.end({ timeout: 2 }); }
}
