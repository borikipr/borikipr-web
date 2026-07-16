import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

async function readMigration(name) {
  return readFile(
    fileURLToPath(new URL(`../db/migrations/${name}`, import.meta.url)),
    "utf8"
  );
}

const [
  leadsSql,
  typedTablesSql,
  queueSql,
  openHouseSql,
  openHouseRollbackSql,
  hardeningSql,
  hardeningRollbackSql,
] = await Promise.all([
  readMigration("0001_create_leads.sql"),
  readMigration("0002_create_typed_lead_tables.sql"),
  readMigration("0003_extend_email_queue_for_canonical_leads.sql"),
  readMigration("0004_extend_consultas_propiedad_for_open_house_v2.sql"),
  readMigration("0004_extend_consultas_propiedad_for_open_house_v2.rollback.sql"),
  readMigration("0005_harden_consultas_propiedad.sql"),
  readMigration("0005_harden_consultas_propiedad.rollback.sql"),
]);

async function createOriginalSchema(db) {
  await db.exec(`
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
}

async function setupThrough(db, migrationNumber) {
  await db.exec(leadsSql);
  await createOriginalSchema(db);
  await db.exec(typedTablesSql);
  await db.exec(queueSql);
  if (migrationNumber >= 4) await db.exec(openHouseSql);
  if (migrationNumber >= 5) await db.exec(hardeningSql);
}

async function withDatabase(migrationNumber, callback) {
  const db = new PGlite();
  try {
    await setupThrough(db, migrationNumber);
    const lead = await db.query(
      `INSERT INTO public.leads (name, email_normalized)
       VALUES ('Synthetic Open House lead', 'open-house@example.invalid')
       RETURNING id::text`
    );
    const property = await db.query(
      `INSERT INTO public.propiedades DEFAULT VALUES RETURNING id::text`
    );
    await callback({
      db,
      leadId: lead.rows[0].id,
      propertyId: property.rows[0].id,
    });
  } finally {
    await db.close();
  }
}

function v2Values(overrides = {}) {
  return {
    leadId: randomUUID(),
    propertyId: randomUUID(),
    idempotencyKey: randomUUID(),
    sourcePath: "/listados/prueba-open-house/registro-openhouse",
    showingAt: "2026-08-01T14:00:00Z",
    showingEventKey: "property:2026-08-01T14:00:00.000Z",
    cartaKey: null,
    cartaStatus: "none",
    evidenciaKey: null,
    evidenciaStatus: "none",
    ...overrides,
  };
}

async function insertV2(db, overrides = {}) {
  const values = v2Values(overrides);
  return db.query(
    `INSERT INTO public.consultas_propiedad (
       propiedad_id, nombre, telefono, lead_id, idempotency_key, source_path,
       showing_at, showing_event_key, carta_precalificacion_key,
       carta_precalificacion_status, evidencia_fondos_key,
       evidencia_fondos_status
     ) VALUES (
       $1::uuid, 'Synthetic Open House registration', '787-555-0100',
       $2::uuid, $3::uuid, $4, $5::timestamptz, $6, $7, $8, $9, $10
     )
     RETURNING id::text, created_at`,
    [
      values.propertyId,
      values.leadId,
      values.idempotencyKey,
      values.sourcePath,
      values.showingAt,
      values.showingEventKey,
      values.cartaKey,
      values.cartaStatus,
      values.evidenciaKey,
      values.evidenciaStatus,
    ]
  );
}

async function originalConsultasCatalog(db) {
  const result = await db.query(
    `SELECT 'column' AS kind,
            concat_ws('|', ordinal_position, column_name, data_type,
                      is_nullable, coalesce(column_default, '')) AS definition
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'consultas_propiedad'
      UNION ALL
     SELECT 'constraint', concat_ws('|', conname, contype,
                                     pg_get_constraintdef(oid, true))
       FROM pg_constraint
      WHERE conrelid = 'public.consultas_propiedad'::regclass
      UNION ALL
     SELECT 'index', concat_ws('|', indexname, indexdef)
       FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'consultas_propiedad'
      ORDER BY kind, definition`
  );
  return result.rows;
}

test("0004 accepts valid V2 registrations and enforces its constraints", async (t) => {
  await withDatabase(4, async ({ db, leadId, propertyId }) => {
    const base = { leadId, propertyId };

    await t.test("valid V2 row", async () => {
      const result = await insertV2(db, {
        ...base,
        cartaKey: "open-house/submission/prequalification.pdf",
        cartaStatus: "uploaded",
      });
      assert.equal(result.rows.length, 1);
    });

    await t.test("invalid source path rejected", async () => {
      await assert.rejects(insertV2(db, { ...base, sourcePath: "/admin" }));
    });

    await t.test("showing timestamp without event key rejected", async () => {
      await assert.rejects(insertV2(db, { ...base, showingEventKey: null }));
    });

    await t.test("event key without showing timestamp rejected", async () => {
      await assert.rejects(insertV2(db, { ...base, showingAt: null }));
    });

    await t.test("event key longer than 200 characters rejected", async () => {
      await assert.rejects(
        insertV2(db, { ...base, showingEventKey: "x".repeat(201) })
      );
    });

    await t.test("invalid document status rejected", async () => {
      await assert.rejects(
        insertV2(db, { ...base, cartaStatus: "complete" })
      );
    });

    await t.test("none status with key rejected", async () => {
      await assert.rejects(
        insertV2(db, { ...base, cartaKey: "document.pdf" })
      );
    });

    await t.test("pending status without key rejected", async () => {
      await assert.rejects(
        insertV2(db, { ...base, evidenciaStatus: "pending" })
      );
    });

    await t.test("key beginning with slash rejected", async () => {
      await assert.rejects(
        insertV2(db, {
          ...base,
          cartaKey: "/document.pdf",
          cartaStatus: "pending",
        })
      );
    });

    await t.test("key containing dot-dot rejected", async () => {
      await assert.rejects(
        insertV2(db, {
          ...base,
          evidenciaKey: "open-house/../document.pdf",
          evidenciaStatus: "uploaded",
        })
      );
    });

    await t.test("key with invalid characters rejected", async () => {
      await assert.rejects(
        insertV2(db, {
          ...base,
          cartaKey: "open-house/document?.pdf",
          cartaStatus: "failed",
        })
      );
    });

    await t.test("duplicate idempotency key rejected", async () => {
      const idempotencyKey = randomUUID();
      await insertV2(db, { ...base, idempotencyKey });
      await assert.rejects(insertV2(db, { ...base, idempotencyKey }));
    });

    await t.test("same lead and event with distinct keys accepted", async () => {
      await insertV2(db, base);
      const second = await insertV2(db, base);
      assert.equal(second.rows.length, 1);
    });

    await t.test("missing lead rejected", async () => {
      await assert.rejects(insertV2(db, { ...base, leadId: randomUUID() }));
    });
  });
});

test("0004 rollback removes only its additions", async () => {
  const db = new PGlite();
  try {
    await db.exec(leadsSql);
    await createOriginalSchema(db);
    const before = await originalConsultasCatalog(db);
    await db.exec(openHouseSql);
    await db.exec(openHouseRollbackSql);
    assert.deepEqual(await originalConsultasCatalog(db), before);
    assert.ok((await db.query(`SELECT to_regclass('public.leads') AS name`)).rows[0].name);
    assert.ok((await db.query(`SELECT to_regclass('public.email_queue') AS name`)).rows[0].name);
  } finally {
    await db.close();
  }
});

test("0005 empty-table guard rejects hardening when a row exists", async () => {
  const db = new PGlite();
  try {
    await setupThrough(db, 4);
    await db.query(
      `INSERT INTO public.consultas_propiedad (nombre, telefono)
       VALUES ('Legacy synthetic row', '787-555-0199')`
    );
    await assert.rejects(db.exec(hardeningSql), /requires public\.consultas_propiedad to be empty/);
    await db.exec("ROLLBACK");
    const propertyColumn = await db.query(
      `SELECT is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'consultas_propiedad'
          AND column_name = 'propiedad_id'`
    );
    assert.equal(propertyColumn.rows[0].is_nullable, "YES");
  } finally {
    await db.close();
  }
});

test("0005 hardens the property relationship and created timestamp", async (t) => {
  await withDatabase(5, async ({ db, leadId, propertyId }) => {
    await t.test("missing property rejected", async () => {
      await assert.rejects(insertV2(db, { leadId, propertyId: null }));
    });

    await t.test("property deletion blocked while registration exists", async () => {
      const inserted = await insertV2(db, { leadId, propertyId });
      assert.equal(inserted.rows.length, 1);
      await assert.rejects(
        db.query(`DELETE FROM public.propiedades WHERE id = $1::uuid`, [propertyId])
      );
    });

    await t.test("created_at is automatic and timezone-aware", async () => {
      const result = await insertV2(db, { leadId, propertyId });
      assert.ok(result.rows[0].created_at instanceof Date);
      const catalog = await db.query(
        `SELECT data_type, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'consultas_propiedad'
            AND column_name = 'created_at'`
      );
      assert.deepEqual(catalog.rows, [{
        data_type: "timestamp with time zone",
        is_nullable: "NO",
        column_default: "now()",
      }]);
    });
  });
});

test("0005 rollback guard rejects rows and restores the original empty schema", async () => {
  const db = new PGlite();
  try {
    await setupThrough(db, 5);
    const property = await db.query(
      `INSERT INTO public.propiedades DEFAULT VALUES RETURNING id::text`
    );
    await db.query(
      `INSERT INTO public.consultas_propiedad (propiedad_id, nombre, telefono)
       VALUES ($1::uuid, 'Synthetic hardened row', '787-555-0188')`,
      [property.rows[0].id]
    );
    await assert.rejects(
      db.exec(hardeningRollbackSql),
      /rollback requires public\.consultas_propiedad to be empty/
    );
    await db.exec("ROLLBACK");
    await db.exec(`DELETE FROM public.consultas_propiedad`);
    await db.exec(hardeningRollbackSql);

    const columns = await db.query(
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'consultas_propiedad'
          AND column_name IN ('propiedad_id', 'created_at')
        ORDER BY ordinal_position`
    );
    assert.deepEqual(columns.rows, [
      {
        column_name: "propiedad_id",
        data_type: "uuid",
        is_nullable: "YES",
        column_default: null,
      },
      {
        column_name: "created_at",
        data_type: "timestamp without time zone",
        is_nullable: "YES",
        column_default: "CURRENT_TIMESTAMP",
      },
    ]);
    const fk = await db.query(
      `SELECT confdeltype
         FROM pg_constraint
        WHERE conrelid = 'public.consultas_propiedad'::regclass
          AND conname = 'consultas_propiedad_propiedad_id_fkey'`
    );
    assert.deepEqual(fk.rows, [{ confdeltype: "c" }]);
  } finally {
    await db.close();
  }
});
