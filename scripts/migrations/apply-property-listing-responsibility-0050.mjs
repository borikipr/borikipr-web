import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import postgres from "postgres";

const confirmation = "--confirm=APPLY_PROPERTY_LISTING_RESPONSIBILITY_0050";
if (!process.argv.includes(confirmation)) {
  console.error(`Refusing to apply without ${confirmation}.`);
  process.exitCode = 1;
} else {
  dotenv.config({ path: ".env.local", quiet: true });
  const sql = process.env.DATABASE_URL ? postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" }) : null;
  if (!sql) { console.error("DATABASE_URL is not configured."); process.exitCode = 1; }
  else try {
    const [before] = await sql`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='propiedades' AND column_name='listing_responsible_user_id') AS applied`;
    if (before.applied) console.log(JSON.stringify({ applied: [], alreadyPresent: ["0050"] }));
    else {
      await sql.unsafe(await readFile("db/migrations/0050_add_property_listing_responsibility.sql", "utf8"));
      const verification = await sql`SELECT (SELECT count(*)::int FROM public.propiedades WHERE listing_responsible_user_id IS NOT NULL) AS assignments, (SELECT count(*)::int FROM public.property_listing_responsibility_events) AS events`;
      if (verification[0].assignments !== 0 || verification[0].events !== 0) throw new Error("Migration verification failed.");
      console.log(JSON.stringify({ applied: ["0050"], alreadyPresent: [] }));
    }
  } catch (error) { console.error(JSON.stringify({ failed:true, code: typeof error === "object" && error && "code" in error ? String(error.code) : "unknown" })); process.exitCode = 1; }
  finally { await sql.end({ timeout: 2 }); }
}
