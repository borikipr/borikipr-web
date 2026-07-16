import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  parseSellerLandlordInquiryBody,
  SellerLandlordValidationError,
} from "../lib/leads/seller-landlord-inquiry.ts";
import { queueSellerLandlordInternalNotification } from "../lib/leads/seller-landlord-inquiry-postcommit.ts";
import { createLeadResolver } from "../lib/leads/resolver.ts";
import {
  normalizeEmail,
  normalizePuertoRicoUsPhone,
} from "../lib/leads/normalization.ts";

async function readMigration(name) {
  return readFile(
    fileURLToPath(new URL(`../db/migrations/${name}`, import.meta.url)),
    "utf8"
  );
}

const [leadsSql, typedSql, queueSql] = await Promise.all([
  readMigration("0001_create_leads.sql"),
  readMigration("0002_create_typed_lead_tables.sql"),
  readMigration("0003_extend_email_queue_for_canonical_leads.sql"),
]);

function baseBody(overrides = {}) {
  return {
    idempotencyKey: randomUUID(),
    nombre: "Persona Vendedora",
    email: "Seller+Original@Example.com",
    telefono: "787-555-1234",
    tipoPropiedad: "Propiedad Comercial",
    ubicacion: "Ponce",
    razonVenta: "Vender",
    comentarios: "Comentario de prueba",
    ...overrides,
  };
}

async function withSellerDatabase(callback) {
  const db = new PGlite();
  try {
    await db.exec(leadsSql);
    await db.exec(`
      CREATE TABLE public.propiedades (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid()
      );
    `);
    await db.exec(typedSql);
    const lead = await db.query(
      `INSERT INTO public.leads (
         name, email_original, email_normalized, phone_original, phone_normalized
       ) VALUES ($1, $2, $3, $4, $5)
       RETURNING id::text`,
      [
        "Persona Vendedora",
        "Seller+Original@Example.com",
        "seller+original@example.com",
        "787-555-1234",
        "+17875551234",
      ]
    );
    await callback({ db, leadId: lead.rows[0].id });
  } finally {
    await db.close();
  }
}

async function insertSellerInquiry(db, leadId, input) {
  return db.query(
    `INSERT INTO public.seller_landlord_inquiries (
       lead_id, name_snapshot, email_snapshot, phone_snapshot,
       property_type, location, primary_reason, comments,
       idempotency_key, source_path
     ) VALUES (
       $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::uuid,
       '/contact/vendedor-arrendador'
     )
     RETURNING id::text, lead_id::text, property_type, source_path, created_at`,
    [
      leadId,
      input.name,
      input.email,
      input.phone,
      input.propertyType,
      input.location,
      input.primaryReason,
      input.comments,
      input.idempotencyKey,
    ]
  );
}

test("valid seller inquiry preserves snapshots and fits the typed table", async () => {
  const parsed = parseSellerLandlordInquiryBody(baseBody());
  assert.equal(parsed.email, "Seller+Original@Example.com");
  assert.equal(parsed.phone, "787-555-1234");
  assert.equal(parsed.propertyType, "Propiedad comercial");

  await withSellerDatabase(async ({ db, leadId }) => {
    const result = await insertSellerInquiry(db, leadId, parsed);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].lead_id, leadId);
    assert.equal(result.rows[0].property_type, "Propiedad comercial");
    assert.equal(
      result.rows[0].source_path,
      "/contact/vendedor-arrendador"
    );
    assert.ok(result.rows[0].created_at);
  });
});

test("duplicate seller idempotency key leaves one inquiry", async () => {
  await withSellerDatabase(async ({ db, leadId }) => {
    const parsed = parseSellerLandlordInquiryBody(baseBody());
    await insertSellerInquiry(db, leadId, parsed);
    await assert.rejects(insertSellerInquiry(db, leadId, parsed));
    const count = await db.query(
      `SELECT count(*)::int AS count
         FROM public.seller_landlord_inquiries
        WHERE idempotency_key=$1::uuid`,
      [parsed.idempotencyKey]
    );
    assert.equal(count.rows[0].count, 1);
  });
});

test("concurrent duplicate seller inserts leave one inquiry", async () => {
  await withSellerDatabase(async ({ db, leadId }) => {
    const parsed = parseSellerLandlordInquiryBody(baseBody());
    const results = await Promise.allSettled([
      insertSellerInquiry(db, leadId, parsed),
      insertSellerInquiry(db, leadId, parsed),
    ]);
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1
    );
    assert.equal(
      results.filter((result) => result.status === "rejected").length,
      1
    );
    const count = await db.query(
      `SELECT count(*)::int AS count
         FROM public.seller_landlord_inquiries
        WHERE idempotency_key=$1::uuid`,
      [parsed.idempotencyKey]
    );
    assert.equal(count.rows[0].count, 1);
  });
});

class ResolverStore {
  leads = [];
  tail = Promise.resolve();

  seed(name, email, phone) {
    const now = new Date();
    const lead = {
      id: randomUUID(),
      name,
      emailOriginal: email,
      emailNormalized: normalizeEmail(email),
      phoneOriginal: phone,
      phoneNormalized: normalizePuertoRicoUsPhone(phone),
      status: "new",
      identityStatus: "provisional",
      firstSeenAt: now,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
      mergedIntoLeadId: null,
    };
    this.leads.push(lead);
    return lead;
  }

  async withTransaction(callback) {
    const previous = this.tail;
    let release;
    this.tail = new Promise((resolve) => (release = resolve));
    await previous;
    try {
      return await callback({
        lockIdentityKeys: async () => {},
        findCandidates: async (identity) =>
          this.leads.filter(
            (lead) =>
              (identity.emailNormalized &&
                lead.emailNormalized === identity.emailNormalized) ||
              (identity.phoneNormalized &&
                lead.phoneNormalized === identity.phoneNormalized)
          ),
        insertLead: async (input) => {
          const lead = this.seed(
            input.name,
            input.emailOriginal,
            input.phoneOriginal
          );
          lead.identityStatus = input.identityStatus;
          return lead;
        },
        markMatched: async (id) => {
          const lead = this.leads.find((item) => item.id === id);
          lead.identityStatus = "matched";
          lead.lastActivityAt = new Date();
          lead.updatedAt = new Date();
          return lead;
        },
      });
    } finally {
      release();
    }
  }
}

test("seller inquiry reuses an existing canonical lead", async () => {
  const store = new ResolverStore();
  const existing = store.seed(
    "Persona Vendedora",
    "seller@example.com",
    "787-555-1234"
  );
  const result = await createLeadResolver(store).resolveOrCreate({
    name: "Persona Vendedora",
    email: "SELLER@example.com",
    phone: "+1 787 555 1234",
  });
  assert.equal(result.lead.id, existing.id);
  assert.equal(result.outcome, "matched");
  assert.ok(result.lead.lastActivityAt >= existing.firstSeenAt);
});

test("seller inquiry sharing a phone with a different name creates a conflict lead", async () => {
  const store = new ResolverStore();
  const existing = store.seed("Persona Uno", null, "787-555-1234");
  const result = await createLeadResolver(store).resolveOrCreate({
    name: "Persona Dos",
    email: "persona-dos@example.com",
    phone: "787-555-1234",
  });
  assert.notEqual(result.lead.id, existing.id);
  assert.equal(result.outcome, "conflict_created");
  assert.equal(result.lead.identityStatus, "conflict");
});

test("seller inquiry sharing an email with a different name creates a conflict lead", async () => {
  const store = new ResolverStore();
  const existing = store.seed("Persona Uno", "shared@example.com", null);
  const result = await createLeadResolver(store).resolveOrCreate({
    name: "Persona Dos",
    email: "SHARED@example.com",
    phone: "787-555-5678",
  });
  assert.notEqual(result.lead.id, existing.id);
  assert.equal(result.outcome, "conflict_created");
  assert.equal(result.lead.identityStatus, "conflict");
});

test("seller inquiry rejects a missing or invalid idempotency UUID", () => {
  assert.throws(
    () => parseSellerLandlordInquiryBody(baseBody({ idempotencyKey: "" })),
    SellerLandlordValidationError
  );
  assert.throws(
    () =>
      parseSellerLandlordInquiryBody(
        baseBody({ idempotencyKey: "not-a-uuid" })
      ),
    SellerLandlordValidationError
  );
});

function makeInquiry(overrides = {}) {
  return {
    id: randomUUID(),
    leadId: randomUUID(),
    created: true,
    nameSnapshot: "Persona Vendedora",
    emailSnapshot: "seller@example.com",
    phoneSnapshot: "787-555-1234",
    propertyType: "Casa",
    location: "Ponce",
    primaryReason: "Vender",
    comments: "Comentario de prueba",
    createdAt: new Date(),
    ...overrides,
  };
}

test("seller queue failure keeps the durable inquiry", async () => {
  const inquiry = makeInquiry();
  const errors = [];
  const state = await queueSellerLandlordInternalNotification({
    inquiry,
    recipient: "internal@example.invalid",
    enqueue: async () => {
      throw new Error("queue unavailable");
    },
    onError: (stage) => errors.push(stage),
  });
  assert.equal(state, "failed_to_queue");
  assert.deepEqual(errors, ["queue_insert"]);
  assert.ok(inquiry.id);
  assert.ok(inquiry.leadId);
});

test("seller notification queues canonical relationships and branded content", async () => {
  const inquiry = makeInquiry();
  let queued;
  const state = await queueSellerLandlordInternalNotification({
    inquiry,
    recipient: "internal@example.invalid",
    enqueue: async (input) => {
      queued = input;
      return "queued";
    },
    onError: () => assert.fail("queue should not fail"),
  });
  assert.equal(state, "queued");
  assert.equal(queued.canonicalLeadId, inquiry.leadId);
  assert.equal(queued.relatedSubmissionType, "seller_landlord_inquiry");
  assert.equal(queued.relatedSubmissionId, inquiry.id);
  assert.equal(
    queued.dedupeKey,
    `seller_landlord_inquiry:${inquiry.id}:internal:v1`
  );
  assert.equal(queued.emailType, "seller_landlord_inquiry_internal");
  assert.match(queued.html, /Nueva solicitud de vendedor o arrendador/);
  assert.match(queued.html, /Persona Vendedora/);
  assert.match(queued.html, /Ponce/);
  assert.match(queued.html, /Vender/);
  assert.equal("relatedLeadId" in queued, false);
});

test("seller canonical queue support preserves legacy Priority queue behavior", async () => {
  const db = new PGlite();
  try {
    await db.exec(leadsSql);
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
        related_property_id uuid NULL,
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
    `);
    const priority = await db.query(
      `INSERT INTO public.property_priority_registrations DEFAULT VALUES
       RETURNING id::text`
    );
    const legacy = await db.query(
      `INSERT INTO public.email_queue (
         recipient, subject, html, email_type, related_lead_id
       ) VALUES (
         'priority@example.invalid', 'Priority', '<p>Priority</p>',
         'priority_registration_confirmation', $1::uuid
       ) RETURNING id::text, created_at, updated_at`,
      [priority.rows[0].id]
    );

    await db.exec(queueSql);

    const lead = await db.query(
      `INSERT INTO public.leads (name, email_normalized)
       VALUES ('Seller queue test', 'seller-queue@example.invalid')
       RETURNING id::text`
    );
    const submissionId = randomUUID();
    await db.query(
      `INSERT INTO public.email_queue (
         recipient, subject, html, email_type, related_lead_id,
         canonical_lead_id, related_submission_type,
         related_submission_id, dedupe_key
       ) VALUES (
         'internal@example.invalid', 'Seller', '<p>Seller</p>',
         'seller_landlord_inquiry_internal', NULL, $1::uuid,
         'seller_landlord_inquiry', $2::uuid, $3
       )`,
      [
        lead.rows[0].id,
        submissionId,
        `seller_landlord_inquiry:${submissionId}:internal:v1`,
      ]
    );

    const legacyAfter = await db.query(
      `SELECT related_lead_id::text, canonical_lead_id, dedupe_key,
              created_at, updated_at
         FROM public.email_queue
        WHERE id=$1::uuid`,
      [legacy.rows[0].id]
    );
    assert.equal(legacyAfter.rows[0].related_lead_id, priority.rows[0].id);
    assert.equal(legacyAfter.rows[0].canonical_lead_id, null);
    assert.equal(legacyAfter.rows[0].dedupe_key, null);
    assert.equal(
      legacyAfter.rows[0].created_at.getTime(),
      legacy.rows[0].created_at.getTime()
    );
    assert.equal(
      legacyAfter.rows[0].updated_at.getTime(),
      legacy.rows[0].updated_at.getTime()
    );

    const legacyFk = await db.query(
      `SELECT target.relname AS target_table, con.confdeltype
         FROM pg_constraint con
         JOIN pg_class target ON target.oid=con.confrelid
        WHERE con.conrelid='public.email_queue'::regclass
          AND con.conname='email_queue_related_lead_id_fkey'`
    );
    assert.deepEqual(legacyFk.rows, [
      { target_table: "property_priority_registrations", confdeltype: "n" },
    ]);

    const canonical = await db.query(
      `SELECT related_lead_id, canonical_lead_id::text,
              related_submission_type, related_submission_id::text,
              dedupe_key
         FROM public.email_queue
        WHERE related_submission_type='seller_landlord_inquiry'`
    );
    assert.equal(canonical.rows.length, 1);
    assert.equal(canonical.rows[0].related_lead_id, null);
    assert.equal(canonical.rows[0].canonical_lead_id, lead.rows[0].id);
    assert.equal(canonical.rows[0].related_submission_id, submissionId);
  } finally {
    await db.close();
  }
});
