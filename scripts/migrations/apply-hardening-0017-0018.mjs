import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import postgres from "postgres";

if (!process.argv.includes("--confirm=APPLY_0017_0018")) {
  console.error("Refusing to apply without --confirm=APPLY_0017_0018.");
  process.exitCode = 1;
} else {
  dotenv.config({ path: ".env.local", quiet: true });
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not configured.");
    process.exitCode = 1;
  } else {
    const sql = postgres(process.env.DATABASE_URL, {
      max: 1,
      ssl: "require",
    });
    try {
      const before = await sql`
        SELECT
          to_regclass('public.public_rate_limit_buckets')::text AS rate_table,
          to_regclass('public.operational_cron_heartbeats')::text AS heartbeat_table,
          to_regclass('public.operational_alert_state')::text AS alert_table
      `;
      if (
        before[0]?.rate_table ||
        before[0]?.heartbeat_table ||
        before[0]?.alert_table
      ) {
        throw new Error("Hardening migrations are not in the expected absent state.");
      }

      const migration17 = await readFile(
        "db/migrations/0017_create_public_rate_limits.sql",
        "utf8"
      );
      const migration18 = await readFile(
        "db/migrations/0018_add_operational_monitoring.sql",
        "utf8"
      );
      await sql.unsafe(migration17);
      await sql.unsafe(migration18);

      const after = await sql`
        SELECT
          (SELECT count(*)::int FROM public.public_rate_limit_buckets) AS rate_rows,
          (SELECT count(*)::int FROM public.operational_cron_heartbeats) AS heartbeat_rows,
          (SELECT count(*)::int FROM public.operational_alert_state) AS alert_rows
      `;
      console.log(
        JSON.stringify({
          applied: ["0017", "0018"],
          rateRows: after[0]?.rate_rows ?? null,
          heartbeatRows: after[0]?.heartbeat_rows ?? null,
          alertRows: after[0]?.alert_rows ?? null,
        })
      );
    } catch {
      console.error(
        "Hardening migration apply failed; database details were suppressed."
      );
      process.exitCode = 1;
    } finally {
      await sql.end({ timeout: 2 });
    }
  }
}
