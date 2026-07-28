import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

process.env.DATABASE_URL ||= "postgresql://local-test.invalid/neondb";

const {
  buildCanonicalLeadPropertyResolutionQuery,
} = await import("../lib/admin/queries/canonical-leads.ts");
const {
  buildOperationalPropertyCountsQuery,
  buildUnifiedLeadDirectoryQuery,
} = await import("../lib/admin/queries/unified-lead-directory.ts");

const root = new URL("..", import.meta.url);
const readRepo = (path) => readFile(new URL(path, root), "utf8");
const [
  leadsSql,
  typedSql,
  openHouseSql,
  hardeningSql,
  prioritySql,
  lead360Sql,
  groupsSql,
  groupEventsSql,
  propertiesPageSource,
  leadsPageSource,
  adminQueriesSource,
] = await Promise.all([
  readRepo("db/migrations/0001_create_leads.sql"),
  readRepo("db/migrations/0002_create_typed_lead_tables.sql"),
  readRepo("db/migrations/0004_extend_consultas_propiedad_for_open_house_v2.sql"),
  readRepo("db/migrations/0005_harden_consultas_propiedad.sql"),
  readRepo("db/migrations/0006_link_priority_registrations_to_leads.sql"),
  readRepo("db/migrations/0007_create_lead_360.sql"),
  readRepo("db/migrations/0011_create_lead_groups.sql"),
  readRepo("db/migrations/0012_extend_lead_group_events.sql"),
  readRepo("app/admin/propiedades/page.tsx"),
  readRepo("app/admin/leads/page.tsx"),
  readRepo("lib/admin/queries.ts"),
]);

let db;
let propertyOne;
let propertyTwo;
let propertyRawOnly;
let groupedLeadOne;
let groupedLeadTwo;
let multiSourceLead;
let multiPropertyLead;
let propertyOneGroup;

function filters(overrides = {}) {
  return {
    search: "",
    status: "all",
    source: "all",
    range: "all",
    propertyId: null,
    sort: "recent",
    page: 1,
    showIndividuals: false,
    ...overrides,
  };
}

async function runDirectory(overrides = {}) {
  const query = buildUnifiedLeadDirectoryQuery(filters(overrides));
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
    CREATE TABLE public.lead_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      propiedad_slug text NULL,
      tipo_evento text NULL,
      ruta_origen text NULL,
      created_at timestamp without time zone NOT NULL DEFAULT now()
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
      reused_property_buyer_profile_id uuid NULL,
      workflow_source text NOT NULL DEFAULT 'open_house',
      CONSTRAINT consultas_propiedad_propiedad_id_fkey
        FOREIGN KEY (propiedad_id) REFERENCES public.propiedades(id) ON DELETE CASCADE
    );
  `);
  await db.exec(typedSql);
  await db.exec(openHouseSql);
  await db.exec(hardeningSql);
  await db.exec(`
    ALTER TABLE public.consultas_propiedad
      DROP CONSTRAINT consultas_propiedad_source_path_check,
      ADD CONSTRAINT consultas_propiedad_source_path_check CHECK (
        source_path IS NULL OR (
          char_length(source_path) BETWEEN 1 AND 500
          AND source_path ~ '^/listados/[a-z0-9-]+/(registro-openhouse|visita)$'
        )
      );
  `);
  await db.exec(prioritySql);
  await db.exec(lead360Sql);
  await db.exec(groupsSql);
  await db.exec(groupEventsSql);

  const properties = await db.query(`
    INSERT INTO public.propiedades (titulo, slug, municipio) VALUES
      ('Casa Uno', 'casa-uno', 'Ponce'),
      ('Casa Dos', 'casa-dos', 'Caguas'),
      ('Casa con actividad anónima', 'casa-actividad', 'Arecibo')
    RETURNING id::text, slug
  `);
  propertyOne = properties.rows.find((row) => row.slug === "casa-uno").id;
  propertyTwo = properties.rows.find((row) => row.slug === "casa-dos").id;
  propertyRawOnly = properties.rows.find(
    (row) => row.slug === "casa-actividad"
  ).id;

  const leads = await db.query(`
    INSERT INTO public.leads (
      name, email_original, email_normalized, phone_original, phone_normalized,
      created_at, last_activity_at
    ) VALUES
      ('Miembro Uno', 'one@example.invalid', 'one@example.invalid', '787-555-0101', '+17875550101', now() - interval '5 days', now() - interval '2 days'),
      ('Miembro Dos', 'two@example.invalid', 'two@example.invalid', '787-555-0102', '+17875550102', now() - interval '4 days', now() - interval '1 day'),
      ('Persona Multifuente', 'multi@example.invalid', 'multi@example.invalid', '787-555-0103', '+17875550103', now() - interval '3 days', now() - interval '3 hours'),
      ('Persona Multipropiedad', 'properties@example.invalid', 'properties@example.invalid', '787-555-0104', '+17875550104', now() - interval '2 days', now() - interval '1 hour'),
      ('Persona Sin Propiedad', 'none@example.invalid', 'none@example.invalid', '787-555-0105', '+17875550105', now(), now())
    RETURNING id::text, name
  `);
  groupedLeadOne = leads.rows.find((row) => row.name === "Miembro Uno").id;
  groupedLeadTwo = leads.rows.find((row) => row.name === "Miembro Dos").id;
  multiSourceLead = leads.rows.find(
    (row) => row.name === "Persona Multifuente"
  ).id;
  multiPropertyLead = leads.rows.find(
    (row) => row.name === "Persona Multipropiedad"
  ).id;

  const registration = async (leadId, propertyId, title, slug, createdAt) => {
    await db.query(
      `INSERT INTO public.property_priority_registrations
        (property_id, property_title, property_slug, lead_id, created_at)
       VALUES ($1::uuid, $2, $3, $4::uuid, $5::timestamptz)`,
      [propertyId, title, slug, leadId, createdAt]
    );
  };
  await registration(
    groupedLeadOne,
    propertyOne,
    "Casa Uno",
    "casa-uno",
    "2026-01-01T12:00:00Z"
  );
  await registration(
    groupedLeadTwo,
    propertyOne,
    "Casa Uno",
    "casa-uno",
    "2026-01-02T12:00:00Z"
  );
  await registration(
    multiSourceLead,
    propertyOne,
    "Casa Uno",
    "casa-uno",
    "2026-01-03T12:00:00Z"
  );
  await registration(
    multiPropertyLead,
    propertyOne,
    "Casa Uno",
    "casa-uno",
    "2026-01-01T12:00:00Z"
  );

  await db.query(
    `INSERT INTO public.property_buyer_profiles (
      lead_id, property_id, name_snapshot, phone_snapshot, purchase_method,
      document_status, idempotency_key, source_path, created_at
    ) VALUES
      ($1::uuid, $2::uuid, 'Persona Multifuente', '787-555-0103', 'Cash',
       'none', $3::uuid, '/listados/casa-uno/perfil-comprador', '2026-01-04T12:00:00Z'),
      ($4::uuid, $5::uuid, 'Persona Multipropiedad', '787-555-0104', 'Cash',
       'none', $6::uuid, '/listados/casa-dos/perfil-comprador', '2026-02-01T12:00:00Z')`,
    [
      multiSourceLead,
      propertyOne,
      randomUUID(),
      multiPropertyLead,
      propertyTwo,
      randomUUID(),
    ]
  );
  for (const workflow of ["open_house", "private_showing"]) {
    await db.query(
      `INSERT INTO public.consultas_propiedad (
        propiedad_id, lead_id, idempotency_key, source_path, nombre, telefono,
        carta_precalificacion_status, evidencia_fondos_status,
        workflow_source, created_at
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4, 'Persona Multifuente',
        '787-555-0103', 'none', 'none', $5, now()
      )`,
      [
        propertyOne,
        multiSourceLead,
        randomUUID(),
        workflow === "open_house"
          ? "/listados/casa-uno/registro-openhouse"
          : "/listados/casa-uno/visita",
        workflow,
      ]
    );
  }

  const group = await db.query(
    `INSERT INTO public.lead_groups (
      title, status, primary_property_id, created_by
    ) VALUES ('Caso Casa Uno', 'active', $1::uuid, 'synthetic-admin')
    RETURNING id::text`,
    [propertyOne]
  );
  propertyOneGroup = group.rows[0].id;
  await db.query(
    `INSERT INTO public.lead_group_members (
      group_id, lead_id, role, is_primary_contact, created_by
    ) VALUES
      ($1::uuid, $2::uuid, 'buyer', true, 'synthetic-admin'),
      ($1::uuid, $3::uuid, 'co_buyer', false, 'synthetic-admin')`,
    [propertyOneGroup, groupedLeadOne, groupedLeadTwo]
  );

  await db.exec(`
    INSERT INTO public.leads (
      name, email_original, email_normalized, phone_original, phone_normalized
    )
    SELECT
      'Persona Paginada ' || value,
      'page-' || value || '@example.invalid',
      'page-' || value || '@example.invalid',
      '+1787556' || lpad(value::text, 4, '0'),
      '+1787556' || lpad(value::text, 4, '0')
    FROM generate_series(1, 30) AS value;

    INSERT INTO public.property_priority_registrations (
      property_id, property_title, property_slug, lead_id
    )
    SELECT
      '${propertyOne}'::uuid,
      'Casa Uno',
      'casa-uno',
      id
    FROM public.leads
    WHERE name LIKE 'Persona Paginada %';

    INSERT INTO public.lead_events (propiedad_slug, tipo_evento)
    SELECT 'casa-uno', CASE WHEN value % 2 = 0 THEN 'contact_click' ELSE 'whatsapp_click' END
    FROM generate_series(1, 5) AS value;

    INSERT INTO public.lead_events (propiedad_slug, tipo_evento)
    VALUES ('casa-actividad', 'whatsapp_click');
  `);
});

after(async () => {
  await db.close();
});

test("property operational count equals the default unified directory total", async () => {
  const countQuery = buildOperationalPropertyCountsQuery();
  const counts = (await db.query(countQuery.text, countQuery.values)).rows;
  const propertyOneCount = counts.find(
    (row) => row.property_id === propertyOne
  );
  const directory = await runDirectory({ propertyId: propertyOne });
  assert.equal(Number(propertyOneCount.contact_count), 33);
  assert.equal(Number(directory[0].filtered_total), 33);
});

test("shared case replaces its members once while individual mode stays explicit", async () => {
  const operational = await runDirectory({
    propertyId: propertyOne,
    showIndividuals: false,
  });
  const individual = await runDirectory({
    propertyId: propertyOne,
    showIndividuals: true,
  });
  const groupResult = await runDirectory({
    propertyId: propertyOne,
    search: "Miembro",
  });
  const memberResults = await runDirectory({
    propertyId: propertyOne,
    search: "Miembro",
    showIndividuals: true,
  });
  assert.equal(Number(operational[0].filtered_total), 33);
  assert.equal(Number(individual[0].filtered_total), 34);
  assert.deepEqual(groupResult.map((row) => row.id), [propertyOneGroup]);
  assert.equal(
    groupResult.some(
      (row) => row.id === groupedLeadOne || row.id === groupedLeadTwo
    ),
    false
  );
  assert.deepEqual(
    new Set(memberResults.map((row) => row.id)),
    new Set([groupedLeadOne, groupedLeadTwo])
  );
});

test("filtering precedes pagination and deterministic pages do not overlap", async () => {
  const first = await runDirectory({ propertyId: propertyOne, page: 1 });
  const second = await runDirectory({ propertyId: propertyOne, page: 2 });
  assert.equal(first.length, 25);
  assert.equal(second.length, 8);
  assert.equal(Number(first[0].filtered_total), 33);
  assert.equal(Number(second[0].filtered_total), 33);
  assert.equal(
    new Set([...first, ...second].map((row) => `${row.entity_type}:${row.id}`))
      .size,
    33
  );
});

test("search and sorting operate inside the selected property without changing total semantics", async () => {
  const search = await runDirectory({
    propertyId: propertyOne,
    search: "Persona Paginada 29",
  });
  const recent = await runDirectory({
    propertyId: propertyOne,
    sort: "recent",
  });
  const oldest = await runDirectory({
    propertyId: propertyOne,
    sort: "oldest",
  });
  assert.equal(Number(search[0].filtered_total), 1);
  assert.equal(Number(recent[0].filtered_total), 33);
  assert.equal(Number(oldest[0].filtered_total), 33);
});

test("a lead related to several properties remains in every qualifying filter", async () => {
  const propertyOneRows = await runDirectory({
    propertyId: propertyOne,
    search: "Persona Multipropiedad",
  });
  const propertyTwoRows = await runDirectory({ propertyId: propertyTwo });
  assert.equal(
    propertyOneRows.some((row) => row.id === multiPropertyLead),
    true
  );
  assert.deepEqual(
    propertyTwoRows.map((row) => row.id),
    [multiPropertyLead]
  );
});

test("multiple forms and repeated events never duplicate a canonical result", async () => {
  const rows = await runDirectory({
    propertyId: propertyOne,
    search: "Persona Multifuente",
  });
  const sourceLead = rows.find((row) => row.id === multiSourceLead);
  assert.ok(sourceLead);
  assert.equal(
    rows.filter((row) => row.id === multiSourceLead).length,
    1
  );
  assert.deepEqual(
    [...sourceLead.source_types].sort(),
    [
      "open_house_registration",
      "priority_registration",
      "private_showing_registration",
      "property_buyer_profile",
    ]
  );
});

test("anonymous activity remains raw analytics and creates no operational contact", async () => {
  const countsQuery = buildOperationalPropertyCountsQuery();
  const counts = (await db.query(countsQuery.text, countsQuery.values)).rows;
  const rawOnly = await runDirectory({ propertyId: propertyRawOnly });
  const rawCount = await db.query(
    `SELECT count(*)::int AS count FROM public.lead_events
     WHERE propiedad_slug = 'casa-actividad'`
  );
  assert.equal(rawCount.rows[0].count, 1);
  assert.equal(
    counts.some((row) => row.property_id === propertyRawOnly),
    false
  );
  assert.equal(rawOnly.length, 0);
});

test("slug and UUID resolve to one canonical property while invalid values do not", async () => {
  for (const value of ["casa-uno", propertyOne]) {
    const query = buildCanonicalLeadPropertyResolutionQuery(value);
    const result = await db.query(query.text, query.values);
    assert.equal(result.rows[0].id, propertyOne);
    assert.equal(result.rows[0].title, "Casa Uno");
    assert.equal(result.rows[0].raw_interaction_count, 5);
  }
  const invalid = buildCanonicalLeadPropertyResolutionQuery("no-existe");
  assert.equal((await db.query(invalid.text, invalid.values)).rows.length, 0);
});

test("property UI separates raw interactions from clickable operational contacts", () => {
  assert.match(propertiesPageSource, /total_interactions/);
  assert.match(propertiesPageSource, /total_contacts/);
  assert.match(propertiesPageSource, /interacción/);
  assert.match(propertiesPageSource, /contacto/);
  assert.match(propertiesPageSource, /item\.id/);
  assert.doesNotMatch(propertiesPageSource, /range=all&event=all/);
  assert.match(adminQueriesSource, /getOperationalPropertyCounts/);
  assert.doesNotMatch(adminQueriesSource, /propiedades\.map[\s\S]*await/);
});

test("filtered Leads UI exposes property context and accurate empty states", () => {
  assert.match(leadsPageSource, /Filtrando por propiedad/);
  assert.match(leadsPageSource, /Quitar filtro/);
  assert.match(
    leadsPageSource,
    /No hay personas o casos asociados con esta propiedad/
  );
  assert.match(
    leadsPageSource,
    /tiene actividad registrada, pero todavía no hay personas/
  );
  assert.match(
    leadsPageSource,
    /La propiedad seleccionada no está disponible para filtrar/
  );
  assert.doesNotMatch(leadsPageSource, /privateToken|private_showing_token/);
});
