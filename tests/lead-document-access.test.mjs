import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

process.env.DATABASE_URL ||= "postgresql://local-test.invalid/neondb";

const {
  buildContentDisposition,
  buildLead360DocumentsQuery,
  buildLeadDocumentAccessQuery,
  deriveLeadDocumentState,
  formatDocumentSize,
  isPreviewableDocumentType,
  mapLeadDocumentRow,
  sanitizeDocumentFilename,
} = await import("../lib/admin/queries/lead-documents.ts");

const root = new URL("..", import.meta.url);
const readMigration = (name) => readFile(new URL(`db/migrations/${name}`, root), "utf8");
const [leadsSql, typedSql, lead360Sql, contactedSql, documentEventSql, pageSource, routeSource, buttonsSource] = await Promise.all([
  readMigration("0001_create_leads.sql"),
  readMigration("0002_create_typed_lead_tables.sql"),
  readMigration("0007_create_lead_360.sql"),
  readMigration("0008_add_lead_contacted_event.sql"),
  readMigration("0009_add_document_accessed_event.sql"),
  readFile(new URL("app/admin/leads/[id]/page.tsx", root), "utf8"),
  readFile(new URL("app/admin/leads/[id]/documents/[source]/[documentId]/route.ts", root), "utf8"),
  readFile(new URL("components/admin/DocumentAccessButtons.tsx", root), "utf8"),
]);

let db;
let leadId;
let otherLeadId;
let profileId;
let openHouseId;
let privateShowingId;

async function run(query) {
  return (await db.query(query.text, query.values)).rows;
}

before(async () => {
  db = new PGlite();
  await db.exec(leadsSql);
  await db.exec(`
    CREATE TABLE public.propiedades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), titulo text NOT NULL,
      slug text NOT NULL UNIQUE, municipio text NULL
    );
    CREATE TABLE public.consultas_propiedad (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), propiedad_id uuid NOT NULL REFERENCES public.propiedades(id),
      lead_id uuid NULL REFERENCES public.leads(id), metodo_compra text NULL,
      carta_precalificacion_url text NULL, evidencia_fondos text NULL,
      carta_precalificacion_key text NULL, evidencia_fondos_key text NULL,
      carta_precalificacion_status text NULL, evidencia_fondos_status text NULL,
      reused_property_buyer_profile_id uuid NULL,
      workflow_source text NOT NULL DEFAULT 'open_house',
      respuestas_personalizadas jsonb NULL, created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.exec(typedSql);
  await db.exec(lead360Sql);
  await db.exec(contactedSql);
  await db.exec(documentEventSql);

  const leads = await db.query(`INSERT INTO public.leads (name, email_normalized)
    VALUES ('Documento Sintético', 'document-one@example.invalid'),
           ('Otro Sintético', 'document-two@example.invalid') RETURNING id::text, name`);
  leadId = leads.rows.find((row) => row.name.startsWith("Documento")).id;
  otherLeadId = leads.rows.find((row) => row.name.startsWith("Otro")).id;
  const property = await db.query(`INSERT INTO public.propiedades (titulo, slug, municipio)
    VALUES ('Propiedad sintética', 'propiedad-documento', 'Ponce') RETURNING id::text`);
  const profile = await db.query(`INSERT INTO public.property_buyer_profiles (
      lead_id, property_id, name_snapshot, phone_snapshot, purchase_method,
      document_type, document_object_key, document_original_name,
      document_content_type, document_size_bytes, document_status,
      idempotency_key, source_path
    ) VALUES ($1::uuid, $2::uuid, 'Documento Sintético', '787-555-0100', 'Financiamiento',
      'prequalification_letter', 'private/buyer/profile.pdf', 'Carta precalificación.pdf',
      'application/pdf', 1536, 'uploaded', $3::uuid, '/listados/propiedad-documento/perfil-comprador')
    RETURNING id::text`, [leadId, property.rows[0].id, randomUUID()]);
  profileId = profile.rows[0].id;
  const openHouse = await db.query(`INSERT INTO public.consultas_propiedad (
      propiedad_id, lead_id, metodo_compra, evidencia_fondos_key,
      evidencia_fondos_status, respuestas_personalizadas
    ) VALUES ($1::uuid, $2::uuid, 'Cash', 'private/open-house/funds.png', 'uploaded',
      '{"document_metadata":{"original_name":"Fondos.png","content_type":"image/png","size_bytes":2048}}')
    RETURNING id::text`, [property.rows[0].id, leadId]);
  openHouseId = openHouse.rows[0].id;
  const privateShowing = await db.query(`INSERT INTO public.consultas_propiedad (
      propiedad_id, lead_id, metodo_compra, carta_precalificacion_key,
      carta_precalificacion_status, workflow_source, respuestas_personalizadas
    ) VALUES ($1::uuid, $2::uuid, 'Financiamiento',
      'private/private-showing/prequalification.pdf', 'uploaded',
      'private_showing',
      '{"document_metadata":{"original_name":"Precalificación.pdf","content_type":"application/pdf","size_bytes":1024}}')
    RETURNING id::text`, [property.rows[0].id, leadId]);
  privateShowingId = privateShowing.rows[0].id;
});

after(async () => db.close());

test("Lead 360 lists Property Buyer Profile documents", async () => {
  const rows = await run(buildLead360DocumentsQuery(leadId));
  const document = mapLeadDocumentRow(rows.find((row) => row.source_type === "property_buyer_profile"));
  assert.equal(document.categoryLabel, "Carta de precalificación");
  assert.equal(document.state, "available");
});

test("Lead 360 lists Open House documents", async () => {
  const rows = await run(buildLead360DocumentsQuery(leadId));
  const document = mapLeadDocumentRow(rows.find((row) => row.source_type === "open_house_registration"));
  assert.equal(document.categoryLabel, "Evidencia de fondos");
  assert.equal(document.propertyTitle, "Propiedad sintética");
});

test("Lead 360 lists Private Showing documents with distinct ownership source", async () => {
  const rows = await run(buildLead360DocumentsQuery(leadId));
  const document = mapLeadDocumentRow(
    rows.find((row) => row.source_type === "private_showing_registration")
  );
  assert.equal(document.sourceLabel, "Visita privada");
  assert.equal(document.categoryLabel, "Carta de precalificación");
  assert.equal(
    (
      await run(
        buildLeadDocumentAccessQuery(
          leadId,
          "private_showing_registration",
          privateShowingId
        )
      )
    ).length,
    1
  );
  assert.equal(
    (
      await run(
        buildLeadDocumentAccessQuery(
          otherLeadId,
          "private_showing_registration",
          privateShowingId
        )
      )
    ).length,
    0
  );
});

test("original filename and human-readable size are preserved for display", async () => {
  const rows = await run(buildLeadDocumentAccessQuery(leadId, "property_buyer_profile", profileId));
  const document = mapLeadDocumentRow(rows[0]);
  assert.equal(document.originalName, "Carta precalificación.pdf");
  assert.equal(formatDocumentSize(document.sizeBytes), "1.5 KB");
  assert.equal(formatDocumentSize(2 * 1024 * 1024), "2.0 MB");
});

test("document access requires admin authentication", () => {
  assert.match(routeSource, /await getAdminSessionUser\(\)/);
  assert.match(routeSource, /if \(!username\).*401/);
});

test("document resolution requires both canonical lead and submission", async () => {
  assert.equal((await run(buildLeadDocumentAccessQuery(leadId, "property_buyer_profile", profileId))).length, 1);
  assert.equal((await run(buildLeadDocumentAccessQuery(otherLeadId, "property_buyer_profile", profileId))).length, 0);
  assert.equal((await run(buildLeadDocumentAccessQuery(leadId, "open_house_registration", openHouseId))).length, 1);
});

test("unknown document IDs are rejected by the relationship query", async () => {
  assert.equal((await run(buildLeadDocumentAccessQuery(leadId, "property_buyer_profile", randomUUID()))).length, 0);
});

test("missing objects and stale metadata produce safe Spanish responses", () => {
  assert.match(routeSource, /El archivo ya no está disponible/);
  assert.match(routeSource, /Los metadatos del archivo no coinciden/);
  assert.match(routeSource, /inspectPrivateR2Object/);
});

test("pending and failed uploads never receive access controls", () => {
  const base = { objectKey: "private/file.pdf", originalName: "file.pdf", contentType: "application/pdf", sizeBytes: 100 };
  assert.equal(deriveLeadDocumentState({ ...base, status: "pending" }), "pending");
  assert.equal(deriveLeadDocumentState({ ...base, status: "failed" }), "failed");
  assert.equal(deriveLeadDocumentState({ ...base, status: "uploaded", originalName: null }), "metadata_incomplete");
  assert.match(pageSource, /document\.state === "available"/);
});

test("the authenticated proxy avoids permanent and expiring signed URLs", () => {
  assert.doesNotMatch(routeSource, /getSignedUrl|presign|X-Amz-/);
  assert.match(routeSource, /Cache-Control.*private, no-store/);
  assert.match(routeSource, /downloadPrivateR2Object/);
});

test("filenames reject traversal and CRLF header injection", () => {
  const safe = sanitizeDocumentFilename("../evil\r\nHeader: yes.pdf");
  assert.doesNotMatch(safe, /\.\.|\r|\n|\//);
  const header = buildContentDisposition("..\\evil\r\nX-Test: yes.pdf", false);
  assert.doesNotMatch(header, /\r|\n|\.\.|\\/);
  assert.match(header, /^attachment;/);
});

test("preview is limited to passive PDF and raster image MIME types", () => {
  for (const type of ["application/pdf", "image/jpeg", "image/png", "image/webp"]) assert.equal(isPreviewableDocumentType(type), true);
  for (const type of ["text/html", "image/svg+xml", "application/javascript", "application/msword"]) assert.equal(isPreviewableDocumentType(type), false);
  assert.match(routeSource, /application\/octet-stream/);
});

test("rendered HTML contains only protected relative routes, never R2 keys or URLs", () => {
  assert.match(pageSource, /\/admin\/leads\/\$\{leadId\}\/documents/);
  assert.doesNotMatch(pageSource, /documentObjectKey|objectKey|r2\.cloudflare|R2_PUBLIC/);
});

test("no object key or PII is written to analytics or logs", () => {
  assert.doesNotMatch(routeSource, /console\.(log|error|warn)|analytics|track\(/);
  assert.match(routeSource, /documentCategory/);
  assert.doesNotMatch(routeSource, /jsonb_build_object\([\s\S]*objectKey/);
});

test("document_accessed events store only safe interaction metadata", async () => {
  await db.query(`INSERT INTO public.lead_management_events (
    lead_id, event_type, event_data, actor_username, idempotency_key
  ) VALUES ($1::uuid, 'document_accessed', $2::jsonb, 'synthetic-admin', $3::uuid)`, [
    leadId,
    JSON.stringify({ sourceInteractionType: "property_buyer_profile", sourceInteractionId: profileId, documentCategory: "prequalification_letter" }),
    randomUUID(),
  ]);
  const row = (await db.query("SELECT event_data FROM public.lead_management_events WHERE event_type = 'document_accessed'")).rows[0];
  assert.deepEqual(Object.keys(row.event_data).sort(), ["documentCategory", "sourceInteractionId", "sourceInteractionType"]);
});

test("Lead 360 timeline renders document access events", () => {
  assert.match(pageSource, /event\.type === "document_accessed"/);
  assert.match(pageSource, /consultado/);
});

test("access responses are private, nosniff, and non-cacheable", () => {
  assert.match(routeSource, /X-Content-Type-Options/);
  assert.match(routeSource, /no-store/);
  assert.match(routeSource, /Content-Disposition/);
  assert.match(routeSource, /default-src 'none'; sandbox/);
});

test("buttons prevent repeated clicks while opening a protected route", () => {
  assert.match(buttonsSource, /if \(opening\) return/);
  assert.match(buttonsSource, /disabled=\{opening !== null\}/);
  assert.match(buttonsSource, /noopener,noreferrer/);
});

test("document section is mobile-safe and wraps long filenames", () => {
  assert.match(pageSource, /min-w-0/);
  assert.match(pageSource, /break-all/);
  assert.match(buttonsSource, /min-h-11/);
  assert.doesNotMatch(pageSource + buttonsSource, /w-\[[4-9][0-9]{2}px\]/);
});
