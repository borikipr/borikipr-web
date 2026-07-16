import assert from "node:assert/strict";
import { File as NodeFile } from "node:buffer";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  buildBuyerProfileDocumentObjectKey,
  BuyerProfileValidationError,
  parsePropertyBuyerProfileFormData,
  validateBuyerProfileForProperty,
} from "../lib/leads/property-buyer-profile.ts";
import {
  queueBuyerProfileInternalNotification,
  settleBuyerProfileDocument,
} from "../lib/leads/property-buyer-profile-postcommit.ts";
import { createLeadResolver } from "../lib/leads/resolver.ts";
import {
  normalizeEmail,
  normalizePuertoRicoUsPhone,
} from "../lib/leads/normalization.ts";

if (!globalThis.File) {
  globalThis.File = NodeFile;
}

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

function baseForm(overrides = {}) {
  const values = {
    idempotencyKey: randomUUID(),
    propertyId: randomUUID(),
    propertySlug: "casa-prueba",
    propertyTitle: "Casa prueba",
    nombre: "Persona Prueba",
    telefono: "787-555-1234",
    email: "Person+Buyer@Example.com",
    metodoCompra: "Financiamiento",
    metodoCompraOtro: "",
    institucionFinanciera: "Banco Prueba",
    fondosCierre: "SÃ­",
    solarContractAcceptance: "",
    comentarios: "Comentario de prueba",
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value instanceof NodeFile) {
      form.set(key, value);
    } else {
      form.set(key, String(value));
    }
  }
  return form;
}

async function withProfileDatabase(callback) {
  const db = new PGlite();
  try {
    await db.exec(leadsSql);
    await db.exec(`
      CREATE TABLE public.propiedades (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug text NOT NULL,
        titulo text NOT NULL,
        municipio text NOT NULL,
        estado text NOT NULL,
        placas_en_lease boolean NOT NULL DEFAULT false
      );
    `);
    await db.exec(typedSql);
    const lead = await db.query(
      `INSERT INTO public.leads (
         name, email_original, email_normalized, phone_original, phone_normalized
       ) VALUES ($1, $2, $3, $4, $5) RETURNING id::text`,
      [
        "Persona Prueba",
        "Person+Buyer@Example.com",
        "person+buyer@example.com",
        "787-555-1234",
        "+17875551234",
      ]
    );
    const property = await db.query(
      `INSERT INTO public.propiedades (slug, titulo, municipio, estado)
       VALUES ('casa-prueba', 'Casa prueba', 'Ponce', 'disponible')
       RETURNING id::text`
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

async function insertProfile(db, leadId, propertyId, overrides = {}) {
  const values = {
    idempotencyKey: randomUUID(),
    method: "Financiamiento",
    solar: null,
    documentType: null,
    objectKey: null,
    originalName: null,
    contentType: null,
    size: null,
    status: "none",
    ...overrides,
  };
  return db.query(
    `INSERT INTO public.property_buyer_profiles (
       lead_id, property_id, name_snapshot, email_snapshot, phone_snapshot,
       purchase_method, solar_contract_acceptance, document_type,
       document_object_key, document_original_name, document_content_type,
       document_size_bytes, document_status, idempotency_key, source_path
     ) VALUES (
       $1::uuid, $2::uuid, 'Persona Prueba', 'Person+Buyer@Example.com',
       '787-555-1234', $3, $4, $5, $6, $7, $8, $9, $10, $11::uuid,
       '/listados/casa-prueba/perfil-comprador'
     ) RETURNING id::text, document_status`,
    [
      leadId,
      propertyId,
      values.method,
      values.solar,
      values.documentType,
      values.objectKey,
      values.originalName,
      values.contentType,
      values.size,
      values.status,
      values.idempotencyKey,
    ]
  );
}

test("valid persisted profile with no document", async () => {
  await withProfileDatabase(async ({ db, leadId, propertyId }) => {
    const result = await insertProfile(db, leadId, propertyId);
    assert.equal(result.rows[0].document_status, "none");
  });
});

test("valid financing profile persists private document metadata", async () => {
  await withProfileDatabase(async ({ db, leadId, propertyId }) => {
    const profileId = randomUUID();
    const key = buildBuyerProfileDocumentObjectKey(
      profileId,
      "prequalification_letter",
      "pdf"
    );
    const result = await insertProfile(db, leadId, propertyId, {
      documentType: "prequalification_letter",
      objectKey: key,
      originalName: "carta.pdf",
      contentType: "application/pdf",
      size: 1200,
      status: "pending",
    });
    assert.equal(result.rows[0].document_status, "pending");
    assert.ok(!key.includes("carta"));
  });
});

test("valid Cash profile persists proof-of-funds metadata", async () => {
  await withProfileDatabase(async ({ db, leadId, propertyId }) => {
    const result = await insertProfile(db, leadId, propertyId, {
      method: "Cash",
      documentType: "proof_of_funds",
      objectKey: `lead-documents/property-buyer-profiles/${randomUUID()}/proof_of_funds.pdf`,
      originalName: "fondos.pdf",
      contentType: "application/pdf",
      size: 500,
      status: "pending",
    });
    assert.equal(result.rows.length, 1);
  });
});

test("valid solar yes and no values are accepted", async () => {
  await withProfileDatabase(async ({ db, leadId, propertyId }) => {
    await insertProfile(db, leadId, propertyId, { solar: "yes" });
    await insertProfile(db, leadId, propertyId, { solar: "no" });
    const count = await db.query(
      `SELECT count(*)::int AS count FROM public.property_buyer_profiles`
    );
    assert.equal(count.rows[0].count, 2);
  });
});

test("missing and invalid idempotency keys are rejected", () => {
  assert.throws(
    () => parsePropertyBuyerProfileFormData(baseForm({ idempotencyKey: "" })),
    BuyerProfileValidationError
  );
  assert.throws(
    () => parsePropertyBuyerProfileFormData(baseForm({ idempotencyKey: "bad" })),
    BuyerProfileValidationError
  );
});

test("same idempotency key cannot create a second profile", async () => {
  await withProfileDatabase(async ({ db, leadId, propertyId }) => {
    const idempotencyKey = randomUUID();
    await insertProfile(db, leadId, propertyId, { idempotencyKey });
    await assert.rejects(
      insertProfile(db, leadId, propertyId, { idempotencyKey })
    );
    const count = await db.query(
      `SELECT count(*)::int AS count FROM public.property_buyer_profiles`
    );
    assert.equal(count.rows[0].count, 1);
  });
});

test("concurrent duplicate submission leaves one profile", async () => {
  await withProfileDatabase(async ({ db, leadId, propertyId }) => {
    const idempotencyKey = randomUUID();
    const results = await Promise.allSettled([
      insertProfile(db, leadId, propertyId, { idempotencyKey }),
      insertProfile(db, leadId, propertyId, { idempotencyKey }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const count = await db.query(
      `SELECT count(*)::int AS count FROM public.property_buyer_profiles`
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

test("same contact matches the existing canonical lead", async () => {
  const store = new ResolverStore();
  const existing = store.seed(
    "Persona Prueba",
    "person@example.com",
    "787-555-1234"
  );
  const result = await createLeadResolver(store).resolveOrCreate({
    name: "Persona Prueba",
    email: "PERSON@example.com",
    phone: "+1 787 555 1234",
  });
  assert.equal(result.lead.id, existing.id);
  assert.equal(result.outcome, "matched");
});

test("shared phone with a different name creates a conflict lead", async () => {
  const store = new ResolverStore();
  const existing = store.seed("Persona Uno", null, "787-555-1234");
  const result = await createLeadResolver(store).resolveOrCreate({
    name: "Persona Dos",
    phone: "787-555-1234",
  });
  assert.notEqual(result.lead.id, existing.id);
  assert.equal(result.outcome, "conflict_created");
});

test("property ID/slug mismatch and unavailable property are rejected", () => {
  const input = parsePropertyBuyerProfileFormData(baseForm());
  assert.throws(
    () =>
      validateBuyerProfileForProperty(input, {
        id: randomUUID(),
        slug: input.propertySlug,
        title: "Casa prueba",
        municipio: "Ponce",
        sectorComunidad: null,
        status: "disponible",
        hasSolarLease: false,
      }),
    BuyerProfileValidationError
  );
  assert.throws(
    () =>
      validateBuyerProfileForProperty(input, {
        id: input.propertyId,
        slug: input.propertySlug,
        title: "Casa prueba",
        municipio: "Ponce",
        sectorComunidad: null,
        status: "vendida",
        hasSolarLease: false,
      }),
    BuyerProfileValidationError
  );
});

test("invalid purchase method and solar answer are rejected", () => {
  assert.throws(
    () => parsePropertyBuyerProfileFormData(baseForm({ metodoCompra: "Efectivo" })),
    BuyerProfileValidationError
  );
  const input = parsePropertyBuyerProfileFormData(
    baseForm({ solarContractAcceptance: "maybe" })
  );
  assert.throws(
    () =>
      validateBuyerProfileForProperty(input, {
        id: input.propertyId,
        slug: input.propertySlug,
        title: "Casa prueba",
        municipio: "Ponce",
        sectorComunidad: null,
        status: "disponible",
        hasSolarLease: true,
      }),
    BuyerProfileValidationError
  );
});

function makeProfile(overrides = {}) {
  const id = randomUUID();
  return {
    id,
    leadId: randomUUID(),
    created: true,
    nameSnapshot: "Persona Prueba",
    emailSnapshot: "person@example.com",
    phoneSnapshot: "787-555-1234",
    purchaseMethod: "Financiamiento",
    purchaseMethodOther: null,
    financialInstitution: "Banco Prueba",
    closingFunds: "SÃ­",
    solarContractAcceptance: null,
    comments: null,
    documentType: null,
    documentObjectKey: null,
    documentOriginalName: null,
    documentContentType: null,
    documentSizeBytes: null,
    documentStatus: "none",
    property: {
      id: randomUUID(),
      slug: "casa-prueba",
      title: "Casa prueba",
      municipio: "Ponce",
      sectorComunidad: null,
      status: "disponible",
      hasSolarLease: false,
    },
    ...overrides,
  };
}

test("durable profile remains successful when queue insertion fails", async () => {
  const profile = makeProfile();
  const errors = [];
  const state = await queueBuyerProfileInternalNotification({
    profile,
    documentStatus: "none",
    recipient: "internal@example.invalid",
    enqueue: async () => {
      throw new Error("queue unavailable");
    },
    onError: (stage) => errors.push(stage),
  });
  assert.equal(state, "failed_to_queue");
  assert.deepEqual(errors, ["queue_insert"]);
  assert.ok(profile.id);
});

test("durable profile is marked failed when R2 upload fails", async () => {
  const file = new NodeFile(["pdf"], "carta.pdf", { type: "application/pdf" });
  const profile = makeProfile({
    documentType: "prequalification_letter",
    documentObjectKey: `lead-documents/property-buyer-profiles/${randomUUID()}/prequalification_letter.pdf`,
    documentOriginalName: file.name,
    documentContentType: file.type,
    documentSizeBytes: file.size,
    documentStatus: "pending",
  });
  const statuses = [];
  const state = await settleBuyerProfileDocument({
    profile,
    file,
    isConfigured: () => true,
    upload: async () => {
      throw new Error("R2 unavailable");
    },
    updateStatus: async (_id, _key, status) => {
      statuses.push(status);
      return true;
    },
    onError: () => {},
  });
  assert.equal(state, "failed");
  assert.deepEqual(statuses, ["failed"]);
});

test("same idempotency retry does not create a second R2 object", async () => {
  const file = new NodeFile(["pdf"], "carta.pdf", { type: "application/pdf" });
  const objectKey = `lead-documents/property-buyer-profiles/${randomUUID()}/prequalification_letter.pdf`;
  const profile = makeProfile({
    documentType: "prequalification_letter",
    documentObjectKey: objectKey,
    documentOriginalName: file.name,
    documentContentType: file.type,
    documentSizeBytes: file.size,
    documentStatus: "pending",
  });
  const objects = new Set();
  const upload = async (_file, key) => objects.add(key);
  const first = await settleBuyerProfileDocument({
    profile,
    file,
    isConfigured: () => true,
    upload,
    updateStatus: async () => true,
    onError: () => {},
  });
  const retry = await settleBuyerProfileDocument({
    profile: { ...profile, documentStatus: "uploaded", created: false },
    file,
    isConfigured: () => true,
    upload,
    updateStatus: async () => true,
    onError: () => {},
  });
  assert.equal(first, "uploaded");
  assert.equal(retry, "uploaded");
  assert.equal(objects.size, 1);
});

test("Priority Registration queue relationship and timestamps survive 0003", async () => {
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
        related_lead_id uuid NULL REFERENCES public.property_priority_registrations(id) ON DELETE SET NULL,
        related_property_id uuid NULL,
        status text NOT NULL DEFAULT 'pending',
        attempts integer NOT NULL DEFAULT 0,
        last_error text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        sent_at timestamptz NULL,
        locked_at timestamptz NULL,
        locked_by text NULL
      );
    `);
    const priority = await db.query(
      `INSERT INTO public.property_priority_registrations DEFAULT VALUES RETURNING id::text`
    );
    const before = await db.query(
      `INSERT INTO public.email_queue (
         recipient, subject, html, email_type, related_lead_id
       ) VALUES (
         'priority@example.invalid', 'Priority', '<p>Priority</p>',
         'priority_registration_confirmation', $1::uuid
       ) RETURNING id::text, created_at, updated_at`,
      [priority.rows[0].id]
    );
    await db.exec(queueSql);
    const after = await db.query(
      `SELECT created_at, updated_at, canonical_lead_id, dedupe_key
         FROM public.email_queue WHERE id = $1::uuid`,
      [before.rows[0].id]
    );
    assert.equal(after.rows[0].created_at.getTime(), before.rows[0].created_at.getTime());
    assert.equal(after.rows[0].updated_at.getTime(), before.rows[0].updated_at.getTime());
    assert.equal(after.rows[0].canonical_lead_id, null);
    assert.equal(after.rows[0].dedupe_key, null);
    const fk = await db.query(
      `SELECT target.relname AS target_table, con.confdeltype
         FROM pg_constraint con
         JOIN pg_class target ON target.oid = con.confrelid
        WHERE con.conrelid = 'public.email_queue'::regclass
          AND con.conname = 'email_queue_related_lead_id_fkey'`
    );
    assert.deepEqual(fk.rows, [
      { target_table: "property_priority_registrations", confdeltype: "n" },
    ]);
  } finally {
    await db.close();
  }
});
