import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

process.env.DATABASE_URL ||= "postgresql://local-test.invalid/neondb";

const {
  CANONICAL_LEAD_SOURCE_LABELS,
  buildCanonicalLeadListQuery,
  buildCanonicalLeadPropertiesQuery,
  buildCanonicalLeadSummaryQuery,
  canonicalLeadDirectoryHref,
  normalizeCanonicalLeadFilters,
} = await import("../lib/admin/queries/canonical-leads.ts");

const root = new URL("..", import.meta.url);
const pageSource = await readFile(new URL("app/admin/leads/page.tsx", root), "utf8");
const middlewareSource = await readFile(new URL("lib/admin/middleware.ts", root), "utf8");
const querySource = await readFile(new URL("lib/admin/queries/canonical-leads.ts", root), "utf8");
const readMigration = (name) => readFile(new URL(`db/migrations/${name}`, root), "utf8");

const [leadsSql, typedSql, openHouseSql, hardeningSql, prioritySql] = await Promise.all([
  readMigration("0001_create_leads.sql"),
  readMigration("0002_create_typed_lead_tables.sql"),
  readMigration("0004_extend_consultas_propiedad_for_open_house_v2.sql"),
  readMigration("0005_harden_consultas_propiedad.sql"),
  readMigration("0006_link_priority_registrations_to_leads.sql"),
]);

let db;
let propertyOne;
let propertyTwo;
let leadAna;
let leadSeller;
let leadBuyer;
let leadOpenHouse;

function filters(overrides = {}) {
  return {
    search: "",
    source: "all",
    range: "all",
    propertyId: null,
    sort: "recent",
    page: 1,
    ...overrides,
  };
}

async function runList(overrides = {}, pageSize = 25) {
  const query = buildCanonicalLeadListQuery(filters(overrides), pageSize);
  const result = await db.query(query.text, query.values);
  return result.rows;
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
      property_id uuid NOT NULL REFERENCES public.propiedades(id) ON DELETE CASCADE,
      property_title text NOT NULL,
      property_slug text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.consultas_propiedad (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      propiedad_id uuid NULL,
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
      created_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
      carta_precalificacion_key text NULL,
      CONSTRAINT consultas_propiedad_propiedad_id_fkey
        FOREIGN KEY (propiedad_id) REFERENCES public.propiedades(id) ON DELETE CASCADE
    );
  `);
  await db.exec(typedSql);
  await db.exec(openHouseSql);
  await db.exec(hardeningSql);
  await db.exec(prioritySql);

  const properties = await db.query(`
    INSERT INTO public.propiedades (titulo, slug, municipio) VALUES
      ('Casa Uno', 'casa-uno', 'Ponce'),
      ('Casa Dos', 'casa-dos', 'Caguas')
    RETURNING id::text, slug
  `);
  propertyOne = properties.rows.find((row) => row.slug === "casa-uno").id;
  propertyTwo = properties.rows.find((row) => row.slug === "casa-dos").id;

  const leads = await db.query(`
    INSERT INTO public.leads (
      name, email_original, email_normalized, phone_original, phone_normalized,
      created_at, last_activity_at
    ) VALUES
      ('Ana Alpha', 'Ana@Example.invalid', 'ana@example.invalid', '(787) 555-0101', '+17875550101', now() - interval '1 hour', now() - interval '5 minutes'),
      ('Bruno Seller', 'bruno@example.invalid', 'bruno@example.invalid', '787-555-0102', '+17875550102', now() - interval '10 days', now() - interval '10 days'),
      ('Carla Buyer', 'carla@example.invalid', 'carla@example.invalid', '787-555-0103', '+17875550103', now() - interval '2 days', now() - interval '2 days'),
      ('Diego Open', NULL, NULL, '787-555-0104', '+17875550104', now() - interval '40 days', now() - interval '40 days')
    RETURNING id::text, name
  `);
  leadAna = leads.rows.find((row) => row.name === "Ana Alpha").id;
  leadSeller = leads.rows.find((row) => row.name === "Bruno Seller").id;
  leadBuyer = leads.rows.find((row) => row.name === "Carla Buyer").id;
  leadOpenHouse = leads.rows.find((row) => row.name === "Diego Open").id;

  await db.query(
    `INSERT INTO public.property_priority_registrations
      (property_id, property_title, property_slug, lead_id, created_at)
     VALUES ($1::uuid, 'Casa Uno', 'casa-uno', $2::uuid, now() - interval '30 minutes')`,
    [propertyOne, leadAna]
  );
  await db.query(
    `INSERT INTO public.property_buyer_profiles (
      lead_id, property_id, name_snapshot, phone_snapshot, purchase_method,
      document_status, idempotency_key, source_path, created_at
    ) VALUES ($1::uuid, $2::uuid, 'Ana Alpha', '787-555-0101', 'Cash',
      'none', $3::uuid, '/listados/casa-uno/perfil-comprador', now() - interval '10 minutes')`,
    [leadAna, propertyOne, randomUUID()]
  );
  await db.query(
    `INSERT INTO public.seller_landlord_inquiries (
      lead_id, name_snapshot, email_snapshot, phone_snapshot, location,
      idempotency_key, source_path, created_at
    ) VALUES ($1::uuid, 'Bruno Seller', 'bruno@example.invalid', '787-555-0102',
      'Mayagüez', $2::uuid, '/contact/vendedor-arrendador', now() - interval '10 days')`,
    [leadSeller, randomUUID()]
  );
  await db.query(
    `INSERT INTO public.buyer_tenant_inquiries (
      lead_id, name_snapshot, phone_snapshot, primary_interest, municipalities,
      idempotency_key, source_path, created_at
    ) VALUES ($1::uuid, 'Carla Buyer', '787-555-0103', 'Comprar', 'Caguas',
      $2::uuid, '/contact/compradores-arrendatarios', now() - interval '2 days')`,
    [leadBuyer, randomUUID()]
  );
  await db.query(
    `INSERT INTO public.consultas_propiedad (
      propiedad_id, lead_id, idempotency_key, source_path, showing_at,
      showing_event_key, nombre, telefono, carta_precalificacion_status,
      evidencia_fondos_status, created_at
    ) VALUES ($1::uuid, $2::uuid, $3::uuid, '/listados/casa-dos/registro-openhouse',
      now() + interval '3 days', 'open-house:test', 'Diego Open', '787-555-0104',
      'none', 'none', now() - interval '40 days')`,
    [propertyTwo, leadOpenHouse, randomUUID()]
  );
});

after(async () => {
  await db.close();
});

test("canonical list returns one row per canonical lead", async () => {
  const rows = await runList();
  assert.equal(rows.length, 4);
  assert.equal(new Set(rows.map((row) => row.id)).size, 4);
});

test("multiple linked source records do not duplicate a person", async () => {
  const rows = await runList({ search: "Ana Alpha" });
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].source_count), 2);
  assert.deepEqual(rows[0].source_types.sort(), ["priority_registration", "property_buyer_profile"]);
});

test("source badges use the reviewed Spanish labels", () => {
  assert.equal(CANONICAL_LEAD_SOURCE_LABELS.property_buyer_profile, "Perfil comprador de propiedad");
  assert.equal(CANONICAL_LEAD_SOURCE_LABELS.open_house_registration, "Registro Open House");
});

test("Priority Registration is labeled correctly", () => {
  assert.equal(CANONICAL_LEAD_SOURCE_LABELS.priority_registration, "Registro prioritario");
  assert.doesNotMatch(CANONICAL_LEAD_SOURCE_LABELS.priority_registration, /perfil comprador/i);
});

test("search by name is server-side", async () => {
  const rows = await runList({ search: "Bruno" });
  assert.deepEqual(rows.map((row) => row.id), [leadSeller]);
});

test("search by email is server-side", async () => {
  const rows = await runList({ search: "carla@example.invalid" });
  assert.deepEqual(rows.map((row) => row.id), [leadBuyer]);
});

test("search by phone includes normalized and original values", async () => {
  const rows = await runList({ search: "+17875550104" });
  assert.deepEqual(rows.map((row) => row.id), [leadOpenHouse]);
});

test("source filter returns canonical identities for that source", async () => {
  const rows = await runList({ source: "open_house_registration" });
  assert.deepEqual(rows.map((row) => row.id), [leadOpenHouse]);
});

test("date-range filter applies to canonical lead creation date", async () => {
  const today = await runList({ range: "today" });
  const sevenDays = await runList({ range: "7d" });
  assert.deepEqual(today.map((row) => row.id), [leadAna]);
  assert.deepEqual(new Set(sevenDays.map((row) => row.id)), new Set([leadAna, leadBuyer]));
});

test("property filter follows linked source records", async () => {
  const rows = await runList({ propertyId: propertyTwo });
  assert.deepEqual(rows.map((row) => row.id), [leadOpenHouse]);
});

test("sorting supports recent, oldest, and name directions", async () => {
  assert.deepEqual((await runList({ sort: "oldest" })).map((row) => row.name), ["Diego Open", "Bruno Seller", "Carla Buyer", "Ana Alpha"]);
  assert.deepEqual((await runList({ sort: "name_asc" })).map((row) => row.name), ["Ana Alpha", "Bruno Seller", "Carla Buyer", "Diego Open"]);
  assert.deepEqual((await runList({ sort: "name_desc" })).map((row) => row.name), ["Diego Open", "Carla Buyer", "Bruno Seller", "Ana Alpha"]);
});

test("pagination uses a 25-row default and deterministic offset", () => {
  const query = buildCanonicalLeadListQuery(filters({ page: 3 }));
  assert.deepEqual(query.values.slice(-2), [25, 50]);
  assert.match(query.text, /LIMIT \$1 OFFSET \$2$/);
});

test("URL generation preserves active filters and sort across pagination", () => {
  const href = canonicalLeadDirectoryHref(filters({ search: "Ana", source: "priority_registration", range: "7d", propertyId: propertyOne, sort: "name_asc" }), { page: 2 });
  const url = new URL(href, "https://example.invalid");
  assert.deepEqual(Object.fromEntries(url.searchParams), { q: "Ana", source: "priority_registration", range: "7d", property: propertyOne, sort: "name_asc", page: "2" });
});

test("summary cards count canonical identities rather than source rows", async () => {
  const query = buildCanonicalLeadSummaryQuery();
  const result = await db.query(query.text, query.values);
  const summary = result.rows[0];
  assert.equal(Number(summary.total), 4);
  assert.equal(Number(summary.new_today), 1);
  assert.equal(Number(summary.new_last_7_days), 2);
  assert.equal(Number(summary.with_priority_registration), 1);
  assert.equal(Number(summary.with_multiple_interactions), 1);
});

test("property options include only properties linked through canonical sources", async () => {
  const query = buildCanonicalLeadPropertiesQuery();
  const result = await db.query(query.text, query.values);
  assert.deepEqual(result.rows.map((row) => row.slug), ["casa-dos", "casa-uno"]);
});

test("empty results and no-leads states are explicit Spanish UI states", async () => {
  assert.equal((await runList({ search: "does-not-exist" })).length, 0);
  assert.match(pageSource, /No hay leads todavía/);
  assert.match(pageSource, /No hay resultados/);
  assert.match(pageSource, /Ajusta o limpia los filtros/);
  assert.match(pageSource, /No se pudo cargar el directorio/);
});

test("admin lead directory adds no PII analytics or logging", () => {
  assert.doesNotMatch(pageSource + querySource, /gtag\(|track\(|console\.(?:log|error|warn)/);
  assert.doesNotMatch(pageSource, /@vercel\/analytics|clarity|google-analytics/i);
});

test("admin protection remains active and every row links to Lead 360", () => {
  assert.match(pageSource, /getAdminSessionUser/);
  assert.match(pageSource, /redirect\("\/admin\/login"\)/);
  assert.match(middlewareSource, /pathname\.startsWith\("\/admin"\)/);
  assert.match(pageSource, /item\.entityType === "group"/);
  assert.match(pageSource, /`\/admin\/leads\/\$\{item\.id\}`/);
  assert.match(pageSource, /`\/admin\/leads\/casos\/\$\{item\.id\}`/);
  assert.match(pageSource, /Ver detalles/);
  assert.doesNotMatch(pageSource, /disponible próximamente/);
});

test("query parameters are allowlisted and invalid page values normalize safely", () => {
  const normalized = normalizeCanonicalLeadFilters({ source: "unknown", range: "forever", sort: "random", page: "-9" });
  assert.deepEqual(normalized, { search: "", source: "all", range: "all", propertyId: null, sort: "recent", page: 1 });
});

test("production-equivalent smoke fixture returns 83 unique Priority Registration leads", async () => {
  await db.exec("BEGIN");
  try {
    await db.exec(`
      DELETE FROM public.property_buyer_profiles;
      DELETE FROM public.seller_landlord_inquiries;
      DELETE FROM public.buyer_tenant_inquiries;
      DELETE FROM public.consultas_propiedad;
      DELETE FROM public.property_priority_registrations;
      DELETE FROM public.leads;
    `);
    await db.query(
      `INSERT INTO public.leads (
        name, email_original, email_normalized, phone_original, phone_normalized
      )
      SELECT
        'Historical lead ' || value,
        'historical-' || value || '@example.invalid',
        'historical-' || value || '@example.invalid',
        '+1787555' || lpad(value::text, 4, '0'),
        '+1787555' || lpad(value::text, 4, '0')
      FROM generate_series(1, 83) AS value`
    );
    await db.query(
      `INSERT INTO public.property_priority_registrations (
        property_id, property_title, property_slug, lead_id
      )
      SELECT $1::uuid, 'Casa Uno', 'casa-uno', id
      FROM public.leads`,
      [propertyOne]
    );

    const rows = await runList({ source: "priority_registration" }, 100);
    assert.equal(rows.length, 83);
    assert.equal(new Set(rows.map((row) => row.id)).size, 83);
    assert.ok(rows.every((row) => Number(row.source_count) === 1));
    assert.ok(rows.every((row) => row.primary_source === "priority_registration"));
  } finally {
    await db.exec("ROLLBACK");
  }
});
