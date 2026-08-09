import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: resolve(root, ".env.local"), quiet: true });

const knownFiles = (await readdir(resolve(root, "db/migrations")))
  .filter((name) => /^\d{4}_.+\.sql$/.test(name) && !name.endsWith(".rollback.sql"))
  .sort();

if (!process.env.DATABASE_URL) {
  console.error("Schema audit unavailable: DATABASE_URL is not configured.");
  process.exitCode = 1;
} else {
  const { default: postgres } = await import("postgres");
  const sql = postgres(process.env.DATABASE_URL, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
  });

  try {
    const rows = await sql`
      WITH facts AS (
        SELECT
          to_regclass('public.leads') IS NOT NULL AS v0001,
          to_regclass('public.buyer_tenant_inquiries') IS NOT NULL AS v0002,
          EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='email_queue'
              AND column_name='canonical_lead_id'
          ) AS v0003,
          EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='consultas_propiedad'
              AND column_name='showing_event_key'
          ) AS v0004,
          (
            SELECT is_nullable='NO' AND data_type='uuid'
            FROM information_schema.columns
            WHERE table_schema='public' AND table_name='consultas_propiedad'
              AND column_name='propiedad_id'
          ) AND (
            SELECT is_nullable='NO' AND data_type='timestamp with time zone'
            FROM information_schema.columns
            WHERE table_schema='public' AND table_name='consultas_propiedad'
              AND column_name='created_at'
          ) AS v0005,
          EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='property_priority_registrations'
              AND column_name='lead_id'
          ) AS v0006,
          to_regclass('public.lead_management_events') IS NOT NULL AS v0007,
          EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid='public.lead_management_events'::regclass
              AND pg_get_constraintdef(oid) LIKE '%contacted%'
          ) AS v0008,
          EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid='public.lead_management_events'::regclass
              AND pg_get_constraintdef(oid) LIKE '%document_accessed%'
          ) AS v0009,
          to_regclass('public.lead_merge_events') IS NOT NULL AS v0010,
          to_regclass('public.lead_groups') IS NOT NULL AS v0011,
          EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid='public.lead_group_events'::regclass
              AND pg_get_constraintdef(oid) LIKE '%member_role_changed%'
          ) AS v0012,
          to_regclass('public.admin_password_reset_tokens') IS NOT NULL AS v0013,
          EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='consultas_propiedad'
              AND column_name='reused_property_buyer_profile_id'
          ) AS v0014,
          EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='propiedades'
              AND column_name='open_house_solar_question_enabled'
          ) AS v0015,
          EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='propiedades'
              AND column_name='private_showing_token'
          ) AS v0016,
          to_regclass('public.public_rate_limit_buckets') IS NOT NULL AS v0017,
          to_regclass('public.operational_cron_heartbeats') IS NOT NULL
            AND to_regclass('public.operational_alert_state') IS NOT NULL AS v0018,
          to_regclass('public.content_translations') IS NOT NULL
            AND to_regclass('public.translation_jobs') IS NOT NULL
            AND to_regclass('public.translation_revision_events') IS NOT NULL AS v0019,
          EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='content_translations'
              AND column_name='regeneration_authorized_at'
              AND data_type='timestamp with time zone'
              AND is_nullable='YES'
          ) AS v0020,
          to_regclass('public.translation_provider_usage_buckets') IS NOT NULL
            AND (
              SELECT column_default = '2'
              FROM information_schema.columns
              WHERE table_schema='public' AND table_name='translation_jobs'
                AND column_name='max_attempts'
            ) AS v0021,
          (
            SELECT count(*) = 8
            FROM information_schema.tables
            WHERE table_schema='public'
              AND table_name IN (
                'signature_documents', 'signature_document_versions',
                'signature_participants', 'signature_fields',
                'signature_field_values', 'signature_signing_tokens',
                'signature_sessions', 'signature_events'
              )
          ) AND EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname='signature_events_immutable_trigger'
              AND NOT tgisinternal
          ) AS v0022
          ,EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='signature_participants'
              AND column_name='consent_text_sha256'
          ) AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='signature_field_values'
              AND column_name='sanitized_value_payload'
          ) AS v0023
          ,to_regclass('public.signature_document_type_approvals') IS NOT NULL
            AND to_regclass('public.signature_consent_versions') IS NOT NULL
            AND to_regclass('public.signature_delivery_intents') IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='signature_documents'
                AND column_name='consent_version_id'
            ) AS v0024
      )
      SELECT * FROM facts
    `;

    const facts = rows[0] ?? {};
    const repositoryVersions = knownFiles.map((name) => name.slice(0, 4));
    const confirmed = repositoryVersions.filter(
      (version) => facts[`v${version}`] === true
    );
    const missing = repositoryVersions.filter(
      (version) => facts[`v${version}`] !== true
    );
    const highestKnown = repositoryVersions.at(-1) ?? null;
    let highestSequential = null;
    for (const version of repositoryVersions) {
      if (facts[`v${version}`] !== true) break;
      highestSequential = version;
    }

    console.log(
      JSON.stringify(
        {
          mode: "read-only-structural-audit",
          highestRepositoryMigration: highestKnown,
          highestSequentiallyConfirmedMigration: highestSequential,
          confirmedVersions: confirmed,
          missingVersions: missing,
          note:
            "Historical versions are inferred from schema fingerprints; this is not an execution ledger.",
        },
        null,
        2
      )
    );

    if (missing.length > 0) process.exitCode = 2;
  } catch {
    console.error("Schema audit failed. Database details were intentionally suppressed.");
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 2 });
  }
}
