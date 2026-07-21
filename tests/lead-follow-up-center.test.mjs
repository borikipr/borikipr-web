import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

process.env.DATABASE_URL ||= "postgresql://local-test.invalid/neondb";

const {
  buildLeadGroupFollowUpQuery,
  buildLeadFollowUpListQuery,
  buildLeadFollowUpSummaryQuery,
  normalizeLeadFollowUpFilters,
} = await import("../lib/admin/queries/lead-follow-ups.ts");
const { markLeadContacted, setLeadFollowUp } = await import("../lib/admin/lead-follow-up-mutations.ts");

const root = new URL("..", import.meta.url);
const readMigration = (name) => readFile(new URL(`db/migrations/${name}`, root), "utf8");
const [leadsSql, typedSql, lead360Sql, contactedSql, leadGroupsSql, pageSource, actionsSource] = await Promise.all([
  readMigration("0001_create_leads.sql"),
  readMigration("0002_create_typed_lead_tables.sql"),
  readMigration("0007_create_lead_360.sql"),
  readMigration("0008_add_lead_contacted_event.sql"),
  readMigration("0011_create_lead_groups.sql"),
  readFile(new URL("app/admin/leads/seguimientos/page.tsx", root), "utf8"),
  readFile(new URL("app/admin/leads/seguimientos/actions.ts", root), "utf8"),
]);

const referenceNow = "2026-07-21T16:00:00.000Z"; // noon in Puerto Rico
let db;
const ids = {};

function transactionAdapter() {
  return {
    async unsafe(text, values = []) {
      return (await db.query(text, values)).rows;
    },
  };
}

async function run(query) {
  return (await db.query(query.text, query.values)).rows;
}

async function insertLead(key, { name, status = "active", createdAt, lastActivityAt, nextFollowUpAt = null, email = null, phone = null }) {
  const contactEmail = email ?? `${key}@example.invalid`;
  const row = await db.query(`
    INSERT INTO public.leads (
      name, status, email_original, email_normalized, phone_original, phone_normalized,
      created_at, updated_at, last_activity_at, next_follow_up_at
    ) VALUES ($1, $2, $3, $3, $4, $4, $5::timestamptz, $5::timestamptz, $6::timestamptz, $7::timestamptz)
    RETURNING id::text
  `, [name, status, contactEmail, phone, createdAt, lastActivityAt, nextFollowUpAt]);
  ids[key] = row.rows[0].id;
}

before(async () => {
  db = new PGlite();
  await db.exec(leadsSql);
  await db.exec(`
    CREATE TABLE public.propiedades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), titulo text NOT NULL,
      slug text NOT NULL UNIQUE, municipio text NULL
    );
    CREATE TABLE public.property_priority_registrations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lead_id uuid NULL REFERENCES public.leads(id),
      property_id uuid NOT NULL REFERENCES public.propiedades(id), property_title text NOT NULL,
      property_slug text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.consultas_propiedad (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lead_id uuid NULL REFERENCES public.leads(id),
      propiedad_id uuid NOT NULL REFERENCES public.propiedades(id), created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.exec(typedSql);
  await db.exec(lead360Sql);
  await db.exec(contactedSql);
  await db.exec(leadGroupsSql);

  await insertLead("overdue", { name: "Overdue Synthetic", createdAt: "2026-07-01T12:00:00Z", lastActivityAt: "2026-07-20T12:00:00Z", nextFollowUpAt: "2026-07-21T15:00:00Z", email: "overdue@example.invalid" });
  await insertLead("today", { name: "Today Synthetic", createdAt: "2026-07-20T12:00:00Z", lastActivityAt: "2026-07-20T12:00:00Z", nextFollowUpAt: "2026-07-21T18:00:00Z", phone: "+17870000002" });
  await insertLead("upcoming", { name: "Upcoming Synthetic", createdAt: "2026-07-20T12:00:00Z", lastActivityAt: "2026-07-20T12:00:00Z", nextFollowUpAt: "2026-07-27T14:00:00Z" });
  await insertLead("new", { name: "New Synthetic", status: "new", createdAt: "2026-07-21T14:00:00Z", lastActivityAt: "2026-07-21T14:00:00Z" });
  await insertLead("inactive", { name: "Inactive Synthetic", createdAt: "2026-06-01T12:00:00Z", lastActivityAt: "2026-07-06T12:00:00Z" });
  await insertLead("closed", { name: "Archived Synthetic", status: "archived", createdAt: "2026-06-01T12:00:00Z", lastActivityAt: "2026-06-01T12:00:00Z", nextFollowUpAt: "2026-07-01T12:00:00Z" });
  await insertLead("multiple", { name: "Multiple Synthetic", status: "new", createdAt: "2026-06-01T12:00:00Z", lastActivityAt: "2026-06-01T12:00:00Z", nextFollowUpAt: "2026-07-01T12:00:00Z" });

  const property = await db.query(`INSERT INTO public.propiedades (titulo, slug, municipio) VALUES ('Casa sintética', 'casa-sintetica', 'Ponce') RETURNING id::text`);
  await db.query(`INSERT INTO public.property_priority_registrations (lead_id, property_id, property_title, property_slug, created_at) VALUES ($1::uuid, $2::uuid, 'Casa sintética', 'casa-sintetica', '2026-07-20T12:00:00Z')`, [ids.overdue, property.rows[0].id]);
});

after(async () => db.close());

test("classifies overdue, due today in Puerto Rico, upcoming seven days, new, and inactive", async () => {
  const rows = await run(buildLeadFollowUpListQuery(normalizeLeadFollowUpFilters({}), referenceNow));
  const byName = Object.fromEntries(rows.map((row) => [row.name, row.bucket]));
  assert.equal(byName["Overdue Synthetic"], "overdue");
  assert.equal(byName["Today Synthetic"], "today");
  assert.equal(byName["Upcoming Synthetic"], "upcoming");
  assert.equal(byName["New Synthetic"], "new_without_follow_up");
  assert.equal(byName["Inactive Synthetic"], "inactive");
  assert.equal(byName["Archived Synthetic"], undefined);
});

test("a lead matching several rules appears once in its highest-priority bucket", async () => {
  const rows = await run(buildLeadFollowUpListQuery(normalizeLeadFollowUpFilters({ q: "Multiple" }), referenceNow));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bucket, "overdue");
  assert.ok(rows[0].secondary_flags.includes("inactive"));
});

test("search, status, source, property, and bucket filters combine safely", async () => {
  const property = (await db.query("SELECT id::text FROM public.propiedades LIMIT 1")).rows[0].id;
  const filters = normalizeLeadFollowUpFilters({ q: "Overdue", status: "active", source: "priority_registration", property, bucket: "overdue" });
  const rows = await run(buildLeadFollowUpListQuery(filters, referenceNow));
  assert.deepEqual(rows.map((row) => row.name), ["Overdue Synthetic"]);
  assert.equal(normalizeLeadFollowUpFilters({ status: "unsafe", sort: "broken" }).invalid, true);
});

test("urgency ordering and canonical summary counts are deterministic", async () => {
  const filters = normalizeLeadFollowUpFilters({ sort: "urgency" });
  const rows = await run(buildLeadFollowUpListQuery(filters, referenceNow));
  assert.deepEqual(rows.slice(0, 5).map((row) => row.bucket), ["overdue", "overdue", "today", "upcoming", "new_without_follow_up"]);
  const summary = await run(buildLeadFollowUpSummaryQuery(referenceNow));
  const counts = Object.fromEntries(summary.map((row) => [row.bucket, Number(row.count)]));
  assert.equal(counts.overdue, 2);
  assert.equal(counts.today, 1);
});

test("quick follow-up update and clear are transactional and audited", async () => {
  const adapter = transactionAdapter();
  await markLeadContacted(adapter, { leadId: ids.new, operationKey: randomUUID(), username: "synthetic-admin" });
  const contacted = await db.query("SELECT status, last_activity_at FROM public.leads WHERE id = $1::uuid", [ids.new]);
  assert.equal(contacted.rows[0].status, "active");

  await setLeadFollowUp(adapter, { leadId: ids.new, nextAt: "2026-07-23T14:00:00.000Z", operationKey: randomUUID(), username: "synthetic-admin", actionableOnly: true });
  assert.equal(new Date((await db.query("SELECT next_follow_up_at FROM public.leads WHERE id = $1::uuid", [ids.new])).rows[0].next_follow_up_at).toISOString(), "2026-07-23T14:00:00.000Z");
  await setLeadFollowUp(adapter, { leadId: ids.new, nextAt: null, operationKey: randomUUID(), username: "synthetic-admin", actionableOnly: true });
  assert.equal((await db.query("SELECT next_follow_up_at FROM public.leads WHERE id = $1::uuid", [ids.new])).rows[0].next_follow_up_at, null);
  const events = await db.query("SELECT event_type FROM public.lead_management_events WHERE lead_id = $1::uuid ORDER BY created_at", [ids.new]);
  assert.deepEqual(events.rows.map((row) => row.event_type), ["contacted", "follow_up_changed", "follow_up_changed"]);
});

test("actions require authentication, use POST server actions, and do not log PII", () => {
  assert.match(actionsSource, /await requireAdmin\(\)/);
  assert.match(actionsSource, /await sql\.begin/);
  assert.doesNotMatch(actionsSource, /console\.(log|error|warn)/);
  assert.doesNotMatch(pageSource, /method="get"[^>]*action=\{(?:mark|set)/);
});

test("follow-up center has mobile-safe structure and every required empty state", () => {
  assert.match(pageSource, /min-w-0/);
  assert.match(pageSource, /sm:grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.doesNotMatch(pageSource, /w-\[[4-9][0-9]{2}px\]/);
  for (const copy of ["No hay seguimientos vencidos", "No hay seguimientos pendientes para hoy", "No hay seguimientos en los próximos siete días", "No hay resultados"]) assert.match(pageSource, new RegExp(copy));
});

test("an active case replaces its members with one aggregated follow-up item", async () => {
  const propertyId = (await db.query("SELECT id::text FROM public.propiedades LIMIT 1")).rows[0].id;
  const group = await db.query(`
    INSERT INTO public.lead_groups (
      title, status, primary_property_id, next_follow_up_at, created_by
    ) VALUES ('Caso sintético', 'active', $1::uuid, '2026-07-21T18:00:00Z', 'synthetic-admin')
    RETURNING id::text
  `, [propertyId]);
  await db.query(`
    INSERT INTO public.lead_group_members (
      group_id, lead_id, role, is_primary_contact, created_by
    ) VALUES
      ($1::uuid, $2::uuid, 'buyer', true, 'synthetic-admin'),
      ($1::uuid, $3::uuid, 'co_buyer', false, 'synthetic-admin')
  `, [group.rows[0].id, ids.today, ids.upcoming]);

  const filters = normalizeLeadFollowUpFilters({});
  const individualRows = await run(buildLeadFollowUpListQuery(filters, referenceNow));
  assert.equal(individualRows.some((row) => row.id === ids.today || row.id === ids.upcoming), false);

  const groupRows = await run(buildLeadGroupFollowUpQuery(filters, referenceNow));
  assert.equal(groupRows.length, 1);
  assert.equal(groupRows[0].name, "Caso sintético");
  assert.equal(groupRows[0].bucket, "today");
  assert.deepEqual([...groupRows[0].member_names].sort(), ["Today Synthetic", "Upcoming Synthetic"]);

  const individualView = normalizeLeadFollowUpFilters({ individuals: "1" });
  const visiblePeople = await run(buildLeadFollowUpListQuery(individualView, referenceNow));
  assert.equal(visiblePeople.some((row) => row.id === ids.today), true);
  assert.equal(visiblePeople.some((row) => row.id === ids.upcoming), true);
  assert.equal((await run(buildLeadGroupFollowUpQuery(individualView, referenceNow))).length, 0);
  assert.match(pageSource, /Vista operativa/);
  assert.match(pageSource, /Mostrar personas individuales/);
});
