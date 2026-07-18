import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  isPriorityRegistrationCanonicalLeadEnabled,
  persistPriorityRegistrationWithStore,
} from "../lib/leads/priority-registration-persistence.ts";
import { planPriorityRegistrationBackfill } from "../lib/leads/priority-registration-backfill.ts";
import { createLeadResolver } from "../lib/leads/resolver.ts";
import {
  normalizeEmail,
  normalizePuertoRicoUsPhone,
} from "../lib/leads/normalization.ts";

async function migration(name) {
  return readFile(
    fileURLToPath(new URL(`../db/migrations/${name}`, import.meta.url)),
    "utf8"
  );
}

const [leadsSql, prioritySql, priorityRollbackSql] = await Promise.all([
  migration("0001_create_leads.sql"),
  migration("0006_link_priority_registrations_to_leads.sql"),
  migration("0006_link_priority_registrations_to_leads.rollback.sql"),
]);

function baseInput(overrides = {}) {
  return {
    propertyId: "10000000-0000-4000-8000-000000000001",
    propertySlug: "priority-fixture",
    name: "Priority Person",
    phone: "(787) 555-1234",
    email: "Priority+Tag@Example.com",
    purchaseType: "Cash",
    purchaseOther: null,
    prequalifiedStatus: null,
    propertySize: "3 habitaciones",
    searchRange: "Puerto Rico",
    wantsVisit: true,
    additionalInfo: null,
    ...overrides,
  };
}

class MemoryPriorityStore {
  leads = [];
  registrations = [];
  tail = Promise.resolve();
  failInsert = false;

  async withTransaction(callback) {
    const previous = this.tail;
    let release;
    this.tail = new Promise((resolve) => (release = resolve));
    await previous;
    const workingLeads = structuredClone(this.leads);
    const workingRegistrations = structuredClone(this.registrations);
    const resolver = createLeadResolver({
      withTransaction: async (leadCallback) =>
        leadCallback({
          lockIdentityKeys: async () => {},
          findCandidates: async (identity) =>
            workingLeads.filter(
              (lead) =>
                (identity.emailNormalized &&
                  lead.emailNormalized === identity.emailNormalized) ||
                (identity.phoneNormalized &&
                  lead.phoneNormalized === identity.phoneNormalized)
            ),
          insertLead: async (input) => {
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
            workingLeads.push(lead);
            return lead;
          },
          markMatched: async (id) => {
            const lead = workingLeads.find((item) => item.id === id);
            lead.identityStatus =
              lead.identityStatus === "provisional"
                ? "matched"
                : lead.identityStatus;
            lead.lastActivityAt = new Date();
            lead.updatedAt = new Date();
            return lead;
          },
        }),
    });

    try {
      const result = await callback({
        lockProperty: async (id, slug) =>
          id === baseInput().propertyId && slug === baseInput().propertySlug
            ? { id, slug, title: "Priority Fixture", status: "coming_soon" }
            : null,
        lockDuplicateKey: async () => {},
        findDuplicate: async (propertyId, email) => {
          const row = workingRegistrations.find(
            (registration) =>
              registration.propertyId === propertyId &&
              registration.email.toLowerCase() === email
          );
          return row ? { id: row.id, leadId: row.leadId } : null;
        },
        resolveLead: async (input) => {
          const result = await resolver.resolveOrCreate(input);
          return { id: result.lead.id };
        },
        insertRegistration: async ({ registration, leadId }) => {
          if (this.failInsert) throw new Error("synthetic insert failure");
          const row = {
            id: randomUUID(),
            propertyId: registration.propertyId,
            email: registration.email,
            leadId,
          };
          workingRegistrations.push(row);
          return { id: row.id };
        },
      });
      this.leads = workingLeads;
      this.registrations = workingRegistrations;
      return result;
    } finally {
      release();
    }
  }
}

test("0006 adds only nullable canonical lead linkage and rolls back cleanly", async () => {
  const db = new PGlite();
  try {
    await db.exec(leadsSql);
    await db.exec(`
      CREATE TABLE public.propiedades (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
      CREATE TABLE public.property_priority_registrations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id uuid NOT NULL REFERENCES public.propiedades(id) ON DELETE CASCADE,
        email text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX property_priority_registrations_property_email_unique
        ON public.property_priority_registrations (property_id, lower(email));
    `);
    const beforeIndexes = await db.query(
      `SELECT indexname FROM pg_indexes WHERE tablename='property_priority_registrations' ORDER BY indexname`
    );
    await db.exec(prioritySql);
    const column = await db.query(
      `SELECT data_type, is_nullable FROM information_schema.columns
       WHERE table_name='property_priority_registrations' AND column_name='lead_id'`
    );
    assert.deepEqual(column.rows, [{ data_type: "uuid", is_nullable: "YES" }]);
    const fk = await db.query(
      `SELECT confdeltype FROM pg_constraint
       WHERE conname='property_priority_registrations_lead_id_fkey'`
    );
    assert.deepEqual(fk.rows, [{ confdeltype: "r" }]);
    await db.exec(priorityRollbackSql);
    const afterIndexes = await db.query(
      `SELECT indexname FROM pg_indexes WHERE tablename='property_priority_registrations' ORDER BY indexname`
    );
    assert.deepEqual(afterIndexes.rows, beforeIndexes.rows);
  } finally {
    await db.close();
  }
});

test("feature flag is disabled unless its value is exactly true", () => {
  assert.equal(isPriorityRegistrationCanonicalLeadEnabled(undefined), false);
  assert.equal(isPriorityRegistrationCanonicalLeadEnabled("false"), false);
  assert.equal(isPriorityRegistrationCanonicalLeadEnabled("TRUE"), false);
  assert.equal(isPriorityRegistrationCanonicalLeadEnabled("true"), true);
});

test("enabled persistence creates one canonical lead and registration", async () => {
  const store = new MemoryPriorityStore();
  const result = await persistPriorityRegistrationWithStore(store, baseInput());
  assert.equal(result.created, true);
  assert.equal(store.leads.length, 1);
  assert.equal(store.registrations.length, 1);
  assert.equal(store.registrations[0].leadId, store.leads[0].id);
});

test("duplicate and concurrent retries do not create another lead", async () => {
  const store = new MemoryPriorityStore();
  const input = baseInput();
  const [first, second] = await Promise.all([
    persistPriorityRegistrationWithStore(store, input),
    persistPriorityRegistrationWithStore(store, input),
  ]);
  assert.deepEqual([first.created, second.created].sort(), [false, true]);
  assert.equal(store.leads.length, 1);
  assert.equal(store.registrations.length, 1);
});

test("normalized email and phone reuse a compatible canonical lead", async () => {
  const store = new MemoryPriorityStore();
  await persistPriorityRegistrationWithStore(store, baseInput());
  const second = await persistPriorityRegistrationWithStore(
    store,
    baseInput({
      propertyId: baseInput().propertyId,
      email: "priority+tag@EXAMPLE.COM",
    })
  );
  assert.equal(second.created, false);
  assert.equal(store.leads[0].emailNormalized, "priority+tag@example.com");
  assert.equal(store.leads[0].phoneNormalized, "+17875551234");
});

test("shared phone with a materially different identity creates a conflict lead", async () => {
  const store = new MemoryPriorityStore();
  await persistPriorityRegistrationWithStore(store, baseInput());
  await persistPriorityRegistrationWithStore(
    store,
    baseInput({
      email: "different@example.com",
      name: "Different Household Member",
    })
  );
  assert.equal(store.leads.length, 2);
  assert.equal(store.leads[1].identityStatus, "conflict");
});

test("transaction rollback leaves neither an orphan lead nor registration", async () => {
  const store = new MemoryPriorityStore();
  store.failInsert = true;
  await assert.rejects(
    persistPriorityRegistrationWithStore(store, baseInput()),
    /synthetic insert failure/
  );
  assert.equal(store.leads.length, 0);
  assert.equal(store.registrations.length, 0);
});

test("backfill dry run is deterministic and idempotent", () => {
  const registrations = [
    {
      id: randomUUID(),
      name: "Historical Person",
      email: "History@Example.com",
      phone: "787-555-2222",
      leadId: null,
    },
  ];
  const first = planPriorityRegistrationBackfill(registrations, []);
  const second = planPriorityRegistrationBackfill(registrations, []);
  assert.deepEqual(first, second);
  assert.equal(first.summary.canonicalLeadsToCreate, 1);
  assert.equal(first.summary.registrationsToLink, 1);
});

test("ambiguous historical shared identifiers are left unlinked", () => {
  const sharedPhone = "787-555-3333";
  const plan = planPriorityRegistrationBackfill(
    [
      { id: randomUUID(), name: "Person One", email: "one@example.com", phone: sharedPhone },
      { id: randomUUID(), name: "Person Two", email: "two@example.com", phone: sharedPhone },
    ],
    []
  );
  assert.equal(plan.actions.length, 0);
  assert.equal(plan.summary.ambiguousGroups, 1);
  assert.equal(plan.summary.registrationsLeftUnlinked, 2);
});

test("normalization used by backfill preserves plus email and confident PR phone", () => {
  assert.equal(normalizeEmail("Person+Tag@Example.COM"), "person+tag@example.com");
  assert.equal(normalizePuertoRicoUsPhone("(939) 555-4444"), "+19395554444");
});
