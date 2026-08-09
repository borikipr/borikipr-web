import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(new URL("../../package.json", import.meta.url)));
const temporaryRoot = path.resolve(root, "tmp", "signatures");
const databasePath = path.join(temporaryRoot, "isolated-pglite");
const storagePath = path.join(temporaryRoot, "isolated-r2");
const runtimeSecretsPath = path.join(temporaryRoot, "isolated-runtime-secrets.json");
await mkdir(temporaryRoot, { recursive: true });

const key = () => randomBytes(48).toString("base64url");
async function loadRuntimeSecrets() {
  try {
    const parsed = JSON.parse(await readFile(runtimeSecretsPath, "utf8"));
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !["session", "rateLimit", "event", "network"].every(
        (name) => typeof parsed[name] === "string" && parsed[name].length >= 48
      )
    ) throw new Error("signature_isolated_runtime_secrets_invalid");
    return parsed;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const created = {
      session: key(),
      rateLimit: key(),
      event: key(),
      network: key(),
    };
    await writeFile(runtimeSecretsPath, JSON.stringify(created), { flag: "wx", mode: 0o600 });
    return created;
  }
}
const runtimeSecrets = await loadRuntimeSecrets();
const childEnvironment = {
  ...process.env,
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:65432/isolated_signing",
  ALLOW_ISOLATED_DATABASE: "true",
  DATABASE_SSL: "disable",
  SIGNING_ISOLATED_DATABASE_DIR: databasePath,
  SIGNING_PUBLIC_ENABLED: "true",
  SIGNING_ISOLATED_ENVIRONMENT: "true",
  SIGNING_ISOLATED_EMAIL_SINK: "memory",
  SIGNING_ISOLATED_STORAGE_DIR: storagePath,
  SESSION_SECRET: runtimeSecrets.session,
  RATE_LIMIT_HASH_SECRET: runtimeSecrets.rateLimit,
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100",
  NEXT_PUBLIC_GA_MEASUREMENT_ID: "",
  NEXT_PUBLIC_CLARITY_PROJECT_ID: "",
  SIGNATURE_EVENT_HMAC_CURRENT_VERSION: "1",
  SIGNATURE_EVENT_HMAC_KEYS_JSON: JSON.stringify({ 1: runtimeSecrets.event }),
  SIGNATURE_NETWORK_EVIDENCE_HMAC_KEY: runtimeSecrets.network,
  SIGNATURE_RETENTION_POLICY_JSON: JSON.stringify({
    version: "test-v1",
    approvalReference: "TEST-NON-PRODUCTION",
    privacyReference: "TEST-NON-PRODUCTION",
    sourcePdfDays: 30,
    completedPdfDays: null,
    certificateDays: null,
    evidenceManifestDays: null,
    tokenDays: 7,
    sessionHours: 24,
    networkEvidenceDays: 30,
    failedCancelledDraftDays: 7,
    auditEventDays: null,
    completedCleanupEnabled: false,
  }),
  SIGNATURE_PRIVACY_DISCLOSURE_JSON: JSON.stringify({
    version: "test-privacy-v1",
    approvalReference: "TEST-NON-PRODUCTION",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    locales: {
      "es-PR": "DIVULGACIÓN SINTÉTICA DE PRIVACIDAD PARA PRUEBAS AISLADAS. NO APROBADA PARA PRODUCCIÓN.",
      "en-US": "SYNTHETIC PRIVACY DISCLOSURE FOR ISOLATED TESTING. NOT APPROVED FOR PRODUCTION.",
    },
  }),
};

const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextCli, "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3100"], {
  cwd: root,
  env: childEnvironment,
  stdio: "inherit",
});

let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  child.kill("SIGTERM");
  process.exit(code);
}
child.on("exit", (code) => stop(code ?? 0));
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
console.log("isolated_signing_runtime_started=http://127.0.0.1:3100");
