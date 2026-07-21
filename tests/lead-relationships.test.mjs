import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  createLeadRelationshipInTransaction,
  updateLeadRelationshipInTransaction,
} from "../lib/admin/lead-relationship.ts";

async function readRepo(path) {
  return readFile(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
}

const [leadsSql, lead360Sql] = await Promise.all([
  readRepo("db/migrations/0001_create_leads.sql"),
  readRepo("db/migrations/0007_create_lead_360.sql"),
]);

function transactionAdapter(transaction) {
  return {
    async unsafe(text, values = []) {
      return (await transaction.query(text, values)).rows;
    },
  };
}

async function setupRelationshipDatabase() {
  const db = new PGlite();
  await db.exec(leadsSql);
  await db.exec(lead360Sql);
  await db.exec(`
    CREATE TABLE public.propiedades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo text NOT NULL,
      slug text NOT NULL UNIQUE
    );
    CREATE TABLE public.property_priority_registrations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
      property_id uuid NOT NULL REFERENCES public.propiedades(id) ON DELETE RESTRICT,
      email text NOT NULL
    );
  `);
  const sharedEmail = "shared-family@example.test";
  const sharedPhone = "7875550199";
  const first = (await db.query(`
    INSERT INTO public.leads (
      name, email_original, email_normalized, phone_original, phone_normalized, identity_status
    ) VALUES ('Persona sintética uno', $1, $1, $2, $2, 'conflict')
    RETURNING id::text
  `, [sharedEmail, sharedPhone])).rows[0].id;
  const second = (await db.query(`
    INSERT INTO public.leads (
      name, email_original, email_normalized, phone_original, phone_normalized
    ) VALUES ('Persona sintética dos', $1, $1, $2, $2)
    RETURNING id::text
  `, [sharedEmail, sharedPhone])).rows[0].id;
  const property = (await db.query(`
    INSERT INTO public.propiedades (titulo, slug)
    VALUES ('Propiedad compartida sintética', 'propiedad-compartida-sintetica')
    RETURNING id::text
  `)).rows[0].id;
  await db.query(`
    INSERT INTO public.property_priority_registrations (lead_id, property_id, email)
    VALUES ($1::uuid, $3::uuid, $4), ($2::uuid, $3::uuid, $4)
  `, [first, second, property, sharedEmail]);
  return { db, first, second };
}

async function createRelationship(db, input) {
  return db.transaction((transaction) =>
    createLeadRelationshipInTransaction(transactionAdapter(transaction), input)
  );
}

async function updateRelationship(db, input) {
  return db.transaction((transaction) =>
    updateLeadRelationshipInTransaction(transactionAdapter(transaction), input)
  );
}

function createInput(first, second, relationshipType = "family") {
  return {
    leadId: first,
    relatedLeadId: second,
    relationshipType,
    actorUsername: "synthetic-admin",
    operationKey: randomUUID(),
  };
}

test("first family relationship creation is symmetric, audited, and keeps both leads separate", async () => {
  const { db, first, second } = await setupRelationshipDatabase();
  try {
    const result = await createRelationship(db, createInput(first, second));
    assert.equal(result.status, "created");
    const relationships = await db.query(`
      SELECT id::text, lead_id::text, related_lead_id::text, relationship_type
      FROM public.lead_relationships
    `);
    assert.equal(relationships.rows.length, 1);
    assert.equal(relationships.rows[0].relationship_type, "family");
    assert.deepEqual(
      [relationships.rows[0].lead_id, relationships.rows[0].related_lead_id],
      [first, second].sort()
    );
    const visibleFromBoth = await db.query(`
      SELECT lead.id::text, count(relationship.id)::int AS relationship_count
      FROM public.leads lead
      LEFT JOIN public.lead_relationships relationship
        ON relationship.lead_id=lead.id OR relationship.related_lead_id=lead.id
      WHERE lead.id=ANY(ARRAY[$1::uuid, $2::uuid])
      GROUP BY lead.id
      ORDER BY lead.id
    `, [first, second]);
    assert.deepEqual(visibleFromBoth.rows.map((row) => row.relationship_count), [1, 1]);
    const audit = (await db.query(`
      SELECT event_type, jsonb_typeof(event_data) AS data_type,
             event_data->>'relationshipType' AS relationship_type
      FROM public.lead_management_events
    `)).rows[0];
    assert.deepEqual(audit, {
      event_type: "relationship_created",
      data_type: "object",
      relationship_type: "family",
    });
    const leads = await db.query("SELECT status, merged_into_lead_id FROM public.leads ORDER BY id");
    assert.ok(leads.rows.every((lead) => lead.status === "new" && lead.merged_into_lead_id === null));
  } finally { await db.close(); }
});

test("same and reverse relationship requests are idempotent and never change type implicitly", async () => {
  const { db, first, second } = await setupRelationshipDatabase();
  try {
    const created = await createRelationship(db, createInput(first, second));
    const repeated = await createRelationship(db, createInput(first, second));
    const reversed = await createRelationship(db, createInput(second, first, "co_buyer"));
    assert.equal(created.status, "created");
    assert.equal(repeated.status, "existing");
    assert.equal(reversed.status, "existing");
    assert.equal(reversed.relationshipType, "family");
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.lead_relationships")).rows[0].count, 1);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.lead_management_events")).rows[0].count, 1);
  } finally { await db.close(); }
});

test("relationship type changes only through the explicit validated update", async () => {
  const { db, first, second } = await setupRelationshipDatabase();
  try {
    const created = await createRelationship(db, createInput(first, second));
    const updated = await updateRelationship(db, {
      ...createInput(second, first, "co_buyer"),
      relationshipId: created.relationshipId,
    });
    assert.equal(updated.status, "updated");
    assert.equal((await db.query("SELECT relationship_type FROM public.lead_relationships")).rows[0].relationship_type, "co_buyer");
    const events = await db.query("SELECT event_data->>'action' AS action FROM public.lead_management_events ORDER BY created_at");
    assert.deepEqual(events.rows.map((row) => row.action), ["created", "updated"]);
  } finally { await db.close(); }
});

test("self-relations and invalid relationship types are rejected without partial writes", async () => {
  const { db, first, second } = await setupRelationshipDatabase();
  try {
    await assert.rejects(createRelationship(db, createInput(first, first)), /Relación inválida/);
    await assert.rejects(createRelationship(db, createInput(first, second, "invalid_type")));
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.lead_relationships")).rows[0].count, 0);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.lead_management_events")).rows[0].count, 0);
  } finally { await db.close(); }
});

test("an audit-event failure rolls back the relationship insert", async () => {
  const { db, first, second } = await setupRelationshipDatabase();
  try {
    await db.exec(`
      CREATE FUNCTION public.reject_relationship_audit() RETURNS trigger AS $$
      BEGIN
        IF NEW.event_type = 'relationship_created' THEN
          RAISE EXCEPTION 'synthetic audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER reject_relationship_audit_trigger
        BEFORE INSERT ON public.lead_management_events
        FOR EACH ROW EXECUTE FUNCTION public.reject_relationship_audit();
    `);
    await assert.rejects(createRelationship(db, createInput(first, second)), /synthetic audit failure/);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.lead_relationships")).rows[0].count, 0);
  } finally { await db.close(); }
});

test("relationship actions keep redirects outside transaction catches and expose safe result states", async () => {
  const [actions, page, engine] = await Promise.all([
    readRepo("app/admin/leads/[id]/actions.ts"),
    readRepo("app/admin/leads/[id]/page.tsx"),
    readRepo("lib/admin/lead-relationship.ts"),
  ]);
  assert.match(engine, /'relationshipId', \$2::uuid/);
  assert.match(engine, /'relatedLeadId', \$3::uuid/);
  assert.match(engine, /ORDER BY id\s+FOR UPDATE/);
  const createAction = actions.slice(
    actions.indexOf("export async function createLeadRelationshipAction"),
    actions.indexOf("export async function updateLeadRelationshipAction")
  );
  assert.match(actions, /relationship_result=rolled_back/);
  assert.match(actions, /relationship_result=exists/);
  assert.match(actions, /relationship_result=unconfirmed/);
  assert.match(actions, /redirect\(leadHref\(leadId, "Relación guardada"\)\)/);
  assert.doesNotMatch(createAction, /try\s*\{[\s\S]*redirect\(leadHref\(leadId, "Relación guardada"\)\)[\s\S]*\}\s*catch/);
  assert.match(page, /No se pudo crear la relación\. Ningún cambio fue aplicado\./);
  assert.match(page, /Estas personas ya están relacionadas\./);
  assert.match(page, /Relación confirmada/);
  assert.match(page, /Posible duplicado sin resolver/);
  assert.match(page, /La relación confirmada y una identidad duplicada son conceptos distintos/);
  assert.match(page, /min-w-0/);
  assert.doesNotMatch(`${actions}\n${engine}`, /console\.(log|info|warn|error)|analytics|track\(/i);
});
