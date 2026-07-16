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

const [leadsMigrationSql, typedTablesMigrationSql] = await Promise.all([
  readMigration("0001_create_leads.sql"),
  readMigration("0002_create_typed_lead_tables.sql"),
]);

async function withTypedTables(callback) {
  const db = new PGlite();
  try {
    await db.exec(leadsMigrationSql);
    await db.exec(
      `CREATE TABLE public.propiedades (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid()
       );`
    );
    await db.exec(typedTablesMigrationSql);

    const lead = await db.query(
      `INSERT INTO public.leads (name, email_normalized)
       VALUES ($1, $2)
       RETURNING id::text`,
      ["Typed table test lead", "typed-table-test@example.invalid"]
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

function propertyBuyerProfileValues(overrides = {}) {
  return {
    idempotencyKey: randomUUID(),
    purchaseMethod: "Financiamiento",
    solarAcceptance: "yes",
    documentType: "prequalification_letter",
    documentSize: 1024,
    ...overrides,
  };
}

async function insertPropertyBuyerProfile(db, leadId, propertyId, overrides) {
  const values = propertyBuyerProfileValues(overrides);
  return db.query(
    `INSERT INTO public.property_buyer_profiles (
       lead_id, property_id, name_snapshot, email_snapshot, phone_snapshot,
       purchase_method, solar_contract_acceptance, document_type,
       document_size_bytes, document_status, idempotency_key, source_path
     ) VALUES (
       $1::uuid, $2::uuid, 'Buyer Snapshot', 'buyer@example.invalid',
       '787-555-1000', $3, $4, $5, $6, 'uploaded', $7::uuid,
       '/listados/test/perfil-comprador'
     )
     RETURNING id::text, document_status, created_at`,
    [
      leadId,
      propertyId,
      values.purchaseMethod,
      values.solarAcceptance,
      values.documentType,
      values.documentSize,
      values.idempotencyKey,
    ]
  );
}

test("property_buyer_profiles constraints and foreign keys", async (t) => {
  await withTypedTables(async ({ db, leadId, propertyId }) => {
    await t.test("valid insert", async () => {
      const result = await insertPropertyBuyerProfile(db, leadId, propertyId);
      assert.equal(result.rows.length, 1);
      assert.equal(result.rows[0].document_status, "uploaded");
      assert.ok(result.rows[0].created_at);
    });

    await t.test("invalid purchase method rejected", async () => {
      await assert.rejects(
        insertPropertyBuyerProfile(db, leadId, propertyId, {
          purchaseMethod: "Efectivo",
        })
      );
    });

    await t.test("invalid solar answer rejected", async () => {
      await assert.rejects(
        insertPropertyBuyerProfile(db, leadId, propertyId, {
          solarAcceptance: "maybe",
        })
      );
    });

    await t.test("invalid document type rejected", async () => {
      await assert.rejects(
        insertPropertyBuyerProfile(db, leadId, propertyId, {
          documentType: "other",
        })
      );
    });

    await t.test("negative document size rejected", async () => {
      await assert.rejects(
        insertPropertyBuyerProfile(db, leadId, propertyId, {
          documentSize: -1,
        })
      );
    });

    await t.test("duplicate idempotency key rejected", async () => {
      const idempotencyKey = randomUUID();
      await insertPropertyBuyerProfile(db, leadId, propertyId, {
        idempotencyKey,
      });
      await assert.rejects(
        insertPropertyBuyerProfile(db, leadId, propertyId, {
          idempotencyKey,
        })
      );
    });

    await t.test("missing lead rejected", async () => {
      await assert.rejects(
        insertPropertyBuyerProfile(db, randomUUID(), propertyId)
      );
    });

    await t.test("missing property rejected", async () => {
      await assert.rejects(
        insertPropertyBuyerProfile(db, leadId, randomUUID())
      );
    });
  });
});

async function insertSellerLandlord(db, leadId, overrides = {}) {
  const values = {
    idempotencyKey: randomUUID(),
    propertyType: "Casa",
    primaryReason: "Vender",
    ...overrides,
  };
  return db.query(
    `INSERT INTO public.seller_landlord_inquiries (
       lead_id, name_snapshot, email_snapshot, phone_snapshot, property_type,
       location, primary_reason, idempotency_key, source_path
     ) VALUES (
       $1::uuid, 'Seller Snapshot', 'seller@example.invalid', '787-555-2000',
       $2, 'Ponce', $3, $4::uuid, '/contact/vendedor-arrendador'
     )
     RETURNING id::text`,
    [leadId, values.propertyType, values.primaryReason, values.idempotencyKey]
  );
}

test("seller_landlord_inquiries constraints and foreign keys", async (t) => {
  await withTypedTables(async ({ db, leadId }) => {
    await t.test("valid insert", async () => {
      const result = await insertSellerLandlord(db, leadId);
      assert.equal(result.rows.length, 1);
    });

    await t.test("invalid property type rejected", async () => {
      await assert.rejects(
        insertSellerLandlord(db, leadId, { propertyType: "Castillo" })
      );
    });

    await t.test("invalid primary reason rejected", async () => {
      await assert.rejects(
        insertSellerLandlord(db, leadId, { primaryReason: "Demoler" })
      );
    });

    await t.test("duplicate idempotency key rejected", async () => {
      const idempotencyKey = randomUUID();
      await insertSellerLandlord(db, leadId, { idempotencyKey });
      await assert.rejects(
        insertSellerLandlord(db, leadId, { idempotencyKey })
      );
    });

    await t.test("missing lead rejected", async () => {
      await assert.rejects(insertSellerLandlord(db, randomUUID()));
    });
  });
});

async function insertBuyerTenant(db, leadId, overrides = {}) {
  const values = {
    idempotencyKey: randomUUID(),
    primaryInterest: "Comprar",
    bedrooms: "3",
    bathrooms: "2",
    propertyTypesSql: "ARRAY['Casa', 'Condominio']::text[]",
    purchaseQualification:
      "Cuento con una carta de precalificación vigente.",
    ...overrides,
  };
  return db.query(
    `INSERT INTO public.buyer_tenant_inquiries (
       lead_id, name_snapshot, email_snapshot, phone_snapshot,
       primary_interest, purchase_qualification, property_types, bedrooms,
       bathrooms, idempotency_key, source_path
     ) VALUES (
       $1::uuid, 'Tenant Snapshot', 'tenant@example.invalid', '787-555-3000',
       $2, $3, ${values.propertyTypesSql}, $4, $5, $6::uuid,
       '/contact/compradores-arrendatarios'
     )
     RETURNING id::text`,
    [
      leadId,
      values.primaryInterest,
      values.purchaseQualification,
      values.bedrooms,
      values.bathrooms,
      values.idempotencyKey,
    ]
  );
}

test("buyer_tenant_inquiries constraints and foreign keys", async (t) => {
  await withTypedTables(async ({ db, leadId }) => {
    await t.test("valid insert", async () => {
      const result = await insertBuyerTenant(db, leadId);
      assert.equal(result.rows.length, 1);
    });

    await t.test("current purchase qualification text remains accepted", async () => {
      const result = await insertBuyerTenant(db, leadId, {
        purchaseQualification:
          "Estoy en proceso de obtener mi carta de precalificación.",
      });
      assert.equal(result.rows.length, 1);
    });

    await t.test("invalid interest rejected", async () => {
      await assert.rejects(
        insertBuyerTenant(db, leadId, { primaryInterest: "Invertir" })
      );
    });

    await t.test("invalid property type array rejected", async () => {
      await assert.rejects(
        insertBuyerTenant(db, leadId, {
          propertyTypesSql: "ARRAY['Casa', 'Castillo']::text[]",
        })
      );
    });

    await t.test("invalid bedroom value rejected", async () => {
      await assert.rejects(
        insertBuyerTenant(db, leadId, { bedrooms: "5" })
      );
    });

    await t.test("invalid bathroom value rejected", async () => {
      await assert.rejects(
        insertBuyerTenant(db, leadId, { bathrooms: "4" })
      );
    });

    await t.test("duplicate idempotency key rejected", async () => {
      const idempotencyKey = randomUUID();
      await insertBuyerTenant(db, leadId, { idempotencyKey });
      await assert.rejects(insertBuyerTenant(db, leadId, { idempotencyKey }));
    });

    await t.test("missing lead rejected", async () => {
      await assert.rejects(insertBuyerTenant(db, randomUUID()));
    });
  });
});
