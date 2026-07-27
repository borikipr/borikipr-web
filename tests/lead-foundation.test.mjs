import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  normalizeEmail,
  normalizeLeadIdentity,
  normalizePuertoRicoUsPhone,
} from "../lib/leads/normalization.ts";
import {
  createLeadResolver,
  LeadIdentityValidationError,
} from "../lib/leads/resolver.ts";

const migrationSql = await readFile(
  fileURLToPath(
    new URL("../db/migrations/0001_create_leads.sql", import.meta.url)
  ),
  "utf8"
);

class InMemoryLeadStore {
  leads = [];
  transactionTail = Promise.resolve();

  seed(input) {
    const now = new Date();
    const lead = {
      id: randomUUID(),
      name: input.name,
      emailOriginal: input.emailOriginal ?? null,
      emailNormalized: normalizeEmail(input.emailOriginal),
      phoneOriginal: input.phoneOriginal ?? null,
      phoneNormalized: normalizePuertoRicoUsPhone(input.phoneOriginal),
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
    const previous = this.transactionTail;
    let release;
    this.transactionTail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;

    const transaction = {
      lockIdentityKeys: async () => {},
      findCandidates: async (identity) =>
        this.leads.filter(
          (lead) =>
            lead.status !== "merged" &&
            ((identity.emailNormalized &&
              lead.emailNormalized === identity.emailNormalized) ||
              (identity.phoneNormalized &&
                lead.phoneNormalized === identity.phoneNormalized))
        ),
      insertLead: async (input) => this.seedFromNormalized(input),
      markMatched: async (id) => {
        const index = this.leads.findIndex((lead) => lead.id === id);
        const existing = this.leads[index];
        const now = new Date();
        const updated = {
          ...existing,
          identityStatus:
            existing.identityStatus === "provisional"
              ? "matched"
              : existing.identityStatus,
          lastActivityAt: now,
          updatedAt: now,
        };
        this.leads[index] = updated;
        return updated;
      },
    };

    try {
      return await callback(transaction);
    } finally {
      release();
    }
  }

  seedFromNormalized(input) {
    const now = new Date();
    const lead = {
      id: randomUUID(),
      name: input.name,
      emailOriginal: input.emailOriginal,
      emailNormalized: input.emailNormalized,
      phoneOriginal: input.phoneOriginal,
      phoneNormalized: input.phoneNormalized,
      status: "new",
      identityStatus: input.identityStatus,
      firstSeenAt: now,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
      mergedIntoLeadId: null,
    };
    this.leads.push(lead);
    return lead;
  }
}

function setupResolver() {
  const store = new InMemoryLeadStore();
  return { store, resolver: createLeadResolver(store) };
}

test("normalizes email without stripping plus-addressing", () => {
  assert.equal(
    normalizeEmail("  Person+OpenHouse@Example.COM "),
    "person+openhouse@example.com"
  );
  assert.equal(normalizeEmail("not-an-email"), null);
});

test("normalizes confident Puerto Rico/US phones and rejects ambiguous phones", () => {
  assert.equal(normalizePuertoRicoUsPhone("(787) 555-1234"), "+17875551234");
  assert.equal(normalizePuertoRicoUsPhone("1-939-555-6789"), "+19395556789");
  assert.equal(normalizePuertoRicoUsPhone("555-1234"), null);
  assert.equal(normalizePuertoRicoUsPhone("+34 612 345 678"), null);
});

test("preserves original contact values separately", () => {
  assert.deepEqual(
    normalizeLeadIdentity({
      email: " Person+Tag@Example.com ",
      phone: " (787) 555-1234 ",
    }),
    {
      emailOriginal: "Person+Tag@Example.com",
      emailNormalized: "person+tag@example.com",
      phoneOriginal: "(787) 555-1234",
      phoneNormalized: "+17875551234",
    }
  );
});

test("matches the same compatible name, email, and phone", async () => {
  const { store, resolver } = setupResolver();
  const existing = store.seed({
    name: "María Rivera",
    emailOriginal: "maria@example.com",
    phoneOriginal: "787-555-1234",
  });

  const result = await resolver.resolveOrCreate({
    name: "Maria Rivera",
    email: "MARIA@example.com",
    phone: "+1 787 555 1234",
  });

  assert.equal(result.outcome, "matched");
  assert.equal(result.lead.id, existing.id);
  assert.equal(store.leads.length, 1);
});

test("canonical persistence does not infer a name variation from shared contacts", async () => {
  const { store, resolver } = setupResolver();
  const existing = store.seed({
    name: "María Elena Rivera Santiago",
    emailOriginal: "maria@example.com",
    phoneOriginal: "787-555-1234",
  });

  const result = await resolver.resolveOrCreate({
    name: "Maria Rivera",
    email: "maria@example.com",
    phone: "787-555-1234",
  });

  assert.equal(result.outcome, "conflict_created");
  assert.notEqual(result.lead.id, existing.id);
  assert.equal(store.leads.length, 2);
});

test("matches email-only when exactly one compatible-name candidate exists", async () => {
  const { store, resolver } = setupResolver();
  const existing = store.seed({
    name: "Ana López",
    emailOriginal: "ana@example.com",
  });

  const result = await resolver.resolveOrCreate({
    name: "Ana Lopez",
    email: "ana@example.com",
  });

  assert.equal(result.outcome, "matched");
  assert.equal(result.lead.id, existing.id);
});

test("matches phone-only when exactly one compatible-name candidate exists", async () => {
  const { store, resolver } = setupResolver();
  const existing = store.seed({
    name: "Luis Ortiz",
    phoneOriginal: "939-555-1234",
  });

  const result = await resolver.resolveOrCreate({
    name: "Luis Ortiz",
    phone: "+1 (939) 555-1234",
  });

  assert.equal(result.outcome, "matched");
  assert.equal(result.lead.id, existing.id);
});

test("shared household phone with a different name creates a conflict lead", async () => {
  const { store, resolver } = setupResolver();
  const existing = store.seed({
    name: "Carlos Pérez",
    phoneOriginal: "787-555-2000",
  });

  const result = await resolver.resolveOrCreate({
    name: "Elena Pérez",
    phone: "787-555-2000",
  });

  assert.equal(result.outcome, "conflict_created");
  assert.notEqual(result.lead.id, existing.id);
  assert.equal(result.lead.identityStatus, "conflict");
});

test("shared email with a different name creates a conflict lead", async () => {
  const { store, resolver } = setupResolver();
  store.seed({ name: "Alex Soto", emailOriginal: "home@example.com" });

  const result = await resolver.resolveOrCreate({
    name: "Jamie Soto",
    email: "home@example.com",
  });

  assert.equal(result.outcome, "conflict_created");
  assert.equal(store.leads.length, 2);
});

test("conflicting email and phone owners never merge", async () => {
  const { store, resolver } = setupResolver();
  const emailOwner = store.seed({
    name: "Robin Cruz",
    emailOriginal: "robin@example.com",
    phoneOriginal: "787-555-3000",
  });
  const phoneOwner = store.seed({
    name: "Taylor Díaz",
    emailOriginal: "taylor@example.com",
    phoneOriginal: "939-555-4000",
  });

  const result = await resolver.resolveOrCreate({
    name: "Robin Cruz",
    email: emailOwner.emailOriginal,
    phone: phoneOwner.phoneOriginal,
  });

  assert.equal(result.outcome, "conflict_created");
  assert.notEqual(result.lead.id, emailOwner.id);
  assert.notEqual(result.lead.id, phoneOwner.id);
  assert.equal(store.leads.length, 3);
});

test("missing email is supported with a confident phone", async () => {
  const { resolver } = setupResolver();
  const result = await resolver.resolveOrCreate({
    name: "No Email",
    phone: "787-555-5000",
  });

  assert.equal(result.outcome, "created");
  assert.equal(result.lead.emailNormalized, null);
});

test("invalid email is not used and fails when no valid phone exists", async () => {
  const { resolver } = setupResolver();
  await assert.rejects(
    resolver.resolveOrCreate({ name: "Invalid", email: "invalid@" }),
    LeadIdentityValidationError
  );
});

test("ambiguous phone is not guessed when a valid email is available", async () => {
  const { resolver } = setupResolver();
  const result = await resolver.resolveOrCreate({
    name: "Ambiguous Phone",
    email: "ambiguous@example.com",
    phone: "555-1234",
  });

  assert.equal(result.lead.phoneOriginal, "555-1234");
  assert.equal(result.lead.phoneNormalized, null);
});

test("retrying identical identity data reuses the first lead", async () => {
  const { store, resolver } = setupResolver();
  const input = {
    name: "Retry Person",
    email: "retry@example.com",
    phone: "787-555-6000",
  };

  const first = await resolver.resolveOrCreate(input);
  const retry = await resolver.resolveOrCreate(input);

  assert.equal(first.outcome, "created");
  assert.equal(retry.outcome, "matched");
  assert.equal(retry.lead.id, first.lead.id);
  assert.equal(store.leads.length, 1);
});

test("concurrent identical requests create only one lead", async () => {
  const { store, resolver } = setupResolver();
  const input = {
    name: "Concurrent Person",
    email: "concurrent@example.com",
    phone: "939-555-7000",
  };

  const results = await Promise.all([
    resolver.resolveOrCreate(input),
    resolver.resolveOrCreate(input),
  ]);

  assert.equal(store.leads.length, 1);
  assert.equal(results[0].lead.id, results[1].lead.id);
  assert.deepEqual(
    results.map((result) => result.outcome).sort(),
    ["created", "matched"]
  );
});

test("migration enforces self-merge constraint", async () => {
  const db = new PGlite();
  try {
    await db.exec(migrationSql);
    const inserted = await db.query(
      `INSERT INTO public.leads (name, email_normalized)
       VALUES ($1, $2)
       RETURNING id::text`,
      ["Self Merge", "self@example.com"]
    );
    const id = inserted.rows[0].id;

    await assert.rejects(
      db.query(
        `UPDATE public.leads
            SET status = 'merged', merged_into_lead_id = $1::uuid
          WHERE id = $1::uuid`,
        [id]
      )
    );
  } finally {
    await db.close();
  }
});

test("migration enforces status and identity-status checks", async () => {
  const db = new PGlite();
  try {
    await db.exec(migrationSql);

    await assert.rejects(
      db.query(
        `INSERT INTO public.leads (name, email_normalized, status)
         VALUES ($1, $2, $3)`,
        ["Bad Status", "status@example.com", "unknown"]
      )
    );

    await assert.rejects(
      db.query(
        `INSERT INTO public.leads (name, email_normalized, identity_status)
         VALUES ($1, $2, $3)`,
        ["Bad Identity", "identity@example.com", "unknown"]
      )
    );
  } finally {
    await db.close();
  }
});

test("migration requires at least one normalized contact identifier", async () => {
  const db = new PGlite();
  try {
    await db.exec(migrationSql);
    await assert.rejects(
      db.query(`INSERT INTO public.leads (name) VALUES ($1)`, ["No Identity"])
    );
  } finally {
    await db.close();
  }
});

test("migration permits a merge target only for merged leads", async () => {
  const db = new PGlite();
  try {
    await db.exec(migrationSql);
    const target = await db.query(
      `INSERT INTO public.leads (name, email_normalized)
       VALUES ($1, $2)
       RETURNING id::text`,
      ["Merge Target", "target@example.com"]
    );

    await assert.rejects(
      db.query(
        `INSERT INTO public.leads (
           name, email_normalized, status, merged_into_lead_id
         ) VALUES ($1, $2, $3, $4::uuid)`,
        [
          "Not Merged",
          "not-merged@example.com",
          "active",
          target.rows[0].id,
        ]
      )
    );
  } finally {
    await db.close();
  }
});
