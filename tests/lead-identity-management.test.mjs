import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  mergeLeadsInTransaction,
  resolveMergedFollowUp,
  resolveMergedLeadStatus,
} from "../lib/admin/lead-merge.ts";

process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
const { buildRelatedPersonSearchQuery } = await import(
  "../lib/admin/queries/lead-identity-management.ts"
);

async function readRepo(path) {
  return readFile(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
}

const [
  leadsSql,
  typedSql,
  lead360Sql,
  contactedSql,
  documentSql,
  mergeSql,
] = await Promise.all([
  readRepo("db/migrations/0001_create_leads.sql"),
  readRepo("db/migrations/0002_create_typed_lead_tables.sql"),
  readRepo("db/migrations/0007_create_lead_360.sql"),
  readRepo("db/migrations/0008_add_lead_contacted_event.sql"),
  readRepo("db/migrations/0009_add_document_accessed_event.sql"),
  readRepo("db/migrations/0010_add_transactional_lead_merges.sql"),
]);

async function setupDatabase() {
  const db = new PGlite();
  await db.exec(leadsSql);
  await db.exec(`
    CREATE TABLE public.propiedades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo text NOT NULL,
      slug text NOT NULL UNIQUE
    );
  `);
  await db.exec(typedSql);
  await db.exec(`
    CREATE TABLE public.property_priority_registrations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id uuid NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
      property_id uuid NOT NULL REFERENCES public.propiedades(id) ON DELETE RESTRICT,
      email text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX property_priority_registrations_lead_id_idx
      ON public.property_priority_registrations (lead_id) WHERE lead_id IS NOT NULL;

    CREATE TABLE public.consultas_propiedad (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id uuid NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
      propiedad_id uuid NOT NULL REFERENCES public.propiedades(id) ON DELETE RESTRICT,
      carta_precalificacion_key text NULL,
      carta_precalificacion_status text NULL,
      evidencia_fondos_key text NULL,
      evidencia_fondos_status text NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX consultas_propiedad_lead_created_at_idx
      ON public.consultas_propiedad (lead_id, created_at DESC) WHERE lead_id IS NOT NULL;

    CREATE TABLE public.email_queue (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      canonical_lead_id uuid NULL REFERENCES public.leads(id) ON DELETE SET NULL,
      status text NOT NULL,
      dedupe_key text NULL,
      sent_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX email_queue_dedupe_key_uidx
      ON public.email_queue (dedupe_key) WHERE dedupe_key IS NOT NULL;
    CREATE INDEX email_queue_canonical_lead_id_idx
      ON public.email_queue (canonical_lead_id) WHERE canonical_lead_id IS NOT NULL;
  `);
  await db.exec(lead360Sql);
  await db.exec(contactedSql);
  await db.exec(documentSql);
  await db.exec(mergeSql);
  return db;
}

async function insertLead(db, overrides = {}) {
  const id = overrides.id ?? randomUUID();
  await db.query(
    `INSERT INTO public.leads (
      id, name, email_original, email_normalized, phone_original, phone_normalized,
      status, identity_status, first_seen_at, last_activity_at, created_at,
      updated_at, next_follow_up_at
    ) VALUES (
      $1::uuid, $2, $3, $4, $5, $6, $7, 'provisional',
      $8::timestamptz, $9::timestamptz, $8::timestamptz, now(), $10::timestamptz
    )`,
    [
      id,
      overrides.name ?? "Persona sintética",
      overrides.email ?? `${id.slice(0, 8)}@example.test`,
      overrides.emailNormalized ?? overrides.email ?? `${id.slice(0, 8)}@example.test`,
      overrides.phone ?? null,
      overrides.phoneNormalized ?? null,
      overrides.status ?? "new",
      overrides.firstSeenAt ?? "2026-07-01T12:00:00Z",
      overrides.lastActivityAt ?? "2026-07-10T12:00:00Z",
      overrides.nextFollowUpAt ?? null,
    ]
  );
  return id;
}

function transactionAdapter(transaction) {
  return {
    async unsafe(text, values = []) {
      return (await transaction.query(text, values)).rows;
    },
  };
}

async function runMerge(db, input) {
  return db.transaction((transaction) =>
    mergeLeadsInTransaction(transactionAdapter(transaction), input)
  );
}

async function seedFullMerge(db) {
  const primary = await insertLead(db, {
    name: "Principal sintética",
    email: "primary@example.test",
    emailNormalized: "primary@example.test",
    phone: "7871111111",
    phoneNormalized: "7871111111",
    status: "new",
    firstSeenAt: "2026-07-05T12:00:00Z",
    lastActivityAt: "2026-07-11T12:00:00Z",
    nextFollowUpAt: "2026-07-30T14:00:00Z",
  });
  const secondary = await insertLead(db, {
    name: "Secundaria sintética",
    email: "alternate@example.test",
    emailNormalized: "alternate@example.test",
    phone: "7872222222",
    phoneNormalized: "7872222222",
    status: "active",
    firstSeenAt: "2026-06-01T12:00:00Z",
    lastActivityAt: "2026-07-15T12:00:00Z",
    nextFollowUpAt: "2026-07-20T14:00:00Z",
  });
  const other = await insertLead(db, {
    name: "Tercera sintética",
    email: "third@example.test",
    emailNormalized: "third@example.test",
  });
  const property = (await db.query(
    "INSERT INTO public.propiedades (titulo, slug) VALUES ('Propiedad sintética', 'propiedad-sintetica') RETURNING id::text"
  )).rows[0].id;

  await db.query("INSERT INTO public.property_priority_registrations (lead_id, property_id, email) VALUES ($1::uuid, $2::uuid, 'alternate@example.test')", [secondary, property]);
  await db.query(`INSERT INTO public.property_buyer_profiles (
    lead_id, property_id, name_snapshot, phone_snapshot, purchase_method,
    document_type, document_object_key, document_original_name,
    document_content_type, document_size_bytes, document_status,
    idempotency_key, source_path
  ) VALUES ($1::uuid, $2::uuid, 'Secundaria', '7872222222', 'Cash',
    'proof_of_funds', 'private/synthetic.pdf', 'synthetic.pdf', 'application/pdf',
    1234, 'uploaded', $3::uuid, '/listados/propiedad-sintetica/perfil-comprador')`, [secondary, property, randomUUID()]);
  await db.query(`INSERT INTO public.buyer_tenant_inquiries (
    lead_id, name_snapshot, phone_snapshot, idempotency_key, source_path
  ) VALUES ($1::uuid, 'Secundaria', '7872222222', $2::uuid, '/contact/compradores-arrendatarios')`, [secondary, randomUUID()]);
  await db.query(`INSERT INTO public.seller_landlord_inquiries (
    lead_id, name_snapshot, email_snapshot, phone_snapshot, idempotency_key, source_path
  ) VALUES ($1::uuid, 'Secundaria', 'alternate@example.test', '7872222222', $2::uuid, '/contact/vendedor-arrendador')`, [secondary, randomUUID()]);
  await db.query(`INSERT INTO public.consultas_propiedad (
    lead_id, propiedad_id, carta_precalificacion_key, carta_precalificacion_status
  ) VALUES ($1::uuid, $2::uuid, 'private/open-house.pdf', 'uploaded')`, [secondary, property]);
  await db.query("INSERT INTO public.lead_notes (lead_id, body, author_username, idempotency_key) VALUES ($1::uuid, 'Nota sintética', 'test-admin', $2::uuid)", [secondary, randomUUID()]);
  await db.query("INSERT INTO public.lead_management_events (lead_id, event_type, event_data, actor_username, idempotency_key) VALUES ($1::uuid, 'contacted', '{}'::jsonb, 'test-admin', $2::uuid)", [secondary, randomUUID()]);
  await db.query("INSERT INTO public.email_queue (canonical_lead_id, status, dedupe_key, sent_at) VALUES ($1::uuid, 'sent', 'sent-intent', '2026-07-10T12:00:00Z'), ($1::uuid, 'pending', 'pending-intent', NULL)", [secondary]);
  await db.query("INSERT INTO public.lead_relationships (lead_id, related_lead_id, relationship_type, created_by) VALUES ($1::uuid, $2::uuid, 'family', 'test-admin'), ($3::uuid, $2::uuid, 'prequalified_person', 'test-admin'), ($1::uuid, $3::uuid, 'co_buyer', 'test-admin')", [secondary, other, primary]);
  await db.query("INSERT INTO public.lead_duplicate_reviews (lead_id, compared_lead_id, decision, decided_by) VALUES ($1::uuid, $2::uuid, 'same_person', 'test-admin'), ($1::uuid, $3::uuid, 'same_person', 'test-admin'), ($2::uuid, $3::uuid, 'keep_separate', 'test-admin')", [primary, secondary, other]);
  return { primary, secondary, other, property };
}

test("complete lead reference matrix is explicit and uses safe delete behavior", async () => {
  const db = await setupDatabase();
  try {
    const rows = await db.query(`
      SELECT source.relname AS table_name, attribute.attname AS column_name,
        attribute.attnotnull AS not_null, constraint_row.confdeltype
      FROM pg_constraint constraint_row
      JOIN pg_class source ON source.oid = constraint_row.conrelid
      JOIN unnest(constraint_row.conkey) key_column(attnum) ON true
      JOIN pg_attribute attribute ON attribute.attrelid = source.oid AND attribute.attnum = key_column.attnum
      WHERE constraint_row.contype = 'f'
        AND constraint_row.confrelid = 'public.leads'::regclass
      ORDER BY source.relname, attribute.attname
    `);
    assert.equal(rows.rows.length, 15);
    assert.ok(rows.rows.every((row) => row.confdeltype === "r" || (row.table_name === "email_queue" && row.confdeltype === "n")));
    assert.deepEqual(rows.rows.filter((row) => row.table_name === "lead_relationships").map((row) => row.column_name), ["lead_id", "related_lead_id"]);
    assert.deepEqual(rows.rows.filter((row) => row.table_name === "lead_merge_events").map((row) => row.column_name), ["primary_lead_id", "secondary_lead_id"]);
  } finally { await db.close(); }
});

test("global related-person search excludes current and merged leads and normalizes contacts", async () => {
  const db = await setupDatabase();
  try {
    const current = await insertLead(db, { name: "Actual", email: "actual@example.test", emailNormalized: "actual@example.test" });
    const candidate = await insertLead(db, { name: "Persona relacionada", email: "match@example.test", emailNormalized: "match@example.test", phone: "(787) 555-1212", phoneNormalized: "7875551212" });
    const query = buildRelatedPersonSearchQuery(current, "MATCH@EXAMPLE.TEST");
    const rows = await db.query(query.text, query.values);
    assert.deepEqual(rows.rows.map((row) => row.id), [candidate]);
    assert.equal(rows.rows[0].email_exact_match, true);
    assert.match(query.text, /id <> \$1::uuid/);
    assert.match(query.text, /merged_into_lead_id IS NULL/);
    assert.ok(!query.text.includes("MATCH@EXAMPLE.TEST"));
  } finally { await db.close(); }
});

test("people with different contact information can be found and related manually", async () => {
  const db = await setupDatabase();
  try {
    const current = await insertLead(db, { name: "Primera", email: "first@example.test", emailNormalized: "first@example.test" });
    const related = await insertLead(db, { name: "Familiar buscada", email: "other@example.test", emailNormalized: "other@example.test" });
    const query = buildRelatedPersonSearchQuery(current, "Familiar buscada");
    assert.equal((await db.query(query.text, query.values)).rows[0].id, related);
    await db.query("INSERT INTO public.lead_relationships (lead_id, related_lead_id, relationship_type, created_by) VALUES ($1::uuid, $2::uuid, 'family', 'test-admin')", [current, related]);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.lead_relationships")).rows[0].count, 1);
  } finally { await db.close(); }
});

test("successful merge reassigns every source, preserves notes, documents, events and queue state", async () => {
  const db = await setupDatabase();
  try {
    const fixture = await seedFullMerge(db);
    const operationKey = randomUUID();
    const result = await runMerge(db, { primaryLeadId: fixture.primary, secondaryLeadId: fixture.secondary, actorUsername: "test-admin", operationKey });
    assert.equal(result.survivingLeadId, fixture.primary);
    assert.equal(result.alreadyMerged, false);

    for (const table of ["property_priority_registrations", "property_buyer_profiles", "buyer_tenant_inquiries", "seller_landlord_inquiries", "consultas_propiedad", "lead_notes", "lead_management_events"]) {
      assert.equal((await db.query(`SELECT count(*)::int AS count FROM public.${table} WHERE lead_id = $1::uuid`, [fixture.secondary])).rows[0].count, 0);
    }
    const document = (await db.query("SELECT lead_id::text, document_object_key, document_original_name FROM public.property_buyer_profiles")).rows[0];
    assert.equal(document.lead_id, fixture.primary);
    assert.equal(document.document_object_key, "private/synthetic.pdf");
    assert.equal(document.document_original_name, "synthetic.pdf");
    const queue = await db.query("SELECT canonical_lead_id::text, status, sent_at FROM public.email_queue ORDER BY status");
    assert.ok(queue.rows.every((row) => row.canonical_lead_id === fixture.primary));
    assert.equal(queue.rows.find((row) => row.status === "sent").sent_at.toISOString(), "2026-07-10T12:00:00.000Z");
    assert.equal(queue.rows.find((row) => row.status === "pending").sent_at, null);

    const merged = (await db.query("SELECT status, merged_into_lead_id::text, merged_at, merged_by, next_follow_up_at FROM public.leads WHERE id = $1::uuid", [fixture.secondary])).rows[0];
    assert.equal(merged.status, "merged");
    assert.equal(merged.merged_into_lead_id, fixture.primary);
    assert.ok(merged.merged_at);
    assert.equal(merged.merged_by, "test-admin");
    assert.equal(merged.next_follow_up_at, null);
  } finally { await db.close(); }
});

test("merge resolves relationships and reviews without self-pairs or duplicates", async () => {
  const db = await setupDatabase();
  try {
    const fixture = await seedFullMerge(db);
    await runMerge(db, { primaryLeadId: fixture.primary, secondaryLeadId: fixture.secondary, actorUsername: "test-admin", operationKey: randomUUID() });
    const relationships = await db.query("SELECT lead_id::text, related_lead_id::text, relationship_type FROM public.lead_relationships ORDER BY relationship_type");
    assert.equal(relationships.rows.length, 1);
    assert.ok(relationships.rows.every((row) => row.lead_id !== row.related_lead_id));
    assert.equal(relationships.rows[0].relationship_type, "prequalified_person");
    const reviewPair = await db.query("SELECT decision FROM public.lead_duplicate_reviews WHERE LEAST(lead_id, compared_lead_id) = LEAST($1::uuid, $2::uuid) AND GREATEST(lead_id, compared_lead_id) = GREATEST($1::uuid, $2::uuid)", [fixture.primary, fixture.secondary]);
    assert.equal(reviewPair.rows[0].decision, "merged");
    const otherReviews = await db.query("SELECT decision FROM public.lead_duplicate_reviews WHERE lead_id = $1::uuid OR compared_lead_id = $1::uuid", [fixture.other]);
    assert.deepEqual(otherReviews.rows.map((row) => row.decision).sort(), ["keep_separate"]);
  } finally { await db.close(); }
});

test("status and follow-up resolution are deterministic and preserve restrictions", () => {
  assert.equal(resolveMergedLeadStatus("new", "active"), "active");
  assert.equal(resolveMergedLeadStatus("active", "do_not_contact"), "do_not_contact");
  assert.equal(resolveMergedLeadStatus("archived", "new"), "new");
  assert.equal(resolveMergedFollowUp("2026-07-30T12:00:00Z", "2026-07-20T12:00:00Z"), "2026-07-20T12:00:00.000Z");
});

test("conflicting identity values and both prior follow-ups are preserved in merge audit", async () => {
  const db = await setupDatabase();
  try {
    const fixture = await seedFullMerge(db);
    await runMerge(db, { primaryLeadId: fixture.primary, secondaryLeadId: fixture.secondary, actorUsername: "test-admin", operationKey: randomUUID() });
    const audit = (await db.query("SELECT identity_snapshot, affected_counts FROM public.lead_merge_events")).rows[0];
    assert.equal(audit.identity_snapshot.primary.email, "primary@example.test");
    assert.equal(audit.identity_snapshot.secondary.email, "alternate@example.test");
    assert.equal(audit.identity_snapshot.resolution.conflictingContactValues, true);
    assert.equal(audit.identity_snapshot.primary.nextFollowUpAt, "2026-07-30T14:00:00.000Z");
    assert.equal(audit.identity_snapshot.secondary.nextFollowUpAt, "2026-07-20T14:00:00.000Z");
    assert.equal(audit.affected_counts.documents, 2);
  } finally { await db.close(); }
});

test("production-shaped shared-contact pair writes JSON audit objects with driver-safe casts", async () => {
  const db = await setupDatabase();
  try {
    const sharedEmail = "shared@example.test";
    const sharedPhone = "7875550101";
    const primary = await insertLead(db, {
      name: "Perfil sintético",
      email: sharedEmail,
      emailNormalized: sharedEmail,
      phone: sharedPhone,
      phoneNormalized: sharedPhone,
    });
    const secondary = await insertLead(db, {
      name: "Registro sintético",
      email: sharedEmail,
      emailNormalized: sharedEmail,
      phone: sharedPhone,
      phoneNormalized: sharedPhone,
    });
    await db.query("UPDATE public.leads SET identity_status='conflict' WHERE id=$1::uuid", [primary]);
    const property = (await db.query("INSERT INTO public.propiedades (titulo, slug) VALUES ('Forma realista', 'forma-realista') RETURNING id::text")).rows[0].id;
    await db.query(`INSERT INTO public.property_buyer_profiles (
      lead_id, property_id, name_snapshot, phone_snapshot, purchase_method,
      idempotency_key, source_path
    ) VALUES ($1::uuid, $2::uuid, 'Perfil sintético', $3, 'Cash', $4::uuid,
      '/listados/forma-realista/perfil-comprador')`, [primary, property, sharedPhone, randomUUID()]);
    await db.query("INSERT INTO public.property_priority_registrations (lead_id, property_id, email) VALUES ($1::uuid, $2::uuid, $3)", [secondary, property, sharedEmail]);
    await db.query("INSERT INTO public.email_queue (canonical_lead_id, status, dedupe_key) VALUES ($1::uuid, 'sent', 'profile-sent'), ($2::uuid, 'sent', 'priority-sent')", [primary, secondary]);

    await runMerge(db, {
      primaryLeadId: primary,
      secondaryLeadId: secondary,
      actorUsername: "test-admin",
      operationKey: randomUUID(),
    });
    const audit = (await db.query("SELECT jsonb_typeof(identity_snapshot) AS identity_type, jsonb_typeof(affected_counts) AS counts_type FROM public.lead_merge_events")).rows[0];
    assert.deepEqual(audit, { identity_type: "object", counts_type: "object" });
    const engineSource = await readRepo("lib/admin/lead-merge.ts");
    assert.match(engineSource, /\$5::text::jsonb, \$6::text::jsonb/);
  } finally { await db.close(); }
});

test("repeated merge is idempotent and reverse or chained merges are rejected", async () => {
  const db = await setupDatabase();
  try {
    const primary = await insertLead(db);
    const secondary = await insertLead(db);
    const operationKey = randomUUID();
    const first = await runMerge(db, { primaryLeadId: primary, secondaryLeadId: secondary, actorUsername: "test-admin", operationKey });
    const repeated = await runMerge(db, { primaryLeadId: primary, secondaryLeadId: secondary, actorUsername: "test-admin", operationKey });
    assert.equal(first.survivingLeadId, repeated.survivingLeadId);
    assert.equal(repeated.alreadyMerged, true);
    await assert.rejects(
      runMerge(db, { primaryLeadId: secondary, secondaryLeadId: primary, actorUsername: "test-admin", operationKey: randomUUID() }),
      /principal ya fue fusionado/
    );
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.lead_merge_events")).rows[0].count, 1);
  } finally { await db.close(); }
});

test("same-ID and guessed lead identifiers are rejected without writes", async () => {
  const same = randomUUID();
  await assert.rejects(
    mergeLeadsInTransaction({}, {
      primaryLeadId: same,
      secondaryLeadId: same,
      actorUsername: "test-admin",
      operationKey: randomUUID(),
    }),
    /dos personas diferentes/
  );
  const db = await setupDatabase();
  try {
    const existing = await insertLead(db);
    await assert.rejects(
      runMerge(db, {
        primaryLeadId: existing,
        secondaryLeadId: randomUUID(),
        actorUsername: "test-admin",
        operationKey: randomUUID(),
      }),
      /ambas identidades/
    );
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.lead_merge_events")).rows[0].count, 0);
  } finally { await db.close(); }
});

test("deterministic locks and database uniqueness protect concurrent merge attempts", async () => {
  const engineSource = await readRepo("lib/admin/lead-merge.ts");
  const migrationSource = await readRepo("db/migrations/0010_add_transactional_lead_merges.sql");
  assert.match(engineSource, /const lockIds = \[input\.primaryLeadId, input\.secondaryLeadId\]\.sort\(\)/);
  assert.match(engineSource, /ORDER BY id\s+FOR UPDATE/);
  assert.match(migrationSource, /UNIQUE INDEX lead_merge_events_secondary_lead_id_uidx/);
  assert.match(migrationSource, /UNIQUE INDEX lead_merge_events_operation_key_uidx/);
});

test("dependency failure rolls the entire merge transaction back", async () => {
  const db = await setupDatabase();
  try {
    const primary = await insertLead(db);
    const secondary = await insertLead(db);
    const property = (await db.query("INSERT INTO public.propiedades (titulo, slug) VALUES ('Conflicto', 'conflicto') RETURNING id::text")).rows[0].id;
    await db.query("INSERT INTO public.property_priority_registrations (lead_id, property_id, email) VALUES ($1::uuid, $3::uuid, 'a@example.test'), ($2::uuid, $3::uuid, 'b@example.test')", [primary, secondary, property]);
    await db.exec("CREATE UNIQUE INDEX synthetic_merge_conflict_uidx ON public.property_priority_registrations (lead_id, property_id)");
    await assert.rejects(runMerge(db, { primaryLeadId: primary, secondaryLeadId: secondary, actorUsername: "test-admin", operationKey: randomUUID() }));
    const leads = await db.query("SELECT id::text, status, merged_into_lead_id FROM public.leads WHERE id = ANY($1::uuid[]) ORDER BY id", [[primary, secondary]]);
    assert.ok(leads.rows.every((row) => row.status !== "merged" && row.merged_into_lead_id === null));
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.property_priority_registrations WHERE lead_id = $1::uuid", [secondary])).rows[0].count, 1);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM public.lead_merge_events")).rows[0].count, 0);
  } finally { await db.close(); }
});

test("directory, Follow-up Center and old Lead 360 route contain merged-lead protections", async () => {
  const [directory, followUps, page, identityQuery] = await Promise.all([
    readRepo("lib/admin/queries/canonical-leads.ts"),
    readRepo("lib/admin/queries/lead-follow-ups.ts"),
    readRepo("app/admin/leads/[id]/page.tsx"),
    readRepo("lib/admin/queries/lead-identity-management.ts"),
  ]);
  assert.match(directory, /l\.merged_into_lead_id IS NULL/);
  assert.match(followUps, /l\.merged_into_lead_id IS NULL/);
  assert.match(page, /merged_alias=1/);
  assert.match(page, /Los registros se fusionaron correctamente\./);
  assert.match(identityQuery, /WITH RECURSIVE lineage/);
});

test("comparison requires two-step confirmation and stays mobile-safe", async () => {
  const [component, page] = await Promise.all([
    readRepo("components/admin/LeadMergeConfirmation.tsx"),
    readRepo("app/admin/leads/[id]/fusionar/[candidateId]/page.tsx"),
  ]);
  assert.match(component, /review_acknowledged/);
  assert.match(component, /confirmation === "FUSIONAR"/);
  assert.match(component, /disabled=\{!canSubmit\}/);
  assert.match(component, /sm:grid-cols-2/);
  assert.match(page, /grid min-w-0 gap-6 xl:grid-cols-2/);
  assert.doesNotMatch(page, /overflow-x-auto/);
});

test("merge actions are authenticated, validate IDs, use POST server actions and avoid PII logging", async () => {
  const [actions, engine, query, component] = await Promise.all([
    readRepo("app/admin/leads/[id]/actions.ts"),
    readRepo("lib/admin/lead-merge.ts"),
    readRepo("lib/admin/queries/lead-identity-management.ts"),
    readRepo("components/admin/LeadMergeConfirmation.tsx"),
  ]);
  assert.match(actions, /const username = await requireAdmin\(\)/);
  assert.match(actions, /requiredUuid\(formData, "primary_lead_id"\)/);
  assert.match(actions, /confirmation !== "FUSIONAR"/);
  assert.match(actions, /merge_error=rolled_back/);
  assert.match(actions, /merge_result=unconfirmed/);
  assert.match(actions, /redirect\(`\/admin\/leads\/\$\{result\.survivingLeadId\}\?merged=1`\)/);
  assert.match(component, /action=\{mergeLeadsAction\}/);
  assert.doesNotMatch(`${actions}\n${engine}\n${query}`, /console\.(log|info|warn|error)/);
  assert.doesNotMatch(`${actions}\n${engine}\n${query}`, /analytics|track\(/i);
});

test("merge failure UX distinguishes confirmed rollback from ambiguous post-commit state", async () => {
  const [comparisonPage, leadPage, actions] = await Promise.all([
    readRepo("app/admin/leads/[id]/fusionar/[candidateId]/page.tsx"),
    readRepo("app/admin/leads/[id]/page.tsx"),
    readRepo("app/admin/leads/[id]/actions.ts"),
  ]);
  assert.match(comparisonPage, /No se pudo completar la fusión\. Ningún cambio fue aplicado/);
  assert.match(leadPage, /No se pudo confirmar el resultado automáticamente/);
  assert.match(actions, /isConfirmedDatabaseRollback/);
  assert.doesNotMatch(actions, /try\s*\{[\s\S]*redirect\(`\/admin\/leads\/\$\{result\.survivingLeadId\}\?merged=1`\)[\s\S]*\}\s*catch/);
});
