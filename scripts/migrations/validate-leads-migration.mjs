import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

async function readMigration(name) {
  return readFile(
    fileURLToPath(new URL(`../../db/migrations/${name}`, import.meta.url)),
    "utf8"
  );
}

const [
  leadsMigrationSql,
  typedTablesMigrationSql,
  typedTablesRollbackSql,
  queueMigrationSql,
  queueRollbackSql,
  openHouseMigrationSql,
  openHouseRollbackSql,
  hardeningMigrationSql,
  hardeningRollbackSql,
  priorityRegistrationMigrationSql,
  priorityRegistrationRollbackSql,
  lead360MigrationSql,
  lead360RollbackSql,
  contactedEventMigrationSql,
  contactedEventRollbackSql,
  documentAccessMigrationSql,
  documentAccessRollbackSql,
  leadMergeMigrationSql,
  leadMergeRollbackSql,
  leadGroupsMigrationSql,
  leadGroupsRollbackSql,
  leadGroupEventsMigrationSql,
  leadGroupEventsRollbackSql,
  adminAuthMigrationSql,
  adminAuthRollbackSql,
  financialDocumentReuseMigrationSql,
  financialDocumentReuseRollbackSql,
  openHouseSolarQuestionMigrationSql,
  openHouseSolarQuestionRollbackSql,
  privateShowingMigrationSql,
  privateShowingRollbackSql,
] =
  await Promise.all([
    readMigration("0001_create_leads.sql"),
    readMigration("0002_create_typed_lead_tables.sql"),
    readMigration("0002_create_typed_lead_tables.rollback.sql"),
    readMigration("0003_extend_email_queue_for_canonical_leads.sql"),
    readMigration("0003_extend_email_queue_for_canonical_leads.rollback.sql"),
    readMigration("0004_extend_consultas_propiedad_for_open_house_v2.sql"),
    readMigration("0004_extend_consultas_propiedad_for_open_house_v2.rollback.sql"),
    readMigration("0005_harden_consultas_propiedad.sql"),
    readMigration("0005_harden_consultas_propiedad.rollback.sql"),
    readMigration("0006_link_priority_registrations_to_leads.sql"),
    readMigration("0006_link_priority_registrations_to_leads.rollback.sql"),
    readMigration("0007_create_lead_360.sql"),
    readMigration("0007_create_lead_360.rollback.sql"),
    readMigration("0008_add_lead_contacted_event.sql"),
    readMigration("0008_add_lead_contacted_event.rollback.sql"),
    readMigration("0009_add_document_accessed_event.sql"),
    readMigration("0009_add_document_accessed_event.rollback.sql"),
    readMigration("0010_add_transactional_lead_merges.sql"),
    readMigration("0010_add_transactional_lead_merges.rollback.sql"),
    readMigration("0011_create_lead_groups.sql"),
    readMigration("0011_create_lead_groups.rollback.sql"),
    readMigration("0012_extend_lead_group_events.sql"),
    readMigration("0012_extend_lead_group_events.rollback.sql"),
    readMigration("0013_extend_admin_authentication.sql"),
    readMigration("0013_extend_admin_authentication.rollback.sql"),
    readMigration("0014_link_open_house_reused_financial_documents.sql"),
    readMigration("0014_link_open_house_reused_financial_documents.rollback.sql"),
    readMigration("0015_separate_open_house_solar_question.sql"),
    readMigration("0015_separate_open_house_solar_question.rollback.sql"),
    readMigration("0016_add_private_showing_registration.sql"),
    readMigration("0016_add_private_showing_registration.rollback.sql"),
  ]);

const typedTables = [
  "buyer_tenant_inquiries",
  "property_buyer_profiles",
  "seller_landlord_inquiries",
];

const expectedColumns = {
  property_buyer_profiles: [
    ["id", "uuid", false, "gen_random_uuid()"],
    ["lead_id", "uuid", false, null],
    ["property_id", "uuid", false, null],
    ["name_snapshot", "text", false, null],
    ["email_snapshot", "text", true, null],
    ["phone_snapshot", "text", false, null],
    ["purchase_method", "text", false, null],
    ["purchase_method_other", "text", true, null],
    ["financial_institution", "text", true, null],
    ["closing_funds", "text", true, null],
    ["solar_contract_acceptance", "text", true, null],
    ["comments", "text", true, null],
    ["document_type", "text", true, null],
    ["document_object_key", "text", true, null],
    ["document_original_name", "text", true, null],
    ["document_content_type", "text", true, null],
    ["document_size_bytes", "bigint", true, null],
    ["document_status", "text", false, "'none'::text"],
    ["idempotency_key", "uuid", false, null],
    ["source_path", "text", false, null],
    ["created_at", "timestamp with time zone", false, "now()"],
  ],
  seller_landlord_inquiries: [
    ["id", "uuid", false, "gen_random_uuid()"],
    ["lead_id", "uuid", false, null],
    ["name_snapshot", "text", false, null],
    ["email_snapshot", "text", false, null],
    ["phone_snapshot", "text", false, null],
    ["property_type", "text", true, null],
    ["location", "text", true, null],
    ["primary_reason", "text", true, null],
    ["comments", "text", true, null],
    ["idempotency_key", "uuid", false, null],
    ["source_path", "text", false, null],
    ["created_at", "timestamp with time zone", false, "now()"],
  ],
  buyer_tenant_inquiries: [
    ["id", "uuid", false, "gen_random_uuid()"],
    ["lead_id", "uuid", false, null],
    ["name_snapshot", "text", false, null],
    ["email_snapshot", "text", true, null],
    ["phone_snapshot", "text", false, null],
    ["primary_interest", "text", true, null],
    ["purchase_qualification", "text", true, null],
    ["budget", "text", true, null],
    ["municipalities", "text", true, null],
    ["property_types", "text[]", true, null],
    ["bedrooms", "text", true, null],
    ["bathrooms", "text", true, null],
    ["comments", "text", true, null],
    ["idempotency_key", "uuid", false, null],
    ["source_path", "text", false, null],
    ["created_at", "timestamp with time zone", false, "now()"],
  ],
};

const expectedChecks = {
  property_buyer_profiles: [
    "property_buyer_profiles_document_size_bytes_check",
    "property_buyer_profiles_document_status_check",
    "property_buyer_profiles_document_type_check",
    "property_buyer_profiles_purchase_method_check",
    "property_buyer_profiles_solar_contract_acceptance_check",
  ],
  seller_landlord_inquiries: [
    "seller_landlord_inquiries_primary_reason_check",
    "seller_landlord_inquiries_property_type_check",
  ],
  buyer_tenant_inquiries: [
    "buyer_tenant_inquiries_bathrooms_check",
    "buyer_tenant_inquiries_bedrooms_check",
    "buyer_tenant_inquiries_primary_interest_check",
    "buyer_tenant_inquiries_property_types_check",
  ],
};

const expectedIndexes = {
  property_buyer_profiles: [
    ["property_buyer_profiles_idempotency_key_uidx", true, "(idempotency_key)"],
    [
      "property_buyer_profiles_lead_created_at_idx",
      false,
      "(lead_id, created_at DESC)",
    ],
    [
      "property_buyer_profiles_property_created_at_idx",
      false,
      "(property_id, created_at DESC)",
    ],
  ],
  seller_landlord_inquiries: [
    ["seller_landlord_inquiries_idempotency_key_uidx", true, "(idempotency_key)"],
    [
      "seller_landlord_inquiries_lead_created_at_idx",
      false,
      "(lead_id, created_at DESC)",
    ],
  ],
  buyer_tenant_inquiries: [
    ["buyer_tenant_inquiries_idempotency_key_uidx", true, "(idempotency_key)"],
    [
      "buyer_tenant_inquiries_lead_created_at_idx",
      false,
      "(lead_id, created_at DESC)",
    ],
  ],
};

async function publicTables(db) {
  const result = await db.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name`
  );
  return result.rows.map((row) => row.table_name);
}

async function baselineCatalog(db) {
  const result = await db.query(
    `SELECT 'column' AS object_type,
            c.table_name AS relation_name,
            concat_ws('|', c.ordinal_position, c.column_name, c.data_type,
                      c.udt_name, c.is_nullable, coalesce(c.column_default, '')) AS definition
       FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name IN ('leads', 'propiedades')
      UNION ALL
     SELECT 'constraint', rel.relname, concat_ws('|', con.conname, con.contype,
                                                  pg_get_constraintdef(con.oid, true))
       FROM pg_constraint con
       JOIN pg_class rel ON rel.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
        AND rel.relname IN ('leads', 'propiedades')
      UNION ALL
     SELECT 'index', tablename, concat_ws('|', indexname, indexdef)
       FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('leads', 'propiedades')
      ORDER BY object_type, relation_name, definition`
  );
  return result.rows;
}

async function relationCatalog(db, tableNames) {
  const result = await db.query(
    `SELECT 'column' AS object_type,
            c.table_name AS relation_name,
            concat_ws('|', c.ordinal_position, c.column_name, c.data_type,
                      c.udt_name, c.is_nullable, coalesce(c.column_default, '')) AS definition
       FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = ANY($1::text[])
      UNION ALL
     SELECT 'constraint', rel.relname, concat_ws('|', con.conname, con.contype,
                                                  pg_get_constraintdef(con.oid, true))
       FROM pg_constraint con
       JOIN pg_class rel ON rel.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
        AND rel.relname = ANY($1::text[])
      UNION ALL
     SELECT 'index', tablename, concat_ws('|', indexname, indexdef)
       FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
      ORDER BY object_type, relation_name, definition`,
    [tableNames]
  );
  return result.rows;
}

async function validateColumns(db, tableName) {
  const result = await db.query(
    `SELECT a.attname AS column_name,
            format_type(a.atttypid, a.atttypmod) AS data_type,
            NOT a.attnotnull AS is_nullable,
            pg_get_expr(ad.adbin, ad.adrelid) AS column_default
       FROM pg_attribute a
       JOIN pg_class rel ON rel.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = rel.relnamespace
       LEFT JOIN pg_attrdef ad
         ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
      WHERE n.nspname = 'public'
        AND rel.relname = $1
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum`,
    [tableName]
  );
  assert.deepEqual(
    result.rows.map((row) => [
      row.column_name,
      row.data_type,
      row.is_nullable,
      row.column_default,
    ]),
    expectedColumns[tableName],
    `Unexpected columns for ${tableName}`
  );
}

async function validateConstraints(db, tableName) {
  const checks = await db.query(
    `SELECT conname
       FROM pg_constraint
      WHERE conrelid = $1::regclass
        AND contype = 'c'
      ORDER BY conname`,
    [`public.${tableName}`]
  );
  assert.deepEqual(
    checks.rows.map((row) => row.conname),
    expectedChecks[tableName]
  );

  const foreignKeys = await db.query(
    `SELECT con.conname,
            target.relname AS target_table,
            con.confdeltype
       FROM pg_constraint con
       JOIN pg_class target ON target.oid = con.confrelid
      WHERE con.conrelid = $1::regclass
        AND con.contype = 'f'
      ORDER BY con.conname`,
    [`public.${tableName}`]
  );
  const expectedTargets =
    tableName === "property_buyer_profiles"
      ? ["leads", "propiedades"]
      : ["leads"];
  assert.deepEqual(
    foreignKeys.rows.map((row) => row.target_table).sort(),
    expectedTargets
  );
  assert.ok(
    foreignKeys.rows.every((row) => row.confdeltype === "r"),
    `${tableName} foreign keys must use ON DELETE RESTRICT`
  );
}

async function validateIndexes(db, tableName) {
  const result = await db.query(
    `SELECT idx.relname AS index_name, i.indisunique AS is_unique,
            pg_get_indexdef(i.indexrelid) AS definition
       FROM pg_index i
       JOIN pg_class rel ON rel.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = rel.relnamespace
       JOIN pg_class idx ON idx.oid = i.indexrelid
      WHERE n.nspname = 'public'
        AND rel.relname = $1
        AND NOT i.indisprimary
      ORDER BY idx.relname`,
    [tableName]
  );
  assert.deepEqual(
    result.rows.map((row) => [row.index_name, row.is_unique]),
    expectedIndexes[tableName].map(([name, unique]) => [name, unique])
  );
  for (const [indexName, , expectedColumns] of expectedIndexes[tableName]) {
    const index = result.rows.find((row) => row.index_name === indexName);
    assert.ok(
      index.definition.includes(expectedColumns),
      `${indexName} must index ${expectedColumns}`
    );
  }
}

const db = new PGlite();

try {
  await db.exec(leadsMigrationSql);
  await db.exec(
    `CREATE TABLE public.propiedades (
       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       validation_marker text NOT NULL DEFAULT 'unchanged'
     );`
  );

  const baselineTables = await publicTables(db);
  const baselineDefinition = await baselineCatalog(db);
  assert.deepEqual(baselineTables, ["leads", "propiedades"]);

  await db.exec(typedTablesMigrationSql);

  assert.deepEqual(await publicTables(db), [
    "buyer_tenant_inquiries",
    "leads",
    "property_buyer_profiles",
    "propiedades",
    "seller_landlord_inquiries",
  ]);
  assert.deepEqual(await baselineCatalog(db), baselineDefinition);

  for (const tableName of typedTables) {
    await validateColumns(db, tableName);
    await validateConstraints(db, tableName);
    await validateIndexes(db, tableName);
  }

  const lead = await db.query(
    `INSERT INTO public.leads (name, email_normalized)
     VALUES ('Local migration validation', 'local-validation@example.invalid')
     RETURNING id::text`
  );
  const property = await db.query(
    `INSERT INTO public.propiedades DEFAULT VALUES RETURNING id::text`
  );
  const leadId = lead.rows[0].id;
  const propertyId = property.rows[0].id;

  await db.query(
    `INSERT INTO public.property_buyer_profiles (
       lead_id, property_id, name_snapshot, phone_snapshot, purchase_method,
       idempotency_key, source_path
     ) VALUES ($1::uuid, $2::uuid, 'Local buyer', '787-555-0100',
               'Financiamiento', gen_random_uuid(), '/local-validation')`,
    [leadId, propertyId]
  );
  await db.query(
    `INSERT INTO public.seller_landlord_inquiries (
       lead_id, name_snapshot, email_snapshot, phone_snapshot,
       idempotency_key, source_path
     ) VALUES ($1::uuid, 'Local seller', 'seller@example.invalid',
               '787-555-0101', gen_random_uuid(), '/local-validation')`,
    [leadId]
  );
  await db.query(
    `INSERT INTO public.buyer_tenant_inquiries (
       lead_id, name_snapshot, phone_snapshot, idempotency_key, source_path
     ) VALUES ($1::uuid, 'Local tenant', '787-555-0102',
               gen_random_uuid(), '/local-validation')`,
    [leadId]
  );

  for (const tableName of typedTables) {
    const count = await db.query(`SELECT count(*)::int AS count FROM public.${tableName}`);
    assert.equal(count.rows[0].count, 1);
  }

  await db.exec(`
    CREATE TABLE public.property_priority_registrations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      confirmation_sent_at timestamptz NULL
    );
    CREATE TABLE public.email_queue (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      recipient text NOT NULL,
      subject text NOT NULL,
      html text NOT NULL,
      email_type text NOT NULL,
      related_property_id uuid NULL REFERENCES public.propiedades(id) ON DELETE SET NULL,
      related_lead_id uuid NULL REFERENCES public.property_priority_registrations(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'pending',
      attempts integer NOT NULL DEFAULT 0,
      last_error text NULL,
      sent_at timestamptz NULL,
      locked_at timestamptz NULL,
      locked_by text NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX email_queue_status_created_at_idx
      ON public.email_queue (status, created_at);
  `);

  const priority = await db.query(
    `INSERT INTO public.property_priority_registrations DEFAULT VALUES
     RETURNING id::text`
  );
  const legacyQueue = await db.query(
    `INSERT INTO public.email_queue (
       recipient, subject, html, email_type, related_property_id,
       related_lead_id, status, attempts
     ) VALUES (
       'priority@example.invalid', 'Priority', '<p>Priority</p>',
       'priority_registration_confirmation', $1::uuid, $2::uuid,
       'pending', 0
     )
     RETURNING id::text, created_at, updated_at`,
    [propertyId, priority.rows[0].id]
  );
  const queueBaselineCatalog = await relationCatalog(db, [
    "email_queue",
    "property_priority_registrations",
  ]);
  const legacyQueueBefore = legacyQueue.rows[0];

  await db.exec(queueMigrationSql);

  const queueColumns = await db.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'email_queue'
        AND column_name IN (
          'canonical_lead_id', 'related_submission_type',
          'related_submission_id', 'dedupe_key'
        )
      ORDER BY ordinal_position`
  );
  assert.deepEqual(queueColumns.rows, [
    { column_name: "canonical_lead_id", data_type: "uuid", is_nullable: "YES" },
    { column_name: "related_submission_type", data_type: "text", is_nullable: "YES" },
    { column_name: "related_submission_id", data_type: "uuid", is_nullable: "YES" },
    { column_name: "dedupe_key", data_type: "text", is_nullable: "YES" },
  ]);

  const canonicalLeadFk = await db.query(
    `SELECT target.relname AS target_table, con.confdeltype
       FROM pg_constraint con
       JOIN pg_class target ON target.oid = con.confrelid
      WHERE con.conrelid = 'public.email_queue'::regclass
        AND con.contype = 'f'
        AND con.conname = 'email_queue_canonical_lead_id_fkey'`
  );
  assert.deepEqual(canonicalLeadFk.rows, [
    { target_table: "leads", confdeltype: "n" },
  ]);

  const legacyLeadFk = await db.query(
    `SELECT target.relname AS target_table, con.confdeltype
       FROM pg_constraint con
       JOIN pg_class target ON target.oid = con.confrelid
      WHERE con.conrelid = 'public.email_queue'::regclass
        AND con.contype = 'f'
        AND con.conname = 'email_queue_related_lead_id_fkey'`
  );
  assert.deepEqual(legacyLeadFk.rows, [
    { target_table: "property_priority_registrations", confdeltype: "n" },
  ]);

  const queueIndexes = await db.query(
    `SELECT idx.relname AS index_name, i.indisunique AS is_unique,
            pg_get_expr(i.indpred, i.indrelid) AS predicate,
            pg_get_indexdef(i.indexrelid) AS definition
       FROM pg_index i
       JOIN pg_class rel ON rel.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = rel.relnamespace
       JOIN pg_class idx ON idx.oid = i.indexrelid
      WHERE n.nspname = 'public'
        AND rel.relname = 'email_queue'
        AND idx.relname IN (
          'email_queue_dedupe_key_uidx',
          'email_queue_canonical_lead_id_idx',
          'email_queue_related_submission_idx'
        )
      ORDER BY idx.relname`
  );
  assert.equal(queueIndexes.rows.length, 3);
  assert.equal(
    queueIndexes.rows.find((row) => row.index_name === "email_queue_dedupe_key_uidx")
      .is_unique,
    true
  );
  assert.ok(queueIndexes.rows.every((row) => row.predicate));
  assert.ok(
    queueIndexes.rows.find(
      (row) => row.index_name === "email_queue_related_submission_idx"
    ).definition.includes("(related_submission_type, related_submission_id)")
  );

  const legacyQueueAfter = await db.query(
    `SELECT id::text, created_at, updated_at, canonical_lead_id,
            related_submission_type, related_submission_id, dedupe_key
       FROM public.email_queue
      WHERE id = $1::uuid`,
    [legacyQueueBefore.id]
  );
  assert.equal(legacyQueueAfter.rows[0].created_at.getTime(), legacyQueueBefore.created_at.getTime());
  assert.equal(legacyQueueAfter.rows[0].updated_at.getTime(), legacyQueueBefore.updated_at.getTime());
  assert.equal(legacyQueueAfter.rows[0].canonical_lead_id, null);
  assert.equal(legacyQueueAfter.rows[0].related_submission_type, null);
  assert.equal(legacyQueueAfter.rows[0].related_submission_id, null);
  assert.equal(legacyQueueAfter.rows[0].dedupe_key, null);

  await db.query(
    `INSERT INTO public.email_queue (
       recipient, subject, html, email_type, related_property_id,
       related_lead_id, status, attempts
     ) VALUES (
       'priority-2@example.invalid', 'Priority 2', '<p>Priority 2</p>',
       'priority_registration_internal', $1::uuid, $2::uuid,
       'pending', 0
     )`,
    [propertyId, priority.rows[0].id]
  );

  await db.exec(queueRollbackSql);
  assert.deepEqual(
    await relationCatalog(db, ["email_queue", "property_priority_registrations"]),
    queueBaselineCatalog
  );
  const legacyRowsAfterRollback = await db.query(
    `SELECT count(*)::int AS count FROM public.email_queue`
  );
  assert.equal(legacyRowsAfterRollback.rows[0].count, 2);
  await db.exec(`
    DROP TABLE public.email_queue;
    DROP TABLE public.property_priority_registrations;
  `);

  await db.exec(typedTablesRollbackSql);

  assert.deepEqual(await publicTables(db), baselineTables);
  assert.deepEqual(await baselineCatalog(db), baselineDefinition);
  const leadsStillExists = await db.query(
    `SELECT to_regclass('public.leads') IS NOT NULL AS exists`
  );
  assert.equal(leadsStillExists.rows[0].exists, true);

  console.log("Validated migrations 0001, 0002, and 0003 in an ephemeral local database.");
  console.log(`Created and inspected typed tables: ${typedTables.join(", ")}`);
  console.log("Verified 11 checks, 4 RESTRICT foreign keys, and 7 requested indexes.");
  console.log("Verified 0002 rollback removes only its three tables and preserves leads.");
  console.log("Verified 0003 adds four nullable queue columns, one SET NULL FK, and three partial indexes.");
  console.log("Verified 0003 preserves and rolls back without changing legacy Priority queue rows or relationships.");
} finally {
  await db.close();
}

const openHouseDb = new PGlite();

try {
  await openHouseDb.exec(leadsMigrationSql);
  await openHouseDb.exec(`
    CREATE TABLE public.propiedades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      validation_marker text NOT NULL DEFAULT 'unchanged',
      placas_en_lease boolean NOT NULL DEFAULT false
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

    CREATE TABLE public.property_priority_registrations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid()
    );

    CREATE TABLE public.email_queue (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      recipient text NOT NULL,
      subject text NOT NULL,
      html text NOT NULL,
      email_type text NOT NULL,
      related_property_id uuid NULL REFERENCES public.propiedades(id) ON DELETE SET NULL,
      related_lead_id uuid NULL REFERENCES public.property_priority_registrations(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'pending',
      attempts integer NOT NULL DEFAULT 0,
      last_error text NULL,
      sent_at timestamptz NULL,
      locked_at timestamptz NULL,
      locked_by text NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX email_queue_status_created_at_idx
      ON public.email_queue (status, created_at);
  `);
  await openHouseDb.exec(typedTablesMigrationSql);
  await openHouseDb.exec(queueMigrationSql);

  const originalConsultasCatalog = await relationCatalog(openHouseDb, [
    "consultas_propiedad",
  ]);
  const originalConsultasColumns = await openHouseDb.query(
    `SELECT ordinal_position, column_name, data_type, udt_name, is_nullable,
            column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'consultas_propiedad'
      ORDER BY ordinal_position`
  );
  const unrelatedTables = [
    "buyer_tenant_inquiries",
    "email_queue",
    "leads",
    "property_buyer_profiles",
    "property_priority_registrations",
    "propiedades",
    "seller_landlord_inquiries",
  ];
  const unrelatedCatalog = await relationCatalog(openHouseDb, unrelatedTables);

  await openHouseDb.exec(openHouseMigrationSql);

  const addedColumns = await openHouseDb.query(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'consultas_propiedad'
        AND column_name = ANY($1::text[])
      ORDER BY ordinal_position`,
    [[
      "lead_id",
      "idempotency_key",
      "source_path",
      "showing_at",
      "showing_event_key",
      "evidencia_fondos_key",
      "carta_precalificacion_status",
      "evidencia_fondos_status",
    ]]
  );
  assert.deepEqual(addedColumns.rows, [
    { column_name: "lead_id", data_type: "uuid", is_nullable: "YES", column_default: null },
    { column_name: "idempotency_key", data_type: "uuid", is_nullable: "YES", column_default: null },
    { column_name: "source_path", data_type: "text", is_nullable: "YES", column_default: null },
    { column_name: "showing_at", data_type: "timestamp with time zone", is_nullable: "YES", column_default: null },
    { column_name: "showing_event_key", data_type: "text", is_nullable: "YES", column_default: null },
    { column_name: "evidencia_fondos_key", data_type: "text", is_nullable: "YES", column_default: null },
    { column_name: "carta_precalificacion_status", data_type: "text", is_nullable: "YES", column_default: null },
    { column_name: "evidencia_fondos_status", data_type: "text", is_nullable: "YES", column_default: null },
  ]);
  const originalColumnsAfter0004 = await openHouseDb.query(
    `SELECT ordinal_position, column_name, data_type, udt_name, is_nullable,
            column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'consultas_propiedad'
        AND ordinal_position <= 16
      ORDER BY ordinal_position`
  );
  assert.deepEqual(originalColumnsAfter0004.rows, originalConsultasColumns.rows);

  const openHouseChecks = await openHouseDb.query(
    `SELECT conname
       FROM pg_constraint
      WHERE conrelid = 'public.consultas_propiedad'::regclass
        AND contype = 'c'
      ORDER BY conname`
  );
  assert.deepEqual(openHouseChecks.rows.map((row) => row.conname), [
    "consultas_propiedad_carta_precalificacion_key_check",
    "consultas_propiedad_carta_precalificacion_status_check",
    "consultas_propiedad_carta_precalificacion_status_key_check",
    "consultas_propiedad_evidencia_fondos_key_check",
    "consultas_propiedad_evidencia_fondos_status_check",
    "consultas_propiedad_evidencia_fondos_status_key_check",
    "consultas_propiedad_showing_event_key_check",
    "consultas_propiedad_showing_identity_check",
    "consultas_propiedad_source_path_check",
  ]);

  const leadFk = await openHouseDb.query(
    `SELECT target.relname AS target_table, con.confdeltype
       FROM pg_constraint con
       JOIN pg_class target ON target.oid = con.confrelid
      WHERE con.conrelid = 'public.consultas_propiedad'::regclass
        AND con.conname = 'consultas_propiedad_lead_id_fkey'`
  );
  assert.deepEqual(leadFk.rows, [{ target_table: "leads", confdeltype: "r" }]);

  const propertyFkBeforeHardening = await openHouseDb.query(
    `SELECT confdeltype
       FROM pg_constraint
      WHERE conrelid = 'public.consultas_propiedad'::regclass
        AND conname = 'consultas_propiedad_propiedad_id_fkey'`
  );
  assert.deepEqual(propertyFkBeforeHardening.rows, [{ confdeltype: "c" }]);

  const openHouseIndexes = await openHouseDb.query(
    `SELECT idx.relname AS index_name, i.indisunique AS is_unique,
            pg_get_expr(i.indpred, i.indrelid) AS predicate
       FROM pg_index i
       JOIN pg_class rel ON rel.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = rel.relnamespace
       JOIN pg_class idx ON idx.oid = i.indexrelid
      WHERE n.nspname = 'public'
        AND rel.relname = 'consultas_propiedad'
        AND NOT i.indisprimary
      ORDER BY idx.relname`
  );
  assert.deepEqual(
    openHouseIndexes.rows.map((row) => [row.index_name, row.is_unique]),
    [
      ["consultas_propiedad_idempotency_key_uidx", true],
      ["consultas_propiedad_lead_created_at_idx", false],
      ["consultas_propiedad_lead_showing_event_created_at_idx", false],
      ["consultas_propiedad_property_created_at_idx", false],
      ["consultas_propiedad_showing_event_created_at_idx", false],
    ]
  );
  assert.ok(openHouseIndexes.rows.every((row) => row.predicate));

  const triggers = await openHouseDb.query(
    `SELECT count(*)::int AS count
       FROM pg_trigger
      WHERE tgrelid = 'public.consultas_propiedad'::regclass
        AND NOT tgisinternal`
  );
  assert.equal(triggers.rows[0].count, 0);
  assert.deepEqual(await relationCatalog(openHouseDb, unrelatedTables), unrelatedCatalog);

  await openHouseDb.query(
    `INSERT INTO public.consultas_propiedad (nombre, telefono)
     VALUES ('Migration guard fixture', '787-555-0199')`
  );
  await assert.rejects(
    openHouseDb.exec(hardeningMigrationSql),
    /requires public\.consultas_propiedad to be empty/
  );
  await openHouseDb.exec("ROLLBACK");
  await openHouseDb.exec("DELETE FROM public.consultas_propiedad");

  await openHouseDb.exec(hardeningMigrationSql);
  const hardenedColumns = await openHouseDb.query(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'consultas_propiedad'
        AND column_name IN ('propiedad_id', 'created_at')
      ORDER BY ordinal_position`
  );
  assert.deepEqual(hardenedColumns.rows, [
    { column_name: "propiedad_id", data_type: "uuid", is_nullable: "NO", column_default: null },
    { column_name: "created_at", data_type: "timestamp with time zone", is_nullable: "NO", column_default: "now()" },
  ]);
  const propertyFkAfterHardening = await openHouseDb.query(
    `SELECT confdeltype
       FROM pg_constraint
      WHERE conrelid = 'public.consultas_propiedad'::regclass
        AND conname = 'consultas_propiedad_propiedad_id_fkey'`
  );
  assert.deepEqual(propertyFkAfterHardening.rows, [{ confdeltype: "r" }]);
  assert.deepEqual(await relationCatalog(openHouseDb, unrelatedTables), unrelatedCatalog);

  await openHouseDb.exec(financialDocumentReuseMigrationSql);
  const reuseColumn = await openHouseDb.query(
    `SELECT data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'consultas_propiedad'
        AND column_name = 'reused_property_buyer_profile_id'`
  );
  assert.deepEqual(reuseColumn.rows, [
    { data_type: "uuid", is_nullable: "YES", column_default: null },
  ]);
  const reuseFk = await openHouseDb.query(
    `SELECT target.relname AS target_table, con.confdeltype
       FROM pg_constraint con
       JOIN pg_class target ON target.oid = con.confrelid
      WHERE con.conrelid = 'public.consultas_propiedad'::regclass
        AND con.conname = 'consultas_propiedad_reused_profile_fkey'`
  );
  assert.deepEqual(reuseFk.rows, [
    { target_table: "property_buyer_profiles", confdeltype: "r" },
  ]);
  const reuseIndex = await openHouseDb.query(
    `SELECT indexdef
       FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'consultas_propiedad_reused_profile_idx'`
  );
  assert.equal(reuseIndex.rows.length, 1);
  assert.match(reuseIndex.rows[0].indexdef, /WHERE \(reused_property_buyer_profile_id IS NOT NULL\)/);
  await openHouseDb.exec(financialDocumentReuseRollbackSql);
  const reuseRollback = await openHouseDb.query(
    `SELECT NOT EXISTS (
       SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'consultas_propiedad'
          AND column_name = 'reused_property_buyer_profile_id'
     ) AS removed`
  );
  assert.deepEqual(reuseRollback.rows, [{ removed: true }]);

  await openHouseDb.exec(openHouseSolarQuestionMigrationSql);
  const openHouseSolarQuestionColumn = await openHouseDb.query(
    `SELECT data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'propiedades'
        AND column_name = 'open_house_solar_question_enabled'`
  );
  assert.deepEqual(openHouseSolarQuestionColumn.rows, [
    {
      data_type: "boolean",
      is_nullable: "NO",
      column_default: "false",
    },
  ]);
  const solarProperty = await openHouseDb.query(
    `INSERT INTO public.propiedades DEFAULT VALUES
     RETURNING id::text, placas_en_lease, open_house_solar_question_enabled`
  );
  assert.deepEqual(solarProperty.rows, [
    {
      id: solarProperty.rows[0].id,
      placas_en_lease: false,
      open_house_solar_question_enabled: false,
    },
  ]);
  const buyerProfileOnly = await openHouseDb.query(
    `UPDATE public.propiedades
        SET placas_en_lease = true
      WHERE id = $1::uuid
      RETURNING placas_en_lease, open_house_solar_question_enabled`,
    [solarProperty.rows[0].id]
  );
  assert.deepEqual(buyerProfileOnly.rows, [
    {
      placas_en_lease: true,
      open_house_solar_question_enabled: false,
    },
  ]);
  const openHouseOnly = await openHouseDb.query(
    `UPDATE public.propiedades
        SET placas_en_lease = false,
            open_house_solar_question_enabled = true
      WHERE id = $1::uuid
      RETURNING placas_en_lease, open_house_solar_question_enabled`,
    [solarProperty.rows[0].id]
  );
  assert.deepEqual(openHouseOnly.rows, [
    {
      placas_en_lease: false,
      open_house_solar_question_enabled: true,
    },
  ]);
  await openHouseDb.exec(privateShowingMigrationSql);
  const privateShowingColumns = await openHouseDb.query(
    `SELECT table_name, column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'propiedades' AND column_name = 'private_showing_token')
          OR
          (table_name = 'consultas_propiedad' AND column_name = 'workflow_source')
        )
      ORDER BY table_name, column_name`
  );
  assert.deepEqual(privateShowingColumns.rows, [
    {
      table_name: "consultas_propiedad",
      column_name: "workflow_source",
      data_type: "text",
      is_nullable: "NO",
      column_default: "'open_house'::text",
    },
    {
      table_name: "propiedades",
      column_name: "private_showing_token",
      data_type: "text",
      is_nullable: "NO",
      column_default: null,
    },
  ]);
  const privateTokenRows = await openHouseDb.query(
    `SELECT count(*)::int AS total,
            count(DISTINCT private_showing_token)::int AS unique_tokens,
            min(char_length(private_showing_token))::int AS minimum_length
       FROM public.propiedades`
  );
  assert.deepEqual(privateTokenRows.rows, [
    { total: 1, unique_tokens: 1, minimum_length: 64 },
  ]);
  const privateRegistration = await openHouseDb.query(
    `INSERT INTO public.consultas_propiedad (
       propiedad_id, nombre, telefono, workflow_source, source_path
     ) VALUES ($1::uuid, 'Private fixture', '787-555-0111',
       'private_showing', '/listados/private-fixture/visita')
     RETURNING workflow_source`,
    [solarProperty.rows[0].id]
  );
  assert.deepEqual(privateRegistration.rows, [
    { workflow_source: "private_showing" },
  ]);
  await assert.rejects(
    openHouseDb.exec(privateShowingRollbackSql),
    /private Showing registrations exist/
  );
  await openHouseDb.exec("ROLLBACK");
  await openHouseDb.exec("DELETE FROM public.consultas_propiedad");
  await openHouseDb.exec(privateShowingRollbackSql);
  await openHouseDb.query(
    `UPDATE public.propiedades
        SET open_house_solar_question_enabled = false
      WHERE id = $1::uuid`,
    [solarProperty.rows[0].id]
  );
  await openHouseDb.exec(openHouseSolarQuestionRollbackSql);
  const openHouseSolarQuestionRollback = await openHouseDb.query(
    `SELECT NOT EXISTS (
       SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'propiedades'
          AND column_name = 'open_house_solar_question_enabled'
     ) AS removed`
  );
  assert.deepEqual(openHouseSolarQuestionRollback.rows, [{ removed: true }]);
  await openHouseDb.exec("DELETE FROM public.propiedades");

  const property = await openHouseDb.query(
    `INSERT INTO public.propiedades DEFAULT VALUES RETURNING id::text`
  );
  await openHouseDb.query(
    `INSERT INTO public.consultas_propiedad (propiedad_id, nombre, telefono)
     VALUES ($1::uuid, 'Rollback guard fixture', '787-555-0188')`,
    [property.rows[0].id]
  );
  await assert.rejects(
    openHouseDb.exec(hardeningRollbackSql),
    /rollback requires public\.consultas_propiedad to be empty/
  );
  await openHouseDb.exec("ROLLBACK");
  await openHouseDb.exec("DELETE FROM public.consultas_propiedad");
  await openHouseDb.exec(hardeningRollbackSql);

  const restoredColumns = await openHouseDb.query(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'consultas_propiedad'
        AND column_name IN ('propiedad_id', 'created_at')
      ORDER BY ordinal_position`
  );
  assert.deepEqual(restoredColumns.rows, [
    { column_name: "propiedad_id", data_type: "uuid", is_nullable: "YES", column_default: null },
    { column_name: "created_at", data_type: "timestamp without time zone", is_nullable: "YES", column_default: "CURRENT_TIMESTAMP" },
  ]);

  await openHouseDb.exec(openHouseRollbackSql);
  assert.deepEqual(
    await relationCatalog(openHouseDb, ["consultas_propiedad"]),
    originalConsultasCatalog
  );
  assert.deepEqual(await relationCatalog(openHouseDb, unrelatedTables), unrelatedCatalog);

  console.log("Validated the ordered lead migration chain through 0016 in ephemeral local databases.");
  console.log("Verified 0004 adds eight nullable columns, one RESTRICT FK, nine checks, and five partial indexes.");
  console.log("Verified 0004 rollback restores the original consultas_propiedad catalog only.");
  console.log("Verified 0005 forward and rollback guards reject non-empty tables.");
  console.log("Verified 0005 hardens and restores property FK, nullability, and created_at semantics.");
  console.log("Verified 0014 adds one nullable RESTRICT source FK, one state check, one partial index, and a contained rollback.");
  console.log("Verified 0015 separates Open House solar-question configuration without changing Buyer Profile configuration.");
  console.log("Verified 0016 adds unique permanent private Showing tokens and distinct workflow persistence.");
} finally {
  await openHouseDb.close();
}

const priorityRegistrationDb = new PGlite();
try {
  await priorityRegistrationDb.exec(leadsMigrationSql);
  await priorityRegistrationDb.exec(`
    CREATE TABLE public.propiedades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid()
    );
    CREATE TABLE public.property_priority_registrations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id uuid NOT NULL REFERENCES public.propiedades(id) ON DELETE CASCADE,
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
    CREATE UNIQUE INDEX property_priority_registrations_property_email_unique
      ON public.property_priority_registrations (property_id, lower(email));
  `);
  const property = await priorityRegistrationDb.query(
    `INSERT INTO public.propiedades DEFAULT VALUES RETURNING id::text`
  );
  await priorityRegistrationDb.query(
    `INSERT INTO public.property_priority_registrations (
       property_id, property_slug, property_title, name, phone, email,
       purchase_type, search_range, wants_visit
     ) VALUES ($1::uuid, 'fixture', 'Fixture', 'Person One', '787-555-0101',
       'one@example.com', 'Cash', 'Puerto Rico', true)`,
    [property.rows[0].id]
  );
  const baseline = await relationCatalog(priorityRegistrationDb, [
    "property_priority_registrations",
  ]);
  const beforeCount = await priorityRegistrationDb.query(
    `SELECT count(*)::int AS count FROM public.property_priority_registrations`
  );

  await priorityRegistrationDb.exec(priorityRegistrationMigrationSql);
  const leadColumn = await priorityRegistrationDb.query(
    `SELECT data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name='property_priority_registrations'
        AND column_name='lead_id'`
  );
  assert.deepEqual(leadColumn.rows, [
    { data_type: "uuid", is_nullable: "YES", column_default: null },
  ]);
  const leadFk = await priorityRegistrationDb.query(
    `SELECT target.relname AS target_table, con.confdeltype
       FROM pg_constraint con
       JOIN pg_class target ON target.oid=con.confrelid
      WHERE con.conrelid='public.property_priority_registrations'::regclass
        AND con.conname='property_priority_registrations_lead_id_fkey'`
  );
  assert.deepEqual(leadFk.rows, [{ target_table: "leads", confdeltype: "r" }]);
  const leadIndex = await priorityRegistrationDb.query(
    `SELECT i.indisunique AS is_unique,
            pg_get_expr(i.indpred, i.indrelid) AS predicate
       FROM pg_index i
       JOIN pg_class idx ON idx.oid=i.indexrelid
      WHERE idx.relname='property_priority_registrations_lead_id_idx'`
  );
  assert.equal(leadIndex.rows.length, 1);
  assert.equal(leadIndex.rows[0].is_unique, false);
  assert.match(leadIndex.rows[0].predicate, /lead_id IS NOT NULL/);
  const afterCount = await priorityRegistrationDb.query(
    `SELECT count(*)::int AS count FROM public.property_priority_registrations`
  );
  assert.deepEqual(afterCount.rows, beforeCount.rows);

  await assert.rejects(
    priorityRegistrationDb.query(
      `UPDATE public.property_priority_registrations
          SET lead_id='00000000-0000-4000-8000-000000000099'::uuid`
    )
  );
  await priorityRegistrationDb.exec(priorityRegistrationRollbackSql);
  assert.deepEqual(
    await relationCatalog(priorityRegistrationDb, [
      "property_priority_registrations",
    ]),
    baseline
  );
  const leadsRemain = await priorityRegistrationDb.query(
    `SELECT to_regclass('public.leads') IS NOT NULL AS exists`
  );
  assert.equal(leadsRemain.rows[0].exists, true);

  console.log("Validated the ordered migration chain through 0006.");
  console.log("Verified 0006 preserves Priority rows, adds a nullable RESTRICT lead FK and partial index, and rolls back only its additions.");
} finally {
  await priorityRegistrationDb.close();
}

const lead360Db = new PGlite();
try {
  await lead360Db.exec(leadsMigrationSql);
  await lead360Db.exec(lead360MigrationSql);
  await lead360Db.exec(contactedEventMigrationSql);
  await lead360Db.exec(documentAccessMigrationSql);
  await lead360Db.exec(leadMergeMigrationSql);
  await lead360Db.exec(`
    CREATE TABLE public.propiedades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid()
    );
  `);
  await lead360Db.exec(leadGroupsMigrationSql);
  await lead360Db.exec(leadGroupEventsMigrationSql);

  const tables = await lead360Db.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'lead_notes',
        'lead_relationships',
        'lead_duplicate_reviews',
        'lead_management_events'
      )
    ORDER BY table_name
  `);
  assert.deepEqual(tables.rows.map((row) => row.table_name), [
    "lead_duplicate_reviews",
    "lead_management_events",
    "lead_notes",
    "lead_relationships",
  ]);

  const followUpColumn = await lead360Db.query(`
    SELECT data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'next_follow_up_at'
  `);
  assert.deepEqual(followUpColumn.rows, [{
    data_type: "timestamp with time zone",
    is_nullable: "YES",
    column_default: null,
  }]);

  const foreignKeys = await lead360Db.query(`
    SELECT source.relname AS source_table,
           count(*)::int AS foreign_key_count,
           bool_and(con.confdeltype = 'r') AS all_restrict
    FROM pg_constraint con
    JOIN pg_class source ON source.oid = con.conrelid
    WHERE con.contype = 'f'
      AND source.relname IN (
        'lead_notes',
        'lead_relationships',
        'lead_duplicate_reviews',
        'lead_management_events'
      )
    GROUP BY source.relname
    ORDER BY source.relname
  `);
  assert.deepEqual(foreignKeys.rows, [
    { source_table: "lead_duplicate_reviews", foreign_key_count: 2, all_restrict: true },
    { source_table: "lead_management_events", foreign_key_count: 1, all_restrict: true },
    { source_table: "lead_notes", foreign_key_count: 1, all_restrict: true },
    { source_table: "lead_relationships", foreign_key_count: 2, all_restrict: true },
  ]);

  const indexRows = await lead360Db.query(`
    SELECT idx.relname AS index_name, i.indisunique AS is_unique
    FROM pg_index i
    JOIN pg_class idx ON idx.oid = i.indexrelid
    WHERE idx.relname IN (
      'leads_next_follow_up_at_idx',
      'lead_notes_idempotency_key_uidx',
      'lead_notes_lead_created_at_idx',
      'lead_relationships_pair_uidx',
      'lead_relationships_lead_id_idx',
      'lead_relationships_related_lead_id_idx',
      'lead_duplicate_reviews_pair_uidx',
      'lead_management_events_idempotency_key_uidx',
      'lead_management_events_lead_created_at_idx'
    )
    ORDER BY idx.relname
  `);
  assert.equal(indexRows.rows.length, 9);
  assert.equal(
    indexRows.rows.find((row) => row.index_name === "lead_relationships_pair_uidx").is_unique,
    true
  );

  const eventCheck = await lead360Db.query(`
    SELECT pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.lead_management_events'::regclass
      AND conname = 'lead_management_events_type_check'
  `);
  assert.match(eventCheck.rows[0].definition, /contacted/);
  assert.match(eventCheck.rows[0].definition, /document_accessed/);
  assert.match(eventCheck.rows[0].definition, /leads_merged/);

  const mergeColumns = await lead360Db.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads'
      AND column_name IN ('merged_at', 'merged_by')
    ORDER BY column_name
  `);
  assert.deepEqual(mergeColumns.rows, [
    { column_name: "merged_at", data_type: "timestamp with time zone", is_nullable: "YES" },
    { column_name: "merged_by", data_type: "text", is_nullable: "YES" },
  ]);
  const mergeTable = await lead360Db.query(`
    SELECT to_regclass('public.lead_merge_events')::text AS table_name
  `);
  assert.deepEqual(mergeTable.rows, [{ table_name: "lead_merge_events" }]);
  const mergeIndexes = await lead360Db.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND indexname IN (
      'lead_merge_events_operation_key_uidx',
      'lead_merge_events_secondary_lead_id_uidx',
      'lead_merge_events_primary_created_at_idx'
    ) ORDER BY indexname
  `);
  assert.equal(mergeIndexes.rows.length, 3);
  const reviewCheck = await lead360Db.query(`
    SELECT pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.lead_duplicate_reviews'::regclass
      AND conname = 'lead_duplicate_reviews_decision_check'
  `);
  assert.match(reviewCheck.rows[0].definition, /merged/);

  const groupTables = await lead360Db.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN (
      'lead_groups', 'lead_group_members', 'lead_group_notes', 'lead_group_events'
    )
    ORDER BY table_name
  `);
  assert.deepEqual(groupTables.rows.map((row) => row.table_name), [
    "lead_group_events",
    "lead_group_members",
    "lead_group_notes",
    "lead_groups",
  ]);
  const groupForeignKeys = await lead360Db.query(`
    SELECT source.relname AS source_table,
           count(*)::int AS foreign_key_count,
           bool_and(con.confdeltype='r') AS all_restrict
    FROM pg_constraint con
    JOIN pg_class source ON source.oid=con.conrelid
    WHERE con.contype='f' AND source.relname IN (
      'lead_groups', 'lead_group_members', 'lead_group_notes', 'lead_group_events'
    )
    GROUP BY source.relname
    ORDER BY source.relname
  `);
  assert.deepEqual(groupForeignKeys.rows, [
    { source_table: "lead_group_events", foreign_key_count: 1, all_restrict: true },
    { source_table: "lead_group_members", foreign_key_count: 2, all_restrict: true },
    { source_table: "lead_group_notes", foreign_key_count: 1, all_restrict: true },
    { source_table: "lead_groups", foreign_key_count: 1, all_restrict: true },
  ]);
  const groupIndexes = await lead360Db.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND indexname IN (
      'lead_groups_status_updated_at_idx',
      'lead_groups_primary_property_id_idx',
      'lead_groups_next_follow_up_at_idx',
      'lead_group_members_one_primary_uidx',
      'lead_group_members_lead_id_idx',
      'lead_group_notes_idempotency_key_uidx',
      'lead_group_notes_group_created_at_idx',
      'lead_group_events_idempotency_key_uidx',
      'lead_group_events_group_created_at_idx'
    )
  `);
  assert.equal(groupIndexes.rows.length, 9);
  const groupEventCheck = await lead360Db.query(`
    SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid='public.lead_group_events'::regclass
      AND conname='lead_group_events_type_check'
  `);
  assert.match(groupEventCheck.rows[0].definition, /member_role_changed/);
  assert.match(groupEventCheck.rows[0].definition, /primary_contact_changed/);
  const groupId = (await lead360Db.query(`
    INSERT INTO public.lead_groups (title, created_by)
    VALUES ('Caso sintético', 'migration-test') RETURNING id::text
  `)).rows[0].id;
  const groupLead = (await lead360Db.query(`
    INSERT INTO public.leads (name, email_normalized)
    VALUES ('Miembro sintético', 'member@example.test') RETURNING id::text
  `)).rows[0].id;
  await lead360Db.query(`
    INSERT INTO public.lead_group_members (
      group_id, lead_id, role, is_primary_contact, created_by
    ) VALUES ($1::uuid, $2::uuid, 'buyer', true, 'migration-test')
  `, [groupId, groupLead]);
  await assert.rejects(lead360Db.exec(leadGroupsRollbackSql));
  await lead360Db.exec("ROLLBACK");
  await lead360Db.query("DELETE FROM public.lead_group_members WHERE group_id=$1::uuid", [groupId]);
  await lead360Db.query("DELETE FROM public.lead_groups WHERE id=$1::uuid", [groupId]);
  await lead360Db.exec(leadGroupEventsRollbackSql);
  await lead360Db.exec(leadGroupsRollbackSql);
  const groupRollbackState = await lead360Db.query(`
    SELECT to_regclass('public.lead_groups') IS NULL AS groups_removed,
           to_regclass('public.lead_group_members') IS NULL AS members_removed
  `);
  assert.deepEqual(groupRollbackState.rows, [{ groups_removed: true, members_removed: true }]);

  await lead360Db.exec(leadMergeRollbackSql);
  const mergeRollbackState = await lead360Db.query(`
    SELECT to_regclass('public.lead_merge_events') IS NULL AS table_removed,
      NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'leads'
          AND column_name IN ('merged_at', 'merged_by')
      ) AS columns_removed
  `);
  assert.deepEqual(mergeRollbackState.rows, [{ table_removed: true, columns_removed: true }]);

  await lead360Db.exec(documentAccessRollbackSql);
  const rolledBackDocumentCheck = await lead360Db.query(`
    SELECT pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.lead_management_events'::regclass
      AND conname = 'lead_management_events_type_check'
  `);
  assert.doesNotMatch(rolledBackDocumentCheck.rows[0].definition, /document_accessed/);
  assert.match(rolledBackDocumentCheck.rows[0].definition, /contacted/);

  await lead360Db.exec(contactedEventRollbackSql);
  const rolledBackEventCheck = await lead360Db.query(`
    SELECT pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.lead_management_events'::regclass
      AND conname = 'lead_management_events_type_check'
  `);
  assert.doesNotMatch(rolledBackEventCheck.rows[0].definition, /contacted/);

  await lead360Db.exec(lead360RollbackSql);
  const rolledBack = await lead360Db.query(`
    SELECT to_regclass('public.lead_notes') IS NULL AS notes_removed,
           NOT EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'leads'
               AND column_name = 'next_follow_up_at'
           ) AS follow_up_removed
  `);
  assert.deepEqual(rolledBack.rows, [{ notes_removed: true, follow_up_removed: true }]);

  console.log("Validated the ordered migration chain through 0012.");
  console.log("Verified Lead 360, merge lineage, Client Case tables, indexes, RESTRICT keys, and guarded rollbacks.");
} finally {
  await lead360Db.close();
}

const adminAuthDb = new PGlite();
try {
  await adminAuthDb.exec(`
    CREATE TABLE public.admin_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      activo boolean NOT NULL DEFAULT true,
      created_at timestamp without time zone NOT NULL DEFAULT now()
    );
    INSERT INTO public.admin_users (username, password_hash)
    VALUES ('admin-one', 'hash-one'), ('admin-two', 'hash-two');
  `);
  await adminAuthDb.exec(adminAuthMigrationSql);

  const columns = await adminAuthDb.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='admin_users'
      AND column_name IN (
        'display_name', 'email', 'last_login_at', 'password_changed_at',
        'session_version'
      )
    ORDER BY ordinal_position
  `);
  assert.deepEqual(columns.rows, [
    { column_name: 'display_name', data_type: 'text', is_nullable: 'YES', column_default: null },
    { column_name: 'email', data_type: 'text', is_nullable: 'YES', column_default: null },
    { column_name: 'last_login_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
    { column_name: 'password_changed_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
    { column_name: 'session_version', data_type: 'integer', is_nullable: 'NO', column_default: '1' },
  ]);
  const authTables = await adminAuthDb.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public'
      AND table_name IN ('admin_password_reset_tokens', 'admin_auth_attempts')
    ORDER BY table_name
  `);
  assert.deepEqual(authTables.rows.map((row) => row.table_name), [
    'admin_auth_attempts',
    'admin_password_reset_tokens',
  ]);
  const indexes = await adminAuthDb.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND indexname IN (
      'admin_users_email_normalized_uidx',
      'admin_password_reset_tokens_hash_uidx',
      'admin_password_reset_tokens_admin_created_at_idx',
      'admin_password_reset_tokens_active_expiry_idx',
      'admin_auth_attempts_lookup_idx'
    )
  `);
  assert.equal(indexes.rows.length, 5);
  const preserved = await adminAuthDb.query(`
    SELECT count(*)::int AS count,
           bool_and(session_version = 1) AS versions_preserved
    FROM public.admin_users
  `);
  assert.deepEqual(preserved.rows, [{ count: 2, versions_preserved: true }]);

  await adminAuthDb.query(`
    INSERT INTO public.admin_users (
      username, password_hash, email
    ) VALUES ('email-owner', 'hash', 'owner@example.test')
  `);
  await assert.rejects(adminAuthDb.query(`
    INSERT INTO public.admin_users (
      username, password_hash, email
    ) VALUES ('duplicate-email', 'hash', 'owner@example.test')
  `));
  await adminAuthDb.query(`DELETE FROM public.admin_users WHERE username='email-owner'`);

  await adminAuthDb.exec(adminAuthRollbackSql);
  const rolledBack = await adminAuthDb.query(`
    SELECT to_regclass('public.admin_password_reset_tokens') IS NULL AS tokens_removed,
           to_regclass('public.admin_auth_attempts') IS NULL AS attempts_removed,
           NOT EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='admin_users'
               AND column_name='session_version'
           ) AS columns_removed
  `);
  assert.deepEqual(rolledBack.rows, [{
    tokens_removed: true,
    attempts_removed: true,
    columns_removed: true,
  }]);
  console.log('Validated the ordered migration chain through 0013.');
  console.log('Verified admin profile fields, reset tokens, rate-limit audit storage, indexes, and guarded rollback.');
} finally {
  await adminAuthDb.close();
}

const publicRateLimitMigrationSql = await readMigration(
  "0017_create_public_rate_limits.sql"
);
const publicRateLimitRollbackSql = await readMigration(
  "0017_create_public_rate_limits.rollback.sql"
);
const publicRateLimitDb = new PGlite();
try {
  await publicRateLimitDb.exec(publicRateLimitMigrationSql);
  const catalog = await publicRateLimitDb.query(`
    SELECT
      to_regclass('public.public_rate_limit_buckets')::text AS table_name,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname='public'
          AND indexname='public_rate_limit_buckets_expires_at_idx'
      ) AS has_expiry_index,
      (
        SELECT count(*)::int FROM pg_constraint
        WHERE conrelid='public.public_rate_limit_buckets'::regclass
          AND contype='c'
      ) AS check_count
  `);
  assert.deepEqual(catalog.rows, [{
    table_name: "public_rate_limit_buckets",
    has_expiry_index: true,
    check_count: 5,
  }]);
  await assert.rejects(
    publicRateLimitDb.query(`
      INSERT INTO public.public_rate_limit_buckets (
        action_type, identifier_hash, bucket_start, window_seconds, expires_at
      ) VALUES ('invalid action', '${"a".repeat(64)}', now(), 60, now() + interval '1 minute')
    `)
  );
  await publicRateLimitDb.exec(publicRateLimitRollbackSql);
  const removed = await publicRateLimitDb.query(
    `SELECT to_regclass('public.public_rate_limit_buckets') IS NULL AS removed`
  );
  assert.deepEqual(removed.rows, [{ removed: true }]);
  console.log("Validated the ordered migration chain through 0017.");
  console.log("Verified durable pseudonymous public rate-limit buckets and expiry index.");
} finally {
  await publicRateLimitDb.close();
}

const operationalMonitoringMigrationSql = await readMigration(
  "0018_add_operational_monitoring.sql"
);
const operationalMonitoringRollbackSql = await readMigration(
  "0018_add_operational_monitoring.rollback.sql"
);
const operationalMonitoringDb = new PGlite();
try {
  await operationalMonitoringDb.exec(operationalMonitoringMigrationSql);
  const catalog = await operationalMonitoringDb.query(`
    SELECT
      to_regclass('public.operational_cron_heartbeats')::text AS heartbeat_table,
      to_regclass('public.operational_alert_state')::text AS alert_table,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname='public'
          AND indexname='operational_alert_state_active_idx'
      ) AS has_active_index
  `);
  assert.deepEqual(catalog.rows, [{
    heartbeat_table: "operational_cron_heartbeats",
    alert_table: "operational_alert_state",
    has_active_index: true,
  }]);
  await assert.rejects(
    operationalMonitoringDb.query(`
      INSERT INTO public.operational_cron_heartbeats (job_name)
      VALUES ('unknown_job')
    `)
  );
  await operationalMonitoringDb.exec(operationalMonitoringRollbackSql);
  const removed = await operationalMonitoringDb.query(`
    SELECT
      to_regclass('public.operational_cron_heartbeats') IS NULL AS heartbeat_removed,
      to_regclass('public.operational_alert_state') IS NULL AS alert_removed
  `);
  assert.deepEqual(removed.rows, [{
    heartbeat_removed: true,
    alert_removed: true,
  }]);
  console.log("Validated the ordered migration chain through 0018.");
  console.log("Verified cron heartbeats, alert deduplication state, and guarded rollback.");
} finally {
  await operationalMonitoringDb.close();
}

const translationPersistenceMigrationSql = await readMigration(
  "0019_create_translation_persistence.sql"
);
const translationPersistenceRollbackSql = await readMigration(
  "0019_create_translation_persistence.rollback.sql"
);
const translationPersistenceDb = new PGlite();
try {
  await translationPersistenceDb.exec(`
    CREATE TABLE public.propiedades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo text NOT NULL,
      descripcion text NOT NULL
    );
    CREATE TABLE public.testimonios (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      texto text NOT NULL
    );
    CREATE TABLE public.admin_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username text NOT NULL UNIQUE
    );
  `);
  await translationPersistenceDb.exec(translationPersistenceMigrationSql);

  const tables = await translationPersistenceDb.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public'
      AND table_name IN (
        'content_translations',
        'translation_jobs',
        'translation_revision_events'
      )
    ORDER BY table_name
  `);
  assert.deepEqual(tables.rows.map((row) => row.table_name), [
    "content_translations",
    "translation_jobs",
    "translation_revision_events",
  ]);

  const foreignKeys = await translationPersistenceDb.query(`
    SELECT source.relname AS source_table,
           target.relname AS target_table,
           con.confdeltype
    FROM pg_constraint con
    JOIN pg_class source ON source.oid=con.conrelid
    JOIN pg_class target ON target.oid=con.confrelid
    WHERE source.relname IN (
      'content_translations',
      'translation_jobs',
      'translation_revision_events'
    )
      AND con.contype='f'
    ORDER BY source.relname, target.relname
  `);
  assert.deepEqual(foreignKeys.rows, [
    { source_table: "content_translations", target_table: "admin_users", confdeltype: "r" },
    { source_table: "content_translations", target_table: "propiedades", confdeltype: "c" },
    { source_table: "content_translations", target_table: "testimonios", confdeltype: "c" },
    { source_table: "translation_jobs", target_table: "content_translations", confdeltype: "c" },
    { source_table: "translation_revision_events", target_table: "admin_users", confdeltype: "r" },
    { source_table: "translation_revision_events", target_table: "content_translations", confdeltype: "c" },
    { source_table: "translation_revision_events", target_table: "translation_jobs", confdeltype: "n" },
  ]);

  const indexes = await translationPersistenceDb.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname='public'
      AND indexname IN (
        'content_translations_property_locale_field_uidx',
        'content_translations_testimonial_locale_field_uidx',
        'content_translations_property_id_idx',
        'content_translations_testimonial_id_idx',
        'content_translations_status_updated_at_idx',
        'translation_jobs_active_source_uidx',
        'translation_jobs_claim_idx',
        'translation_jobs_processing_locked_at_idx',
        'translation_jobs_status_updated_at_idx',
        'translation_revision_events_translation_created_at_idx',
        'translation_revision_events_actor_created_at_idx'
      )
    ORDER BY indexname
  `);
  assert.equal(indexes.rows.length, 11);

  const property = await translationPersistenceDb.query(`
    INSERT INTO public.propiedades (titulo, descripcion)
    VALUES ('Casa', 'Descripción')
    RETURNING id::text
  `);
  const testimonial = await translationPersistenceDb.query(`
    INSERT INTO public.testimonios (texto)
    VALUES ('Excelente servicio')
    RETURNING id::text
  `);
  const hash = "a".repeat(64);
  await translationPersistenceDb.query(
    `INSERT INTO public.content_translations (
       property_id, target_locale, field_key, source_hash
     ) VALUES ($1::uuid, 'en-US', 'title', $2)`,
    [property.rows[0].id, hash]
  );
  await translationPersistenceDb.query(
    `INSERT INTO public.content_translations (
       testimonial_id, target_locale, field_key, source_hash
     ) VALUES ($1::uuid, 'en-US', 'body', $2)`,
    [testimonial.rows[0].id, hash]
  );
  await assert.rejects(
    translationPersistenceDb.query(
      `INSERT INTO public.content_translations (
         property_id, testimonial_id, target_locale, field_key, source_hash
       ) VALUES ($1::uuid, $2::uuid, 'en-US', 'title', $3)`,
      [property.rows[0].id, testimonial.rows[0].id, hash]
    )
  );

  await assert.rejects(
    translationPersistenceDb.exec(translationPersistenceRollbackSql)
  );
  await translationPersistenceDb.exec(`ROLLBACK`);
  await translationPersistenceDb.exec(`
    DELETE FROM public.translation_revision_events;
    DELETE FROM public.translation_jobs;
    DELETE FROM public.content_translations;
  `);
  await translationPersistenceDb.exec(translationPersistenceRollbackSql);
  const removed = await translationPersistenceDb.query(`
    SELECT
      to_regclass('public.content_translations') IS NULL AS translations_removed,
      to_regclass('public.translation_jobs') IS NULL AS jobs_removed,
      to_regclass('public.translation_revision_events') IS NULL AS revisions_removed,
      (SELECT count(*)::int FROM public.propiedades) AS properties_preserved,
      (SELECT count(*)::int FROM public.testimonios) AS testimonials_preserved
  `);
  assert.deepEqual(removed.rows, [{
    translations_removed: true,
    jobs_removed: true,
    revisions_removed: true,
    properties_preserved: 1,
    testimonials_preserved: 1,
  }]);
  console.log("Validated the ordered migration chain through 0019.");
  console.log("Verified typed translation owners, lifecycle constraints, queue indexes, audit FKs, and guarded rollback.");
} finally {
  await translationPersistenceDb.close();
}

const regenerationAuthorizationMigrationSql = await readMigration(
  "0020_add_translation_regeneration_authorization.sql"
);
const regenerationAuthorizationRollbackSql = await readMigration(
  "0020_add_translation_regeneration_authorization.rollback.sql"
);
const regenerationAuthorizationDb = new PGlite();
try {
  await regenerationAuthorizationDb.exec(`
    CREATE TABLE public.propiedades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), titulo text NOT NULL,
      descripcion text NOT NULL
    );
    CREATE TABLE public.testimonios (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), texto text NOT NULL
    );
    CREATE TABLE public.admin_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text NOT NULL UNIQUE
    );
  `);
  await regenerationAuthorizationDb.exec(translationPersistenceMigrationSql);
  const property = await regenerationAuthorizationDb.query(`
    INSERT INTO public.propiedades (titulo, descripcion)
    VALUES ('Casa', 'Descripción') RETURNING id::text
  `);
  const hash = "b".repeat(64);
  await regenerationAuthorizationDb.query(
    `INSERT INTO public.content_translations (
       property_id, target_locale, field_key, source_hash
     ) VALUES ($1::uuid, 'en-US', 'title', $2)`,
    [property.rows[0].id, hash]
  );
  await regenerationAuthorizationDb.exec(regenerationAuthorizationMigrationSql);
  const column = await regenerationAuthorizationDb.query(`
    SELECT data_type, is_nullable
      FROM information_schema.columns
     WHERE table_schema='public'
       AND table_name='content_translations'
       AND column_name='regeneration_authorized_at'
  `);
  assert.deepEqual(column.rows, [{
    data_type: "timestamp with time zone",
    is_nullable: "YES",
  }]);

  await assert.rejects(regenerationAuthorizationDb.query(
    `UPDATE public.content_translations
        SET origin='manual', protected_from_automation=false
      WHERE property_id=$1::uuid`,
    [property.rows[0].id]
  ));
  await regenerationAuthorizationDb.exec("ROLLBACK");
  await regenerationAuthorizationDb.query(
    `UPDATE public.content_translations
        SET origin='manual', protected_from_automation=true
      WHERE property_id=$1::uuid`,
    [property.rows[0].id]
  );
  await regenerationAuthorizationDb.query(
    `UPDATE public.content_translations
        SET protected_from_automation=false,
            regeneration_authorized_at=now(), review_status='unreviewed'
      WHERE property_id=$1::uuid`,
    [property.rows[0].id]
  );
  await assert.rejects(regenerationAuthorizationDb.query(
    `UPDATE public.content_translations SET review_status='reviewed'
      WHERE property_id=$1::uuid`,
    [property.rows[0].id]
  ));
  await regenerationAuthorizationDb.exec("ROLLBACK");
  await assert.rejects(
    regenerationAuthorizationDb.exec(regenerationAuthorizationRollbackSql)
  );
  await regenerationAuthorizationDb.exec("ROLLBACK");
  await regenerationAuthorizationDb.query(
    `UPDATE public.content_translations
        SET origin='machine', protected_from_automation=false,
            regeneration_authorized_at=NULL, review_status='unreviewed'
      WHERE property_id=$1::uuid`,
    [property.rows[0].id]
  );
  await regenerationAuthorizationDb.exec(regenerationAuthorizationRollbackSql);
  const rolledBack = await regenerationAuthorizationDb.query(`
    SELECT
      NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='content_translations'
          AND column_name='regeneration_authorized_at'
      ) AS column_removed,
      (SELECT count(*)::int FROM public.content_translations) AS translations_preserved,
      (SELECT count(*)::int FROM public.propiedades) AS properties_preserved
  `);
  assert.deepEqual(rolledBack.rows, [{
    column_removed: true,
    translations_preserved: 1,
    properties_preserved: 1,
  }]);
  console.log("Validated the ordered migration chain through 0020.");
  console.log("Verified explicit regeneration authorization and guarded rollback.");
} finally {
  await regenerationAuthorizationDb.close();
}

const translationUsageMigrationSql = await readMigration(
  "0021_add_translation_usage_budget.sql"
);
const translationUsageRollbackSql = await readMigration(
  "0021_add_translation_usage_budget.rollback.sql"
);
const translationUsageDb = new PGlite();
try {
  await translationUsageDb.exec(`
    CREATE TABLE public.propiedades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), titulo text NOT NULL,
      descripcion text NOT NULL
    );
    CREATE TABLE public.testimonios (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), texto text NOT NULL
    );
    CREATE TABLE public.admin_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text NOT NULL UNIQUE
    );
  `);
  await translationUsageDb.exec(translationPersistenceMigrationSql);
  await translationUsageDb.exec(regenerationAuthorizationMigrationSql);
  await translationUsageDb.exec(translationUsageMigrationSql);
  const catalog = await translationUsageDb.query(`
    SELECT
      to_regclass('public.translation_provider_usage_buckets')::text AS usage_table,
      (SELECT column_default FROM information_schema.columns
        WHERE table_schema='public' AND table_name='translation_jobs'
          AND column_name='max_attempts') AS max_attempts_default,
      EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
        AND indexname='translation_provider_usage_period_idx') AS usage_index
  `);
  assert.deepEqual(catalog.rows, [{
    usage_table: "translation_provider_usage_buckets",
    max_attempts_default: "2",
    usage_index: true,
  }]);
  await translationUsageDb.exec(`
    INSERT INTO public.translation_provider_usage_buckets (
      provider, period_kind, period_start, attempted_characters, provider_attempts
    ) VALUES ('google-cloud-translation', 'day', DATE '2030-01-01', 100, 1)
  `);
  await assert.rejects(translationUsageDb.exec(translationUsageRollbackSql));
  await translationUsageDb.exec("ROLLBACK");
  await translationUsageDb.exec("DELETE FROM public.translation_provider_usage_buckets");
  await translationUsageDb.exec(translationUsageRollbackSql);
  const rolledBack = await translationUsageDb.query(`
    SELECT
      to_regclass('public.translation_provider_usage_buckets') IS NULL AS usage_removed,
      (SELECT column_default='5' FROM information_schema.columns
        WHERE table_schema='public' AND table_name='translation_jobs'
          AND column_name='max_attempts') AS default_restored
  `);
  assert.deepEqual(rolledBack.rows, [{ usage_removed: true, default_restored: true }]);
  console.log("Validated the ordered migration chain through 0021.");
  console.log("Verified aggregate-only usage accounting, bounded job defaults, and guarded rollback.");
} finally {
  await translationUsageDb.close();
}

const signatureFoundationMigrationSql = await readMigration(
  "0022_create_signature_foundation.sql"
);
const signatureFoundationRollbackSql = await readMigration(
  "0022_create_signature_foundation.rollback.sql"
);
const signatureSignerMigrationSql = await readMigration(
  "0023_extend_signature_signer_evidence.sql"
);
const signatureSignerRollbackSql = await readMigration(
  "0023_extend_signature_signer_evidence.rollback.sql"
);
const signatureDeliveryMigrationSql = await readMigration(
  "0024_add_signature_delivery_governance.sql"
);
const signatureDeliveryRollbackSql = await readMigration(
  "0024_add_signature_delivery_governance.rollback.sql"
);
const signaturePrivacyBindingMigrationSql = await readMigration(
  "0025_bind_signature_privacy_disclosure.sql"
);
const signaturePrivacyBindingRollbackSql = await readMigration(
  "0025_bind_signature_privacy_disclosure.rollback.sql"
);
const signaturePrivacyHistoryMigrationSql = await readMigration(
  "0026_preserve_signature_privacy_disclosure_text.sql"
);
const signaturePrivacyHistoryRollbackSql = await readMigration(
  "0026_preserve_signature_privacy_disclosure_text.rollback.sql"
);
const signatureLaunchGovernanceMigrationSql = await readMigration(
  "0027_add_signature_launch_governance.sql"
);
const signatureLaunchGovernanceRollbackSql = await readMigration(
  "0027_add_signature_launch_governance.rollback.sql"
);
const signatureLaunchGovernanceHardeningMigrationSql = await readMigration(
  "0028_harden_signature_launch_governance.sql"
);
const signatureLaunchGovernanceHardeningRollbackSql = await readMigration(
  "0028_harden_signature_launch_governance.rollback.sql"
);
const signatureGovernanceWorkflowMigrationSql = await readMigration(
  "0029_add_signature_governance_workflows.sql"
);
const signatureGovernanceWorkflowRollbackSql = await readMigration(
  "0029_add_signature_governance_workflows.rollback.sql"
);
const signatureGovernanceWorkflowHardeningMigrationSql = await readMigration(
  "0030_harden_signature_governance_workflow_immutability.sql"
);
const signatureGovernanceWorkflowHardeningRollbackSql = await readMigration(
  "0030_harden_signature_governance_workflow_immutability.rollback.sql"
);
const signatureLegalHoldsMigrationSql = await readMigration("0031_add_signature_legal_holds.sql");
const signatureLegalHoldsRollbackSql = await readMigration("0031_add_signature_legal_holds.rollback.sql");
const signatureBusinessGovernanceMigrationSql = await readMigration(
  "0032_correct_signature_business_governance.sql"
);
const signatureBusinessGovernanceRollbackSql = await readMigration(
  "0032_correct_signature_business_governance.rollback.sql"
);
const signaturePreflightHardeningMigrationSql = await readMigration(
  "0033_harden_signature_preflight_authorization.sql"
);
const signaturePreflightHardeningRollbackSql = await readMigration(
  "0033_harden_signature_preflight_authorization.rollback.sql"
);
const signatureOperationalUxMigrationSql = await readMigration(
  "0034_add_signature_operational_hiding.sql"
);
const signatureOperationalUxRollbackSql = await readMigration(
  "0034_add_signature_operational_hiding.rollback.sql"
);
const signatureProductizationMigrationSql = await readMigration(
  "0035_productize_boriki_sign.sql"
);
const signatureProductizationRollbackSql = await readMigration(
  "0035_productize_boriki_sign.rollback.sql"
);
const signatureHistoricalGovernanceDatesMigrationSql = await readMigration(
  "0036_allow_historical_governance_effective_dates.sql"
);
const signatureHistoricalGovernanceDatesRollbackSql = await readMigration(
  "0036_allow_historical_governance_effective_dates.rollback.sql"
);
const signatureStyleEvidenceMigrationSql = await readMigration(
  "0037_add_signature_style_evidence.sql"
);
const signatureStyleEvidenceRollbackSql = await readMigration(
  "0037_add_signature_style_evidence.rollback.sql"
);
const signaturePracticalFieldsMigrationSql = await readMigration(
  "0038_add_signature_practical_fields.sql"
);
const signaturePracticalFieldsRollbackSql = await readMigration(
  "0038_add_signature_practical_fields.rollback.sql"
);
const signaturePublicLaunchMigrationSql = await readMigration(
  "0039_add_public_launch_readiness_scope.sql"
);
const signaturePublicLaunchRollbackSql = await readMigration(
  "0039_add_public_launch_readiness_scope.rollback.sql"
);
const signatureOperationalRestoreMigrationSql = await readMigration(
  "0040_add_signature_operational_restore.sql"
);
const signatureOperationalRestoreRollbackSql = await readMigration(
  "0040_add_signature_operational_restore.rollback.sql"
);
const signatureTestCleanupMigrationSql = await readMigration(
  "0041_add_signature_test_cleanup.sql"
);
const signatureTestCleanupRollbackSql = await readMigration(
  "0041_add_signature_test_cleanup.rollback.sql"
);
const signatureFoundationDb = new PGlite();
try {
  await signatureFoundationDb.exec(`
    CREATE TABLE public.admin_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username text NOT NULL UNIQUE
    );
    CREATE TABLE public.leads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid()
    );
    CREATE TABLE public.lead_groups (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid()
    );
  `);
  await signatureFoundationDb.exec(signatureFoundationMigrationSql);
  const signatureCatalog = await signatureFoundationDb.query(`
    SELECT
      (SELECT count(*)::int FROM information_schema.tables
        WHERE table_schema='public' AND table_name LIKE 'signature_%')
        AS signature_table_count,
      EXISTS (SELECT 1 FROM pg_trigger
        WHERE tgname='signature_events_immutable_trigger')
        AS append_only_trigger,
      EXISTS (SELECT 1 FROM pg_trigger
        WHERE tgname='signature_document_versions_immutable_trigger')
        AS version_immutable_trigger,
      EXISTS (SELECT 1 FROM pg_trigger
        WHERE tgname='signature_fields_update_immutable_trigger')
        AS field_immutable_trigger
  `);
  assert.deepEqual(signatureCatalog.rows, [{
    signature_table_count: 8,
    append_only_trigger: true,
    version_immutable_trigger: true,
    field_immutable_trigger: true,
  }]);
  await signatureFoundationDb.exec(signatureSignerMigrationSql);
  const signerCatalog = await signatureFoundationDb.query(`
    SELECT
      EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='signature_participants'
          AND column_name='consent_text_sha256') AS consent_evidence,
      EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='signature_field_values'
          AND column_name='sanitized_value_payload') AS vector_payload,
      pg_get_constraintdef(oid) LIKE '%consent_accepted%'
        AND pg_get_constraintdef(oid) LIKE '%certificate_generated%' AS signer_events
      FROM pg_constraint WHERE conname='signature_events_type_check'
  `);
  assert.deepEqual(signerCatalog.rows, [{
    consent_evidence: true,
    vector_payload: true,
    signer_events: true,
  }]);
  await signatureFoundationDb.exec(signatureDeliveryMigrationSql);
  const deliveryCatalog = await signatureFoundationDb.query(`
    SELECT
      to_regclass('public.signature_document_type_approvals')::text AS approvals,
      to_regclass('public.signature_consent_versions')::text AS consents,
      to_regclass('public.signature_delivery_intents')::text AS deliveries,
      EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='signature_documents'
          AND column_name='consent_version_id') AS document_consent_binding,
      EXISTS (SELECT 1 FROM pg_trigger
        WHERE tgname='signature_consent_versions_immutable_trigger') AS consent_immutable,
      EXISTS (SELECT 1 FROM pg_trigger
        WHERE tgname='signature_type_approvals_immutable_trigger') AS approval_immutable
  `);
  assert.deepEqual(deliveryCatalog.rows, [{
    approvals: "signature_document_type_approvals",
    consents: "signature_consent_versions",
    deliveries: "signature_delivery_intents",
    document_consent_binding: true,
    consent_immutable: true,
    approval_immutable: true,
  }]);
  await signatureFoundationDb.exec(signaturePrivacyBindingMigrationSql);
  const privacyBindingCatalog = await signatureFoundationDb.query(`
    SELECT
      EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='signature_documents'
          AND column_name='privacy_disclosure_version') AS version_binding,
      EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='signature_documents'
          AND column_name='privacy_disclosure_es_pr_sha256') AS spanish_hash_binding,
      EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='signature_documents'
          AND column_name='privacy_disclosure_en_us_sha256') AS english_hash_binding
  `);
  assert.deepEqual(privacyBindingCatalog.rows, [{
    version_binding: true,
    spanish_hash_binding: true,
    english_hash_binding: true,
  }]);
  await signatureFoundationDb.exec(signaturePrivacyHistoryMigrationSql);
  const privacyHistoryCatalog = await signatureFoundationDb.query(`
    SELECT
      EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='signature_documents'
          AND column_name='privacy_disclosure_es_pr_text') AS spanish_text_snapshot,
      EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='signature_documents'
          AND column_name='privacy_disclosure_en_us_text') AS english_text_snapshot
  `);
  assert.deepEqual(privacyHistoryCatalog.rows, [{
    spanish_text_snapshot: true,
    english_text_snapshot: true,
  }]);
  await signatureFoundationDb.exec(signatureLaunchGovernanceMigrationSql);
  const launchGovernanceCatalog = await signatureFoundationDb.query(`
    SELECT
      to_regclass('public.signature_privacy_disclosure_versions')::text AS privacy_versions,
      to_regclass('public.signature_retention_policy_versions')::text AS retention_versions,
      to_regclass('public.signature_launch_authorizations')::text AS launch_authorizations,
      to_regclass('public.signature_governance_events')::text AS governance_events,
      EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='signature_governance_events_immutable_trigger') AS events_immutable
  `);
  assert.deepEqual(launchGovernanceCatalog.rows, [{
    privacy_versions: "signature_privacy_disclosure_versions",
    retention_versions: "signature_retention_policy_versions",
    launch_authorizations: "signature_launch_authorizations",
    governance_events: "signature_governance_events",
    events_immutable: true,
  }]);
  await signatureFoundationDb.exec(signatureLaunchGovernanceHardeningMigrationSql);
  const hardeningCatalog = await signatureFoundationDb.query(`SELECT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname='signature_launch_authorizations_immutable_trigger'
  ) AS launch_authorization_immutable`);
  assert.deepEqual(hardeningCatalog.rows, [{ launch_authorization_immutable: true }]);
  await signatureFoundationDb.exec(signatureGovernanceWorkflowMigrationSql);
  const workflowCatalog = await signatureFoundationDb.query(`SELECT
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='signature_document_type_approvals' AND column_name='counsel_name') AS external_counsel,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='signature_retention_policy_versions' AND column_name='policy_sha256') AS policy_hash,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='signature_governance_events' AND column_name='previous_state') AS state_audit,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='signature_launch_authorizations' AND column_name='authorized_participant_scope') AS canary_scope`);
  assert.deepEqual(workflowCatalog.rows, [{ external_counsel: true, policy_hash: true, state_audit: true, canary_scope: true }]);
  await signatureFoundationDb.exec(signatureGovernanceWorkflowHardeningMigrationSql);
  const workflowHardeningCatalog = await signatureFoundationDb.query(`SELECT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='signature_document_type_approvals' AND column_name='retired_at'
  ) AS classification_retirement`);
  assert.deepEqual(workflowHardeningCatalog.rows, [{ classification_retirement: true }]);
  await signatureFoundationDb.exec(signatureLegalHoldsMigrationSql);
  const legalHoldsCatalog = await signatureFoundationDb.query(`SELECT
    to_regclass('public.signature_legal_holds')::text AS legal_holds,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='signature_legal_holds_immutable_trigger') AS immutable`);
  assert.deepEqual(legalHoldsCatalog.rows, [{ legal_holds: 'signature_legal_holds', immutable: true }]);
  await signatureFoundationDb.exec(signatureLegalHoldsRollbackSql);
  await signatureFoundationDb.exec(signatureGovernanceWorkflowHardeningRollbackSql);
  await signatureFoundationDb.exec(signatureGovernanceWorkflowRollbackSql);
  await signatureFoundationDb.exec(signatureLaunchGovernanceHardeningRollbackSql);
  await signatureFoundationDb.exec(signatureLaunchGovernanceRollbackSql);
  await signatureFoundationDb.exec(signaturePrivacyHistoryRollbackSql);
  await signatureFoundationDb.exec(signaturePrivacyBindingRollbackSql);
  await signatureFoundationDb.exec(signatureDeliveryRollbackSql);
  await signatureFoundationDb.exec(signatureSignerRollbackSql);
  await signatureFoundationDb.exec(signatureFoundationRollbackSql);
  const signatureRollback = await signatureFoundationDb.query(`
    SELECT count(*)::int AS signature_table_count
      FROM information_schema.tables
     WHERE table_schema='public' AND table_name LIKE 'signature_%'
  `);
  assert.deepEqual(signatureRollback.rows, [{ signature_table_count: 0 }]);
  console.log("Validated the isolated signature foundation migration 0022.");
  console.log("Validated the disabled signer evidence extension migration 0023 and rollback.");
  console.log("Validated signature delivery governance migration 0024 and rollback.");
  console.log("Validated signature privacy disclosure binding migration 0025 and rollback.");
  console.log("Validated durable signature privacy disclosure history migration 0026 and rollback.");
  console.log("Validated signature launch governance migration 0027 and rollback.");
  console.log("Validated signature launch governance hardening migration 0028 and rollback.");
  console.log("Validated signature governance workflow migration 0029 and rollback guard.");
  console.log("Validated signature governance immutability hardening migration 0030 and rollback.");
  console.log("Validated persisted signature legal holds migration 0031 and rollback guard.");
  console.log("Verified governance, consent, delivery, immutable evidence, and empty rollback.");
} finally {
  await signatureFoundationDb.close();
}

const signatureBusinessGovernanceDb = new PGlite();
try {
  await signatureBusinessGovernanceDb.exec(`
    CREATE TABLE public.admin_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username text NOT NULL UNIQUE
    );
    CREATE TABLE public.leads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid()
    );
    CREATE TABLE public.lead_groups (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid()
    );
  `);
  for (const migration of [
    signatureFoundationMigrationSql,
    signatureSignerMigrationSql,
    signatureDeliveryMigrationSql,
    signaturePrivacyBindingMigrationSql,
    signaturePrivacyHistoryMigrationSql,
    signatureLaunchGovernanceMigrationSql,
    signatureLaunchGovernanceHardeningMigrationSql,
    signatureGovernanceWorkflowMigrationSql,
    signatureGovernanceWorkflowHardeningMigrationSql,
    signatureLegalHoldsMigrationSql,
    signatureBusinessGovernanceMigrationSql,
  ]) {
    await signatureBusinessGovernanceDb.exec(migration);
  }
  const businessGovernanceCatalog = await signatureBusinessGovernanceDb.query(`SELECT
    column_default LIKE '%internal_business%' AS internal_business_default,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='signature_document_type_approvals' AND column_name='phase2m_legacy') AS legacy_compatibility,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='signature_documents' AND column_name='archived_at') AS draft_archive,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='signature_document_versions' AND column_name='source_deleted_at') AS source_tombstone
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='signature_document_type_approvals'
      AND column_name='approval_mode'`);
  assert.deepEqual(businessGovernanceCatalog.rows, [{
    internal_business_default: true,
    legacy_compatibility: true,
    draft_archive: true,
    source_tombstone: true,
  }]);
  await assert.rejects(
    signatureBusinessGovernanceDb.exec(signatureBusinessGovernanceRollbackSql),
    /0032 schema rollback is intentionally blocked/
  );
  console.log("Validated business-governance correction migration 0032 and rollback guard.");
} finally {
  await signatureBusinessGovernanceDb.close();
}

const signaturePreflightHardeningDb = new PGlite();
try {
  await signaturePreflightHardeningDb.exec(`
    CREATE TABLE public.admin_users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),username text NOT NULL UNIQUE);
    CREATE TABLE public.leads (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE TABLE public.lead_groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
  `);
  for (const migration of [signatureFoundationMigrationSql,signatureSignerMigrationSql,signatureDeliveryMigrationSql,
    signaturePrivacyBindingMigrationSql,signaturePrivacyHistoryMigrationSql,signatureLaunchGovernanceMigrationSql,
    signatureLaunchGovernanceHardeningMigrationSql,signatureGovernanceWorkflowMigrationSql,signatureGovernanceWorkflowHardeningMigrationSql,
    signatureLegalHoldsMigrationSql,signatureBusinessGovernanceMigrationSql,signaturePreflightHardeningMigrationSql]) {
    await signaturePreflightHardeningDb.exec(migration);
  }
  const catalog=await signaturePreflightHardeningDb.query(`SELECT
    to_regclass('public.signature_risk_acceptances')::text risk_acceptances,
    to_regclass('public.signature_readiness_snapshots')::text readiness_snapshots,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='signature_launch_authorizations' AND column_name='authorized_locales') locale_scope,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='signature_readiness_snapshots_immutable_trigger') snapshot_immutable`);
  assert.deepEqual(catalog.rows,[{risk_acceptances:'signature_risk_acceptances',readiness_snapshots:'signature_readiness_snapshots',locale_scope:true,snapshot_immutable:true}]);
  await signaturePreflightHardeningDb.exec(signaturePreflightHardeningRollbackSql);
  console.log("Validated pre-flight and scoped-authorization hardening migration 0033 and guarded rollback.");
} finally { await signaturePreflightHardeningDb.close(); }

const signatureOperationalUxDb = new PGlite();
try {
  await signatureOperationalUxDb.exec(`
    CREATE TABLE public.admin_users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),username text NOT NULL UNIQUE);
    CREATE TABLE public.leads (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE TABLE public.lead_groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
  `);
  for (const migration of [signatureFoundationMigrationSql,signatureSignerMigrationSql,signatureDeliveryMigrationSql,
    signaturePrivacyBindingMigrationSql,signaturePrivacyHistoryMigrationSql,signatureLaunchGovernanceMigrationSql,
    signatureLaunchGovernanceHardeningMigrationSql,signatureGovernanceWorkflowMigrationSql,signatureGovernanceWorkflowHardeningMigrationSql,
    signatureLegalHoldsMigrationSql,signatureBusinessGovernanceMigrationSql,signaturePreflightHardeningMigrationSql,signatureOperationalUxMigrationSql]) {
    await signatureOperationalUxDb.exec(migration);
  }
  const catalog=await signatureOperationalUxDb.query(`SELECT
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='signature_documents' AND column_name='operationally_hidden_at') document_hiding,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='signature_participants' AND column_name='removed_at') recipient_removal,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='signature_documents_operational_hide_immutable_trigger') hide_immutable`);
  assert.deepEqual(catalog.rows,[{document_hiding:true,recipient_removal:true,hide_immutable:true}]);
  await signatureOperationalUxDb.exec(signatureOperationalUxRollbackSql);
  console.log("Validated operational signing UX migration 0034 and guarded rollback.");
} finally { await signatureOperationalUxDb.close(); }

const signatureProductizationDb = new PGlite();
try {
  await signatureProductizationDb.exec(`
    CREATE TABLE public.admin_users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),username text NOT NULL UNIQUE);
    CREATE TABLE public.leads (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE TABLE public.lead_groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
  `);
  for (const migration of [signatureFoundationMigrationSql,signatureSignerMigrationSql,signatureDeliveryMigrationSql,
    signaturePrivacyBindingMigrationSql,signaturePrivacyHistoryMigrationSql,signatureLaunchGovernanceMigrationSql,
    signatureLaunchGovernanceHardeningMigrationSql,signatureGovernanceWorkflowMigrationSql,signatureGovernanceWorkflowHardeningMigrationSql,
    signatureLegalHoldsMigrationSql,signatureBusinessGovernanceMigrationSql,signaturePreflightHardeningMigrationSql,
    signatureOperationalUxMigrationSql,signatureProductizationMigrationSql]) {
    await signatureProductizationDb.exec(migration);
  }
  const catalog=await signatureProductizationDb.query(`SELECT
    to_regclass('public.signature_templates')::text templates,
    to_regclass('public.signature_signing_settings')::text settings,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='signature_documents' AND column_name='routing_mode') routing,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='signature_participants' AND column_name='is_broker_final_signer') broker_final,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='signature_participants_broker_final_routing_trigger') broker_route_guard`);
  assert.deepEqual(catalog.rows,[{templates:'signature_templates',settings:'signature_signing_settings',routing:true,broker_final:true,broker_route_guard:true}]);
  await signatureProductizationDb.exec(signatureHistoricalGovernanceDatesMigrationSql);
  const historicalDates=await signatureProductizationDb.query(`SELECT
    pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conrelid='signature_document_type_approvals'::regclass AND conname='signature_type_approvals_time_check')) classification_time,
    pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conrelid='signature_consent_versions'::regclass AND conname='signature_consent_versions_time_check')) consent_time`);
  assert.equal(historicalDates.rows[0].classification_time.includes('effective_from'),false);
  assert.equal(historicalDates.rows[0].consent_time.includes('effective_from'),false);
  assert.match(signatureHistoricalGovernanceDatesRollbackSql,/0036 rollback is intentionally blocked/);
  await signatureProductizationDb.exec(signatureStyleEvidenceMigrationSql);
  const styleConstraint=await signatureProductizationDb.query(`SELECT pg_get_constraintdef(oid) definition
    FROM pg_constraint WHERE conrelid='signature_field_values'::regclass
      AND conname='signature_field_values_payload_check'`);
  assert.match(styleConstraint.rows[0].definition,/styleId/);
  assert.match(styleConstraint.rows[0].definition,/great-vibes/);
  assert.match(signatureStyleEvidenceRollbackSql,/rollback blocked: typed signature-style evidence already exists/);
  await signatureProductizationDb.exec(signaturePracticalFieldsMigrationSql);
  const practicalFieldsConstraint=await signatureProductizationDb.query(`SELECT pg_get_constraintdef(oid) definition
    FROM pg_constraint WHERE conrelid='signature_fields'::regclass
      AND conname='signature_fields_type_check'`);
  assert.match(practicalFieldsConstraint.rows[0].definition,/checkbox/);
  assert.match(practicalFieldsConstraint.rows[0].definition,/signer_name/);
  await signatureProductizationDb.exec(signaturePracticalFieldsRollbackSql);
  await signatureProductizationDb.exec(signaturePublicLaunchMigrationSql);
  const publicLaunchScope=await signatureProductizationDb.query(`SELECT pg_get_constraintdef(oid) definition
    FROM pg_constraint WHERE conrelid='signature_launch_authorizations'::regclass
      AND conname='signature_launch_auth_public_scope_check'`);
  assert.match(publicLaunchScope.rows[0].definition,/production_public_launch/);
  assert.match(publicLaunchScope.rows[0].definition,/authorized_participant_scope/);
  await signatureProductizationDb.exec(signatureOperationalRestoreMigrationSql);
  const operationalRestore=await signatureProductizationDb.query(`SELECT
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='signature_documents' AND column_name='operationally_restored_at') restored_column,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='signature_documents_operational_restore_immutable_trigger') immutable_trigger`);
  assert.deepEqual(operationalRestore.rows,[{restored_column:true,immutable_trigger:true}]);
  await signatureProductizationDb.exec(signatureTestCleanupMigrationSql);
  const testCleanup=await signatureProductizationDb.query(`SELECT
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='signature_test_cleanup_events') cleanup_table,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='signature_test_cleanup_events_immutable_trigger') immutable_trigger,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='signature_test_cleanup_permitted') scoped_delete_guard`);
  assert.deepEqual(testCleanup.rows,[{cleanup_table:true,immutable_trigger:true,scoped_delete_guard:true}]);
  await signatureProductizationDb.exec(signatureTestCleanupRollbackSql);
  await signatureProductizationDb.exec(signatureOperationalRestoreRollbackSql);
  await signatureProductizationDb.exec(signaturePublicLaunchRollbackSql);
  await assert.rejects(signatureProductizationDb.exec(signatureProductizationRollbackSql),/0035 rollback is intentionally blocked/);
  console.log("Validated Borikí Sign productization migration 0035 and rollback guard.");
  console.log("Validated historical governance effective dates migration 0036 and rollback guard.");
  console.log("Validated typed signature-style evidence migration 0037 and rollback guard.");
  console.log("Validated practical signing fields migration 0038 and guarded rollback.");
  console.log("Validated public launch readiness scope migration 0039 and rollback.");
  console.log("Validated operational archive restoration migration 0040 and rollback.");
  console.log("Validated scoped internal-test cleanup migration 0041 and rollback.");
} finally { await signatureProductizationDb.close(); }
