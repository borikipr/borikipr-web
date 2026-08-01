import postgres from "postgres";

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

export const sql = postgres(connectionString, {
  ssl: disableSsl ? false : "require",
});
