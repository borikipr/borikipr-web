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
      validation_marker text NOT NULL DEFAULT 'unchanged'
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

  console.log("Validated the ordered 0001-0005 chain in an ephemeral local database.");
  console.log("Verified 0004 adds eight nullable columns, one RESTRICT FK, nine checks, and five partial indexes.");
  console.log("Verified 0004 rollback restores the original consultas_propiedad catalog only.");
  console.log("Verified 0005 forward and rollback guards reject non-empty tables.");
  console.log("Verified 0005 hardens and restores property FK, nullability, and created_at semantics.");
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
