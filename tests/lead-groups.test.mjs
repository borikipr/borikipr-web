import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  addLeadGroupMemberInTransaction,
  addLeadGroupNoteInTransaction,
  createLeadGroupInTransaction,
  removeLeadGroupMemberInTransaction,
  updateLeadGroupInTransaction,
} from "../lib/admin/lead-group-mutations.ts";

const root = new URL("..", import.meta.url);
const readRepo = (path) => readFile(new URL(path, root), "utf8");
const [leadsSql, lead360Sql, groupsSql] = await Promise.all([
  readRepo("db/migrations/0001_create_leads.sql"),
  readRepo("db/migrations/0007_create_lead_360.sql"),
  readRepo("db/migrations/0011_create_lead_groups.sql"),
]);

function adapter(transaction) {
  return { async unsafe(text, values = []) { return (await transaction.query(text, values)).rows; } };
}

async function setup() {
  const db = new PGlite();
  await db.exec(leadsSql);
  await db.exec(`CREATE TABLE public.propiedades (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), titulo text NOT NULL,
    slug text NOT NULL UNIQUE, municipio text NULL
  );`);
  await db.exec(lead360Sql);
  await db.exec(groupsSql);
  const propertyId = (await db.query("INSERT INTO public.propiedades (titulo, slug) VALUES ('Casa sintética', 'casa-sintetica') RETURNING id::text")).rows[0].id;
  const leads = [];
  for (const [name, email] of [["Persona Alfa", "alpha@example.test"], ["Persona Beta", "beta@example.test"], ["Persona Gamma", "gamma@example.test"]]) {
    leads.push((await db.query("INSERT INTO public.leads (name, email_original, email_normalized) VALUES ($1, $2, $2) RETURNING id::text", [name, email])).rows[0].id);
  }
  return { db, propertyId, leads };
}

function createInput(propertyId, leads, operationKey = randomUUID()) {
  return {
    title: "Caso Casa sintética",
    primaryPropertyId: propertyId,
    members: [
      { leadId: leads[0], role: "family_contact", isPrimaryContact: true },
      { leadId: leads[1], role: "prequalified_buyer", isPrimaryContact: false },
    ],
    actorUsername: "synthetic-admin",
    operationKey,
  };
}

test("0011 creates case tables, prevents duplicate membership, and uses RESTRICT foreign keys", async () => {
  const { db, propertyId, leads } = await setup();
  try {
    const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'lead_group%' ORDER BY table_name");
    assert.deepEqual(tables.rows.map((row) => row.table_name), ["lead_group_events", "lead_group_members", "lead_group_notes", "lead_groups"]);
    const result = await db.transaction((tx) => createLeadGroupInTransaction(adapter(tx), createInput(propertyId, leads)));
    await assert.rejects(db.query("INSERT INTO public.lead_group_members (group_id, lead_id, role, created_by) VALUES ($1::uuid, $2::uuid, 'buyer', 'test')", [result.groupId, leads[0]]));
    const fks = await db.query(`SELECT bool_and(confdeltype='r') AS all_restrict FROM pg_constraint WHERE contype='f' AND conrelid IN ('public.lead_groups'::regclass, 'public.lead_group_members'::regclass, 'public.lead_group_notes'::regclass, 'public.lead_group_events'::regclass)`);
    assert.equal(fks.rows[0].all_restrict, true);
  } finally { await db.close(); }
});

test("group creation preserves separate canonical identities and is idempotent", async () => {
  const { db, propertyId, leads } = await setup();
  try {
    const operationKey = randomUUID();
    const first = await db.transaction((tx) => createLeadGroupInTransaction(adapter(tx), createInput(propertyId, leads, operationKey)));
    const repeated = await db.transaction((tx) => createLeadGroupInTransaction(adapter(tx), createInput(propertyId, leads, operationKey)));
    assert.equal(first.status, "created");
    assert.equal(repeated.status, "existing");
    assert.equal(repeated.groupId, first.groupId);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.lead_groups")).rows[0].count, 1);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.lead_group_members")).rows[0].count, 2);
    const identities = await db.query("SELECT status, merged_into_lead_id FROM public.leads ORDER BY id");
    assert.ok(identities.rows.every((lead) => lead.status === "new" && lead.merged_into_lead_id === null));
  } finally { await db.close(); }
});

test("members can be added, softly removed, restored, and shared across different groups", async () => {
  const { db, propertyId, leads } = await setup();
  try {
    const first = await db.transaction((tx) => createLeadGroupInTransaction(adapter(tx), createInput(propertyId, leads)));
    await db.transaction((tx) => addLeadGroupMemberInTransaction(adapter(tx), { groupId: first.groupId, leadId: leads[2], role: "co_buyer", actorUsername: "synthetic-admin", operationKey: randomUUID() }));
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.lead_group_members WHERE removed_at IS NULL")).rows[0].count, 3);
    await db.transaction((tx) => removeLeadGroupMemberInTransaction(adapter(tx), { groupId: first.groupId, leadId: leads[2], actorUsername: "synthetic-admin", operationKey: randomUUID() }));
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.lead_group_members WHERE removed_at IS NULL")).rows[0].count, 2);
    await assert.rejects(db.transaction((tx) => removeLeadGroupMemberInTransaction(adapter(tx), { groupId: first.groupId, leadId: leads[1], actorUsername: "synthetic-admin", operationKey: randomUUID() })), /al menos dos personas/);
    await db.transaction((tx) => addLeadGroupMemberInTransaction(adapter(tx), { groupId: first.groupId, leadId: leads[2], role: "buyer", actorUsername: "synthetic-admin", operationKey: randomUUID() }));
    const second = await db.transaction((tx) => createLeadGroupInTransaction(adapter(tx), { ...createInput(propertyId, [leads[0], leads[2]]), title: "Segundo caso", operationKey: randomUUID() }));
    assert.notEqual(second.groupId, first.groupId);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.lead_group_members WHERE lead_id=$1::uuid AND removed_at IS NULL", [leads[0]])).rows[0].count, 2);
    await assert.rejects(db.transaction((tx) => removeLeadGroupMemberInTransaction(adapter(tx), { groupId: first.groupId, leadId: leads[0], actorUsername: "synthetic-admin", operationKey: randomUUID() })), /contacto principal/);
  } finally { await db.close(); }
});

test("shared notes and group follow-up remain distinct from individual lead notes", async () => {
  const { db, propertyId, leads } = await setup();
  try {
    const group = await db.transaction((tx) => createLeadGroupInTransaction(adapter(tx), createInput(propertyId, leads)));
    await db.transaction((tx) => addLeadGroupNoteInTransaction(adapter(tx), { groupId: group.groupId, body: "Nota del caso", actorUsername: "synthetic-admin", operationKey: randomUUID() }));
    await db.query("INSERT INTO public.lead_notes (lead_id, body, author_username, idempotency_key) VALUES ($1::uuid, 'Nota individual', 'synthetic-admin', $2::uuid)", [leads[0], randomUUID()]);
    await db.transaction((tx) => updateLeadGroupInTransaction(adapter(tx), { groupId: group.groupId, nextFollowUpAt: "2026-07-25T14:00:00.000Z", actorUsername: "synthetic-admin", operationKey: randomUUID() }));
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.lead_group_notes")).rows[0].count, 1);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.lead_notes")).rows[0].count, 1);
    assert.equal(new Date((await db.query("SELECT next_follow_up_at FROM public.lead_groups")).rows[0].next_follow_up_at).toISOString(), "2026-07-25T14:00:00.000Z");
  } finally { await db.close(); }
});

test("group creation rolls back when its audit event fails", async () => {
  const { db, propertyId, leads } = await setup();
  try {
    await db.exec(`CREATE FUNCTION reject_group_event() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'synthetic group audit failure'; END; $$ LANGUAGE plpgsql; CREATE TRIGGER reject_group_event_trigger BEFORE INSERT ON public.lead_group_events FOR EACH ROW EXECUTE FUNCTION reject_group_event();`);
    await assert.rejects(db.transaction((tx) => createLeadGroupInTransaction(adapter(tx), createInput(propertyId, leads))), /synthetic group audit failure/);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.lead_groups")).rows[0].count, 0);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.lead_group_members")).rows[0].count, 0);
  } finally { await db.close(); }
});

test("dashboard, Group 360, search, timeline, documents, follow-ups, permissions, and responsive structure are wired", async () => {
  const [directory, detail, query, followUps, leadPage, actions, nav] = await Promise.all([
    readRepo("app/admin/lead-groups/page.tsx"),
    readRepo("app/admin/lead-groups/[id]/page.tsx"),
    readRepo("lib/admin/queries/lead-groups.ts"),
    readRepo("lib/admin/queries/lead-follow-ups.ts"),
    readRepo("app/admin/leads/[id]/page.tsx"),
    readRepo("app/admin/lead-groups/actions.ts"),
    readRepo("components/admin/AdminNav.tsx"),
  ]);
  assert.match(directory, /Caso, persona, contacto o propiedad/);
  assert.match(query, /search_lead\.name ILIKE/);
  assert.match(query, /LIMIT 20/);
  assert.match(query, /LEAD_GROUP_PAGE_SIZE/);
  assert.match(detail, /Cronología combinada/);
  assert.match(detail, /Dueño:/);
  assert.match(detail, /Notas compartidas/);
  assert.match(detail, /Notas individuales/);
  assert.match(detail, /\/admin\/leads\/\$\{document\.ownerId\}\/documents/);
  assert.match(followUps, /entityType: "group"/);
  assert.match(followUps, /lead_group_members grouped_member/);
  assert.match(leadPage, /Crear caso compartido/);
  assert.match(actions, /const username = await getAdminSessionUser/);
  assert.match(actions, /await sql\.begin/);
  assert.match(nav, /\/admin\/lead-groups/);
  assert.match(detail, /grid min-w-0 gap-6 xl:grid-cols/);
  assert.doesNotMatch(`${actions}\n${query}\n${followUps}`, /console\.(log|info|warn|error)|analytics|track\(/i);
  assert.doesNotMatch(`${directory}\n${detail}`, /w-\[[4-9][0-9]{2}px\]/);
});
