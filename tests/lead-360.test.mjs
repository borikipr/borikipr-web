import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

process.env.DATABASE_URL ||= "postgresql://local-test.invalid/neondb";

const {
  buildLead360EmailSummaryQuery,
  buildLead360IdentityQuery,
  buildLead360InteractionsQuery,
  buildLead360ManagementEventsQuery,
  buildLead360NotesQuery,
  buildLead360RelationshipsQuery,
  buildLead360SharedContactsQuery,
} = await import("../lib/admin/queries/lead-360.ts");

const root = new URL("..", import.meta.url);
const readMigration = (name) => readFile(new URL(`db/migrations/${name}`, root), "utf8");
const [leadsSql, typedSql, prioritySql, lead360Sql, lead360RollbackSql, pageSource, actionsSource, directorySource] = await Promise.all([
  readMigration("0001_create_leads.sql"),
  readMigration("0002_create_typed_lead_tables.sql"),
  readMigration("0006_link_priority_registrations_to_leads.sql"),
  readMigration("0007_create_lead_360.sql"),
  readMigration("0007_create_lead_360.rollback.sql"),
  readFile(new URL("app/admin/leads/[id]/page.tsx", root), "utf8"),
  readFile(new URL("app/admin/leads/[id]/actions.ts", root), "utf8"),
  readFile(new URL("app/admin/leads/page.tsx", root), "utf8"),
]);

let db;
let primaryLeadId;
let sharedLeadId;
let propertyId;

async function run(query) {
  return (await db.query(query.text, query.values)).rows;
}

before(async () => {
  db = new PGlite();
  await db.exec(leadsSql);
  await db.exec(`
    CREATE TABLE public.propiedades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo text NOT NULL,
      slug text NOT NULL UNIQUE,
      municipio text NULL
    );
    CREATE TABLE public.property_priority_registrations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id uuid NOT NULL REFERENCES public.propiedades(id) ON DELETE RESTRICT,
      property_slug text NOT NULL,
      property_title text NOT NULL,
      name text NOT NULL,
      phone text NOT NULL,
      email text NOT NULL,
      purchase_type text NOT NULL,
      prequalified_status text NULL,
      search_range text NOT NULL,
      wants_visit boolean NOT NULL,
      source text NOT NULL DEFAULT 'registro_prioritario',
      notified_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      confirmation_sent_at timestamptz NULL,
      property_size text NULL,
      additional_info text NULL,
      purchase_other text NULL
    );
    CREATE TABLE public.consultas_propiedad (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      propiedad_id uuid NOT NULL REFERENCES public.propiedades(id) ON DELETE RESTRICT,
      lead_id uuid NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
      nombre text NOT NULL,
      telefono text NOT NULL,
      email text NULL,
      metodo_compra text NULL,
      carta_precalificacion_url text NULL,
      evidencia_fondos text NULL,
      fondos_gastos_cierre text NULL,
      trabajando_con_corredor text NULL,
      nombre_corredor text NULL,
      telefono_corredor text NULL,
      disponibilidad_visita text NULL,
      respuestas_personalizadas jsonb NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      carta_precalificacion_key text NULL,
      idempotency_key uuid NULL,
      source_path text NULL,
      showing_at timestamptz NULL,
      showing_event_key text NULL,
      evidencia_fondos_key text NULL,
      carta_precalificacion_status text NULL,
      evidencia_fondos_status text NULL
    );
    CREATE TABLE public.email_queue (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      canonical_lead_id uuid NULL REFERENCES public.leads(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'pending',
      sent_at timestamptz NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.exec(typedSql);
  await db.exec(prioritySql);
  await db.exec(lead360Sql);

  const property = await db.query(`
    INSERT INTO public.propiedades (titulo, slug, municipio)
    VALUES ('Propiedad sintética', 'propiedad-sintetica', 'Ponce')
    RETURNING id::text
  `);
  propertyId = property.rows[0].id;

  const leads = await db.query(`
    INSERT INTO public.leads (
      name, email_original, email_normalized, phone_original, phone_normalized,
      created_at, last_activity_at
    ) VALUES
      ('Persona Sintética Uno', 'shared@example.invalid', 'shared@example.invalid',
       '787-555-0100', '+17875550100', now() - interval '2 days', now()),
      ('Persona Sintética Dos', 'shared@example.invalid', 'shared@example.invalid',
       '787-555-0100', '+17875550100', now() - interval '1 day', now())
    RETURNING id::text, name
  `);
  primaryLeadId = leads.rows.find((row) => row.name.endsWith("Uno")).id;
  sharedLeadId = leads.rows.find((row) => row.name.endsWith("Dos")).id;

  await db.query(`
    INSERT INTO public.property_priority_registrations (
      property_id, property_slug, property_title, name, phone, email,
      purchase_type, search_range, wants_visit, lead_id
    ) VALUES ($1::uuid, 'propiedad-sintetica', 'Propiedad sintética',
      'Persona Sintética Uno', '787-555-0100', 'shared@example.invalid',
      'Cash', 'Ponce', true, $2::uuid)
  `, [propertyId, primaryLeadId]);
  await db.query(`
    INSERT INTO public.property_buyer_profiles (
      lead_id, property_id, name_snapshot, phone_snapshot, purchase_method,
      financial_institution, document_status, idempotency_key, source_path
    ) VALUES ($1::uuid, $2::uuid, 'Persona Sintética Uno', '787-555-0100',
      'Financiamiento', 'Banco Sintético', 'none', $3::uuid,
      '/listados/propiedad-sintetica/perfil-comprador')
  `, [primaryLeadId, propertyId, randomUUID()]);
  await db.query(`
    INSERT INTO public.buyer_tenant_inquiries (
      lead_id, name_snapshot, phone_snapshot, primary_interest, municipalities,
      idempotency_key, source_path
    ) VALUES ($1::uuid, 'Persona Sintética Uno', '787-555-0100', 'Comprar',
      'Ponce', $2::uuid, '/contact/compradores-arrendatarios')
  `, [primaryLeadId, randomUUID()]);
  await db.query(`
    INSERT INTO public.seller_landlord_inquiries (
      lead_id, name_snapshot, email_snapshot, phone_snapshot, property_type,
      location, primary_reason, idempotency_key, source_path
    ) VALUES ($1::uuid, 'Persona Sintética Uno', 'shared@example.invalid',
      '787-555-0100', 'Casa', 'Ponce', 'Vender', $2::uuid,
      '/contact/vendedor-arrendador')
  `, [primaryLeadId, randomUUID()]);
  await db.query(`
    INSERT INTO public.consultas_propiedad (
      propiedad_id, lead_id, nombre, telefono, metodo_compra, showing_at,
      showing_event_key, carta_precalificacion_status, evidencia_fondos_status
    ) VALUES ($1::uuid, $2::uuid, 'Persona Sintética Uno', '787-555-0100',
      'Cash', now() + interval '3 days', 'synthetic-open-house', 'none', 'none')
  `, [propertyId, primaryLeadId]);
  await db.query(`
    INSERT INTO public.email_queue (canonical_lead_id, status, sent_at)
    VALUES ($1::uuid, 'sent', now())
  `, [primaryLeadId]);
});

after(async () => {
  await db.close();
});

test("Lead 360 migration creates the smallest CRM tables and supporting indexes", async () => {
  const tables = await db.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'lead_%'
    ORDER BY table_name
  `);
  assert.deepEqual(tables.rows.map((row) => row.table_name), [
    "lead_duplicate_reviews",
    "lead_management_events",
    "lead_notes",
    "lead_relationships",
    "leads",
  ]);
  const followUp = await db.query(`
    SELECT data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads'
      AND column_name = 'next_follow_up_at'
  `);
  assert.deepEqual(followUp.rows, [{ data_type: "timestamp with time zone", is_nullable: "YES" }]);
});

test("one Lead 360 query returns all five persisted source types", async () => {
  const rows = await run(buildLead360InteractionsQuery(primaryLeadId));
  assert.deepEqual(new Set(rows.map((row) => row.source_type)), new Set([
    "priority_registration",
    "property_buyer_profile",
    "buyer_tenant_inquiry",
    "seller_landlord_inquiry",
    "open_house_registration",
  ]));
  assert.ok(rows.every((row) => row.details && typeof row.details === "object"));
});

test("shared email and phone detect a review candidate without collapsing identities", async () => {
  const identity = await run(buildLead360IdentityQuery(primaryLeadId));
  const shared = await run(buildLead360SharedContactsQuery(primaryLeadId));
  assert.equal(identity.length, 1);
  assert.equal(shared.length, 1);
  assert.equal(shared[0].id, sharedLeadId);
  assert.equal(shared[0].email_match, true);
  assert.equal(shared[0].phone_match, true);
  assert.equal(shared[0].review_decision, null);
  const count = await db.query("SELECT count(*)::int AS count FROM public.leads");
  assert.equal(count.rows[0].count, 2);
});

test("keep-separate review is symmetric and preserves both canonical leads", async () => {
  await db.query(`
    INSERT INTO public.lead_duplicate_reviews (
      lead_id, compared_lead_id, decision, decided_by
    ) VALUES ($1::uuid, $2::uuid, 'keep_separate', 'synthetic-admin')
  `, [primaryLeadId, sharedLeadId]);
  const shared = await run(buildLead360SharedContactsQuery(sharedLeadId));
  assert.equal(shared[0].review_decision, "keep_separate");
  assert.equal((await db.query("SELECT count(*)::int AS count FROM public.leads")).rows[0].count, 2);
});

test("relationship pair uniqueness prevents inverse duplicates", async () => {
  await db.query(`
    INSERT INTO public.lead_relationships (
      lead_id, related_lead_id, relationship_type, created_by
    ) VALUES ($1::uuid, $2::uuid, 'family', 'synthetic-admin')
  `, [primaryLeadId, sharedLeadId]);
  await assert.rejects(db.query(`
    INSERT INTO public.lead_relationships (
      lead_id, related_lead_id, relationship_type, created_by
    ) VALUES ($1::uuid, $2::uuid, 'co_buyer', 'synthetic-admin')
  `, [sharedLeadId, primaryLeadId]));
  await db.query(`
    INSERT INTO public.lead_relationships (
      lead_id, related_lead_id, relationship_type, created_by
    ) VALUES ($1::uuid, $2::uuid, 'co_buyer', 'synthetic-admin')
    ON CONFLICT (
      LEAST(lead_id, related_lead_id),
      GREATEST(lead_id, related_lead_id)
    ) DO UPDATE SET
      relationship_type = EXCLUDED.relationship_type,
      updated_at = now()
  `, [sharedLeadId, primaryLeadId]);
  const relationships = await run(buildLead360RelationshipsQuery(sharedLeadId));
  assert.equal(relationships.length, 1);
  assert.equal(relationships[0].related_lead_id, primaryLeadId);
  assert.equal(relationships[0].relationship_type, "co_buyer");
});

test("notes, management timeline, and email queue status are independently queryable", async () => {
  const operationKey = randomUUID();
  await db.query(`
    INSERT INTO public.lead_notes (lead_id, body, author_username, idempotency_key)
    VALUES ($1::uuid, 'Nota sintética', 'synthetic-admin', $2::uuid)
  `, [primaryLeadId, randomUUID()]);
  await db.query(`
    INSERT INTO public.lead_management_events (
      lead_id, event_type, event_data, actor_username, idempotency_key
    ) VALUES ($1::uuid, 'status_changed', '{"previousStatus":"new","newStatus":"active"}',
      'synthetic-admin', $2::uuid)
  `, [primaryLeadId, operationKey]);
  assert.equal((await run(buildLead360NotesQuery(primaryLeadId))).length, 1);
  assert.equal((await run(buildLead360ManagementEventsQuery(primaryLeadId))).length, 1);
  const email = await run(buildLead360EmailSummaryQuery(primaryLeadId));
  assert.deepEqual(email.map((row) => [row.status, row.count]), [["sent", 1]]);
});

test("admin UI enables details, requires auth, and routes duplicate review safely", () => {
  assert.match(directorySource, /`\/admin\/leads\/\$\{item\.id\}`/);
  assert.match(directorySource, /`\/admin\/leads\/casos\/\$\{item\.id\}`/);
  assert.match(pageSource, /if \(!username\) redirect\("\/admin\/login"\)/);
  assert.match(pageSource, /Contacto compartido con otra persona/);
  assert.match(pageSource, /Mantener separadas/);
  assert.match(pageSource, /Confirmar que es la misma persona/);
  assert.match(pageSource, /\/fusionar\/\$\{contact\.id\}/);
  assert.match(actionsSource, /await sql\.begin/);
  assert.doesNotMatch(actionsSource, /console\.(log|error)/);
});

test("Lead 360 uses responsive grids and does not introduce fixed-width containers", () => {
  assert.match(pageSource, /xl:grid-cols-\[minmax\(0,1\.5fr\)_minmax\(320px,0\.75fr\)\]/);
  assert.match(pageSource, /min-w-0/);
  assert.doesNotMatch(pageSource, /w-\[[4-9][0-9]{2}px\]/);
});

test("rollback refuses to discard populated Lead 360 data", async () => {
  await assert.rejects(db.exec(lead360RollbackSql), /requires all Lead 360 data to be empty/);
  await db.exec("ROLLBACK");
  assert.equal((await db.query("SELECT count(*)::int AS count FROM public.leads")).rows[0].count, 2);
});
