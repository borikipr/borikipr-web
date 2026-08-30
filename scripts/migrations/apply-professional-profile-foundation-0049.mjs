import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import postgres from "postgres";

const confirmation = "--confirm=APPLY_PROFESSIONAL_PROFILE_FOUNDATION_0049";
if (!process.argv.includes(confirmation)) {
  console.error(`Refusing to apply without ${confirmation}.`);
  process.exitCode = 1;
} else {
  dotenv.config({ path: ".env.local", quiet: true });
  const sql = process.env.DATABASE_URL ? postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" }) : null;
  if (!sql) { console.error("DATABASE_URL is not configured."); process.exitCode = 1; }
  else try {
    const [before] = await sql`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='admin_users' AND column_name='professional_email') AS applied`;
    if (before.applied) console.log(JSON.stringify({ applied: [], alreadyPresent: ["0049"] }));
    else {
      await sql.unsafe(await readFile("db/migrations/0049_add_professional_profile_foundation.sql", "utf8"));
      const verification = await sql`SELECT count(*)::int AS private_defaults FROM public.admin_users WHERE professional_email IS NULL AND professional_phone_e164 IS NULL AND professional_phone_whatsapp_enabled=false AND professional_bio IS NULL AND public_profile_enabled=false AND public_profile_slug IS NULL AND public_profile_approval_state='draft' AND public_profile_approved_at IS NULL AND public_profile_approved_by_admin_id IS NULL`;
      const total = await sql`SELECT count(*)::int AS total FROM public.admin_users`;
      if (verification[0].private_defaults !== total[0].total) throw new Error("Migration verification failed.");
      console.log(JSON.stringify({ applied: ["0049"], alreadyPresent: [] }));
    }
  } catch (error) { console.error(JSON.stringify({ failed:true, code: typeof error === "object" && error && "code" in error ? String(error.code) : "unknown" })); process.exitCode = 1; }
  finally { await sql.end({ timeout: 2 }); }
}
