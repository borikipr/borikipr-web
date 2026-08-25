import postgres from "postgres";
import { createIsolatedPGliteSql } from "@/lib/isolated-pg-sql";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está configurada.");
}

const databaseUrl = new URL(connectionString);
const databaseName = databaseUrl.pathname.replace(/^\//, "");
const allowIsolatedDatabase =
  process.env.ALLOW_ISOLATED_DATABASE === "true" &&
  (databaseUrl.hostname === "127.0.0.1" || databaseUrl.hostname === "localhost") &&
  /(?:fixture|test|isolat)/i.test(databaseName);
const disableSsl =
  allowIsolatedDatabase && process.env.DATABASE_SSL === "disable";

export const sql = allowIsolatedDatabase
  ? createIsolatedPGliteSql(
      process.env.SIGNING_ISOLATED_DATABASE_DIR ??
        (() => { throw new Error("signature_isolated_database_path_missing"); })()
    )
  : postgres(connectionString, {
      ssl: disableSsl ? false : "require",
      // Vercel functions already connect through Neon's pooled endpoint. A
      // single short-lived connection per warm instance avoids multiplying
      // idle pools without changing transaction or freshness semantics.
      max: 1,
      idle_timeout: 10,
      connect_timeout: 10,
      prepare: false,
    });
