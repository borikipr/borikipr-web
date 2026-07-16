import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  BUYER_QUALIFICATION_VALUES,
  BuyerTenantValidationError,
  isBuyerTenantPersistenceEnabled,
  parseBuyerTenantInquiryBody,
} from "../lib/leads/buyer-tenant-inquiry.ts";
import { queueBuyerTenantInternalNotification } from "../lib/leads/buyer-tenant-inquiry-postcommit.ts";
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
    nombre: "Persona Compradora",
    email: "Buyer+Original@Example.com",
    telefono: "787-555-1234",
    municipios: "San Juan y Guaynabo",
    interesPrincipal: "Comprar",
    cualificacionCompra: BUYER_QUALIFICATION_VALUES[0],
    tipoPropiedad: ["Casa", "Condominio"],
    presupuesto: "$250,000 - $450,000",
    habitaciones: "3",
    banos: "2",
    comentarios: "Comentario de prueba",
    ...overrides,
  };
}

async function withBuyerTenantDatabase(callback) {
  const db = new PGlite();
  try {
    await db.exec(leadsSql);
    await db.exec(`CREATE TABLE public.propiedades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid()
    );`);
    await db.exec(typedSql);
    const lead = await db.query(
      `INSERT INTO public.leads (
         name, email_original, email_normalized, phone_original, phone_normalized
       ) VALUES ($1, $2, $3, $4, $5)
       RETURNING id::text`,
      [
        "Persona Compradora",
        "Buyer+Original@Example.com",
        "buyer+original@example.com",
        "787-555-1234",
        "+17875551234",
      ]
    );
    await callback({ db, leadId: lead.rows[0].id });
  } finally {
    await db.close();
  }
}

async function insertInquiry(db, leadId, input) {
  return db.query(
    `INSERT INTO public.buyer_tenant_inquiries (
       lead_id, name_snapshot, email_snapshot, phone_snapshot,
       primary_interest, purchase_qualification, budget, municipalities,
       property_types, bedrooms, bathrooms, comments,
       idempotency_key, source_path
     ) VALUES (
       $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10,
       $11, $12, $13::uuid, '/contact/compradores-arrendatarios'
     ) RETURNING id::text, lead_id::text, primary_interest,
       purchase_qualification, property_types, source_path, created_at`,
    [
      leadId,
      input.name,
      input.email,
      input.phone,
      input.primaryInterest,
      input.purchaseQualification,
      input.budget,
      input.municipalities,
      input.propertyTypes,
      input.bedrooms,
      input.bathrooms,
      input.comments,
      input.idempotencyKey,
    ]
  );
}

test("current buyer qualification values are allowlisted exactly", () => {
  assert.deepEqual([...BUYER_QUALIFICATION_VALUES], [
    "Cuento con una carta de precalificación vigente.",
    "Estoy en proceso de obtener mi carta de precalificación.",
    "Aún no he iniciado el proceso con una institución financiera.",
    "La compra sería en efectivo.",
    "Utilizaré otro método o programa de ayuda.",
  ]);
});

test("valid buyer inquiry preserves snapshots and fits the typed table", async () => {
  const parsed = parseBuyerTenantInquiryBody(baseBody());
  assert.equal(parsed.email, "Buyer+Original@Example.com");
  assert.equal(parsed.phone, "787-555-1234");
  assert.deepEqual(parsed.propertyTypes, ["Casa", "Condominio"]);

  await withBuyerTenantDatabase(async ({ db, leadId }) => {
    const result = await insertInquiry(db, leadId, parsed);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].lead_id, leadId);
    assert.equal(result.rows[0].primary_interest, "Comprar");
    assert.equal(result.rows[0].purchase_qualification, parsed.purchaseQualification);
    assert.equal(
      result.rows[0].source_path,
      "/contact/compradores-arrendatarios"
    );
  });
});

test("valid renter inquiry omits purchase qualification", async () => {
  const parsed = parseBuyerTenantInquiryBody(
    baseBody({
      interesPrincipal: "Alquilar",
      cualificacionCompra: null,
      email: "",
      tipoPropiedad: [],
      habitaciones: "",
      banos: "",
      comentarios: "",
    })
  );
  assert.equal(parsed.email, null);
  assert.equal(parsed.purchaseQualification, null);
  assert.equal(parsed.propertyTypes, null);

  await withBuyerTenantDatabase(async ({ db, leadId }) => {
    const result = await insertInquiry(db, leadId, parsed);
    assert.equal(result.rows[0].primary_interest, "Alquilar");
    assert.equal(result.rows[0].purchase_qualification, null);
  });
});

const rejectionCases = [
  ["missing name", { nombre: "" }, "missing_nombre"],
  ["missing phone", { telefono: "" }, "missing_telefono"],
  ["buyer requires qualification", { cualificacionCompra: "" }, "missing_purchase_qualification"],
  ["buyer rejects an unknown qualification", { cualificacionCompra: "Otra respuesta" }, "invalid_purchase_qualification"],
  ["renter rejects qualification", { interesPrincipal: "Alquilar" }, "unexpected_purchase_qualification"],
  ["invalid optional email", { email: "not-an-email" }, "invalid_email"],
  ["missing municipality", { municipios: "" }, "missing_municipios"],
  ["missing budget", { presupuesto: "" }, "missing_presupuesto"],
  ["invalid interest", { interesPrincipal: "Explorar" }, "invalid_interest"],
  ["invalid property-type array", { tipoPropiedad: ["Castillo"] }, "invalid_property_types"],
  ["malformed property-type value", { tipoPropiedad: "Casa" }, "invalid_property_types"],
  ["invalid bedrooms", { habitaciones: "5" }, "invalid_bedrooms"],
  ["invalid bathrooms", { banos: "4" }, "invalid_bathrooms"],
  ["missing idempotency UUID", { idempotencyKey: "" }, "missing_idempotencyKey"],
  ["invalid idempotency UUID", { idempotencyKey: "not-a-uuid" }, "invalid_idempotency_key"],
];

for (const [name, overrides, reason] of rejectionCases) {
  test(name, () => {
    assert.throws(
      () => parseBuyerTenantInquiryBody(baseBody(overrides)),
      (error) =>
        error instanceof BuyerTenantValidationError && error.reason === reason
    );
  });
}

test("direct malformed text and overlong text are rejected", () => {
  assert.throws(
    () => parseBuyerTenantInquiryBody(baseBody({ nombre: { value: "Persona" } })),
    BuyerTenantValidationError
  );
  assert.throws(
    () => parseBuyerTenantInquiryBody(baseBody({ comentarios: "x".repeat(4001) })),
    BuyerTenantValidationError
  );
});

test("same buyer inquiry idempotency key leaves one typed row", async () => {
  await withBuyerTenantDatabase(async ({ db, leadId }) => {
    const parsed = parseBuyerTenantInquiryBody(baseBody());
    await insertInquiry(db, leadId, parsed);
    await assert.rejects(insertInquiry(db, leadId, parsed));
    const count = await db.query(
      `SELECT count(*)::int AS count FROM public.buyer_tenant_inquiries
       WHERE idempotency_key=$1::uuid`,
      [parsed.idempotencyKey]
    );
    assert.equal(count.rows[0].count, 1);
  });
});

test("concurrent duplicate buyer inquiry inserts leave one typed row", async () => {
  await withBuyerTenantDatabase(async ({ db, leadId }) => {
    const parsed = parseBuyerTenantInquiryBody(baseBody());
    const results = await Promise.allSettled([
      insertInquiry(db, leadId, parsed),
      insertInquiry(db, leadId, parsed),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
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
          const lead = this.seed(input.name, input.emailOriginal, input.phoneOriginal);
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

test("buyer inquiry reuses an existing canonical lead", async () => {
  const store = new ResolverStore();
  const existing = store.seed(
    "Persona Compradora",
    "buyer@example.com",
    "787-555-1234"
  );
  const result = await createLeadResolver(store).resolveOrCreate({
    name: "Persona Compradora",
    email: "BUYER@example.com",
    phone: "+1 787 555 1234",
  });
  assert.equal(result.lead.id, existing.id);
  assert.equal(result.outcome, "matched");
});

for (const [kind, email, phone] of [
  ["phone", "new@example.com", "787-555-1234"],
  ["email", "shared@example.com", "787-555-5678"],
]) {
  test(`shared ${kind} with a materially different name creates a conflict lead`, async () => {
    const store = new ResolverStore();
    const existing = store.seed(
      "Persona Uno",
      kind === "email" ? "shared@example.com" : null,
      kind === "phone" ? "787-555-1234" : null
    );
    const result = await createLeadResolver(store).resolveOrCreate({
      name: "Persona Dos",
      email,
      phone,
    });
    assert.notEqual(result.lead.id, existing.id);
    assert.equal(result.outcome, "conflict_created");
  });
}

test("conflicting email and phone that point to different leads create a conflict lead", async () => {
  const store = new ResolverStore();
  const emailLead = store.seed("Persona Compradora", "one@example.com", null);
  const phoneLead = store.seed("Persona Compradora", null, "787-555-1234");
  const result = await createLeadResolver(store).resolveOrCreate({
    name: "Persona Compradora",
    email: "one@example.com",
    phone: "787-555-1234",
  });
  assert.notEqual(result.lead.id, emailLead.id);
  assert.notEqual(result.lead.id, phoneLead.id);
  assert.equal(result.outcome, "conflict_created");
});

function makeInquiry(overrides = {}) {
  return {
    id: randomUUID(),
    leadId: randomUUID(),
    created: true,
    nameSnapshot: "Persona <Compradora>",
    emailSnapshot: "buyer@example.com",
    phoneSnapshot: "787-555-1234",
    primaryInterest: "Comprar",
    purchaseQualification: BUYER_QUALIFICATION_VALUES[0],
    budget: "$250,000 - $450,000",
    municipalities: "San Juan",
    propertyTypes: ["Casa"],
    bedrooms: "3",
    bathrooms: "2",
    comments: "Comentario <script>alert(1)</script>",
    createdAt: new Date(),
    ...overrides,
  };
}

test("queue failure after commit keeps the durable buyer inquiry", async () => {
  const inquiry = makeInquiry();
  const errors = [];
  const state = await queueBuyerTenantInternalNotification({
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

test("successful buyer notification has canonical dedupe fields and escaped HTML", async () => {
  const inquiry = makeInquiry();
  let queued;
  const state = await queueBuyerTenantInternalNotification({
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
  assert.equal(queued.relatedSubmissionType, "buyer_tenant_inquiry");
  assert.equal(queued.relatedSubmissionId, inquiry.id);
  assert.equal(
    queued.dedupeKey,
    `buyer_tenant_inquiry:${inquiry.id}:internal:v1`
  );
  assert.equal(queued.emailType, "buyer_tenant_inquiry_internal");
  assert.equal("relatedLeadId" in queued, false);
  assert.match(queued.html, /Persona &lt;Compradora&gt;/);
  assert.match(queued.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(queued.html, /<script>/);
});

test("renter email excludes the purchase qualification section", async () => {
  const inquiry = makeInquiry({
    primaryInterest: "Alquilar",
    purchaseQualification: null,
  });
  let queued;
  await queueBuyerTenantInternalNotification({
    inquiry,
    recipient: "internal@example.invalid",
    enqueue: async (input) => (queued = input),
    onError: () => assert.fail("queue should not fail"),
  });
  assert.doesNotMatch(queued.html, /Cualificación para compra/);
});

test("existing Priority Registration queue FK and timestamps remain compatible", async () => {
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
        recipient text NOT NULL, subject text NOT NULL, html text NOT NULL,
        email_type text NOT NULL, related_property_id uuid NULL,
        related_lead_id uuid NULL REFERENCES public.property_priority_registrations(id) ON DELETE SET NULL,
        status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0,
        last_error text NULL, sent_at timestamptz NULL, locked_at timestamptz NULL,
        locked_by text NULL, created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    const priority = await db.query(
      `INSERT INTO public.property_priority_registrations DEFAULT VALUES RETURNING id::text`
    );
    const legacy = await db.query(
      `INSERT INTO public.email_queue (
         recipient, subject, html, email_type, related_lead_id
       ) VALUES ('priority@example.invalid', 'Priority', '<p>Priority</p>',
         'priority_registration_confirmation', $1::uuid)
       RETURNING id::text, created_at, updated_at`,
      [priority.rows[0].id]
    );
    await db.exec(queueSql);
    const after = await db.query(
      `SELECT related_lead_id::text, canonical_lead_id, dedupe_key,
              created_at, updated_at
       FROM public.email_queue WHERE id=$1::uuid`,
      [legacy.rows[0].id]
    );
    assert.equal(after.rows[0].related_lead_id, priority.rows[0].id);
    assert.equal(after.rows[0].canonical_lead_id, null);
    assert.equal(after.rows[0].dedupe_key, null);
    assert.equal(after.rows[0].created_at.getTime(), legacy.rows[0].created_at.getTime());
    assert.equal(after.rows[0].updated_at.getTime(), legacy.rows[0].updated_at.getTime());
  } finally {
    await db.close();
  }
});

test("Buyer/Tenant feature flag is enabled only by the exact true value", () => {
  const previous = process.env.BUYER_TENANT_PERSISTENCE_V1;
  try {
    delete process.env.BUYER_TENANT_PERSISTENCE_V1;
    assert.equal(isBuyerTenantPersistenceEnabled(), false);
    process.env.BUYER_TENANT_PERSISTENCE_V1 = "false";
    assert.equal(isBuyerTenantPersistenceEnabled(), false);
    process.env.BUYER_TENANT_PERSISTENCE_V1 = "TRUE";
    assert.equal(isBuyerTenantPersistenceEnabled(), false);
    process.env.BUYER_TENANT_PERSISTENCE_V1 = "true";
    assert.equal(isBuyerTenantPersistenceEnabled(), true);
  } finally {
    if (previous === undefined) delete process.env.BUYER_TENANT_PERSISTENCE_V1;
    else process.env.BUYER_TENANT_PERSISTENCE_V1 = previous;
  }
});
