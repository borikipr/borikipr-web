import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { PGlite } from "@electric-sql/pglite";

const root = path.dirname(fileURLToPath(new URL("../../package.json", import.meta.url)));
const approvedRoot = path.resolve(root, "tmp", "signatures", "isolated-pglite");
const databasePath = path.resolve(process.env.SIGNING_ISOLATED_DATABASE_DIR || approvedRoot);

if (
  process.env.SIGNING_ISOLATED_ENVIRONMENT !== "true" ||
  process.env.NODE_ENV === "production" ||
  (databasePath !== approvedRoot && !databasePath.startsWith(`${approvedRoot}${path.sep}`))
) {
  throw new Error("signature_isolated_database_forbidden");
}
const password = process.env.E2E_SIGNING_ADMIN_PASSWORD;
if (!password || password.length < 16) throw new Error("signature_isolated_admin_password_missing");

if (process.argv.includes("--reset")) await rm(databasePath, { recursive: true, force: true });
await mkdir(path.dirname(databasePath), { recursive: true });
const db = new PGlite(databasePath);
await db.waitReady;

if (process.argv.includes("--recover-deliveries")) {
  const recovered = await db.query(
    `UPDATE public.signature_delivery_intents
        SET status='pending', locked_at=NULL, locked_by=NULL
      WHERE status='processing'
      RETURNING id`
  );
  console.log(JSON.stringify({ recoveredSyntheticDeliveries: recovered.rows.length }));
}

const existing = await db.query(`SELECT to_regclass('public.signature_documents')::text AS relation`);
if (!existing.rows[0]?.relation) {
  await db.exec(`
    CREATE TABLE public.admin_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      activo boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.leads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      merged_into_lead_id uuid NULL,
      last_activity_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.lead_groups (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      status text NOT NULL DEFAULT 'active',
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  const names = [
    "0013_extend_admin_authentication.sql",
    "0017_create_public_rate_limits.sql",
    "0022_create_signature_foundation.sql",
    "0023_extend_signature_signer_evidence.sql",
    "0024_add_signature_delivery_governance.sql",
    "0025_bind_signature_privacy_disclosure.sql",
  ];
  for (const name of names) {
    await db.exec(await readFile(path.join(root, "db", "migrations", name), "utf8"));
  }
}

const passwordHash = await bcrypt.hash(password, 12);
await db.query(
  `INSERT INTO public.admin_users (
     username, password_hash, activo, display_name, email, session_version
   ) VALUES ($1,$2,true,$3,$4,1)
   ON CONFLICT (username) DO UPDATE SET
     password_hash=excluded.password_hash, activo=true,
     display_name=excluded.display_name, email=excluded.email`,
  ["synthetic-signing-admin", passwordHash, "Synthetic Signing Admin", "synthetic-admin@example.test"]
);
const admin = (await db.query(
  `SELECT id::text FROM public.admin_users WHERE username=$1`,
  ["synthetic-signing-admin"]
)).rows[0];

await db.query(
  `INSERT INTO public.signature_document_type_approvals (
     document_type, status, approval_reference, approval_date, reviewed_by,
     source_reference, notes, effective_from
   ) SELECT 'ordinary_brokerage_agreement','approved','TEST-NON-PRODUCTION',
            current_date,'Synthetic Test Harness','TEST-NON-PRODUCTION',
            'Synthetic isolated drill only',now()
     WHERE NOT EXISTS (
       SELECT 1 FROM public.signature_document_type_approvals
        WHERE document_type='ordinary_brokerage_agreement' AND status='approved'
     )`
);

for (const [locale, identifier, text] of [
  ["es-PR", "test-es-pr-v1", "CONSENTIMIENTO SINTÉTICO PARA PRUEBAS AISLADAS. NO APROBADO PARA PRODUCCIÓN."],
  ["en-US", "test-en-us-v1", "SYNTHETIC CONSENT FOR ISOLATED TESTING. NOT APPROVED FOR PRODUCTION."],
]) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text.normalize("NFC")));
  const hash = Buffer.from(digest).toString("hex");
  await db.query(
    `INSERT INTO public.signature_consent_versions (
       version_identifier, locale, consent_text, consent_text_sha256, status,
       effective_from, approval_reference, created_by_admin_id
     ) VALUES ($1,$2,$3,$4,'approved',now(),'TEST-NON-PRODUCTION',$5::uuid)
     ON CONFLICT (version_identifier, locale) DO NOTHING`,
    [identifier, locale, text, hash, admin.id]
  );
}

const catalog = await db.query(`
  SELECT
    (SELECT count(*)::int FROM information_schema.tables
      WHERE table_schema='public' AND table_name LIKE 'signature_%') AS signature_tables,
    (SELECT count(*)::int FROM public.signature_documents) AS documents,
    (SELECT count(*)::int FROM public.signature_document_type_approvals
      WHERE status='approved') AS synthetic_approvals,
    (SELECT count(*)::int FROM public.signature_consent_versions
      WHERE status='approved') AS synthetic_consents
`);
console.log(JSON.stringify({ ready: true, ...catalog.rows[0] }));
await db.close();
