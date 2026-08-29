import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import postgres from "postgres";

const confirmation = "--confirm=APPLY_TEAM_SIGNING_BROKERS_0048";
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
      const [before] = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'admin_users'
             AND column_name = 'signing_broker_authorized_at'
        ) AS applied
      `;
      if (before?.applied) {
        console.log(JSON.stringify({ applied: [], alreadyPresent: ["0048"] }));
      } else {
        await sql.unsafe(await readFile("db/migrations/0048_add_team_signing_brokers.sql", "utf8"));
        const verification = await sql`
          SELECT id::text, system_role, account_state, activo, signing_broker_authorized_at IS NOT NULL AS broker_authorized
            FROM public.admin_users
           WHERE id IN (
             '3cefce78-7d62-485d-9faa-6fed1b6ae377'::uuid,
             '837a7fca-c067-4878-a4eb-01c12a4cf7ba'::uuid
           )
           ORDER BY id
        `;
        if (verification.length !== 2) throw new Error("Migration verification failed.");
        const cedric = verification.find((row) => row.id === "3cefce78-7d62-485d-9faa-6fed1b6ae377");
        const ivonne = verification.find((row) => row.id === "837a7fca-c067-4878-a4eb-01c12a4cf7ba");
        if (!cedric || !ivonne || cedric.system_role !== "super_admin" || cedric.account_state !== "active" || !cedric.activo || cedric.broker_authorized || ivonne.system_role !== "admin" || ivonne.account_state !== "active" || !ivonne.activo || !ivonne.broker_authorized) throw new Error("Migration verification failed.");
        console.log(JSON.stringify({ applied: ["0048"], alreadyPresent: [] }));
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
