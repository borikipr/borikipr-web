import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { createSignatureAdminRepository } from "../lib/signatures/admin-repository.ts";
import { getSignatureSecurityConfig } from "../lib/signatures/config.ts";
import { createSignatureDraftApplicationService, SignatureDraftValidationError } from "../lib/signatures/draft-application.ts";
import { createSignatureDomainServices } from "../lib/signatures/domain/service.ts";
import { hashSignatureFieldDefinition } from "../lib/signatures/field-definition.ts";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const migrationSql = await readFile(path.join(root, "db/migrations/0022_create_signature_foundation.sql"), "utf8");
const signerMigrationSql = await readFile(path.join(root, "db/migrations/0023_extend_signature_signer_evidence.sql"), "utf8");
const deliveryMigrationSql = await readFile(path.join(root, "db/migrations/0024_add_signature_delivery_governance.sql"), "utf8");
const compatibleBytes = new Uint8Array(await readFile(path.join(root, "tests/fixtures/signatures/representative/HOJA DE OFERTA - con logo.pdf")));
const EVENT_KEY = Buffer.alloc(32, 7).toString("base64url");
const OLD_KEY = Buffer.alloc(32, 3).toString("base64url");
const NETWORK_KEY = Buffer.alloc(32, 11).toString("base64url");

function pgliteDatabase(db) {
  const executor = (source) => ({ async unsafe(query, parameters = []) { return (await source.query(query, parameters)).rows; } });
  return { ...executor(db), begin: (callback) => db.transaction((transaction) => callback(executor(transaction))) };
}

function fakeStorage() {
  const objects = new Map();
  return {
    objects, putCalls: 0, deleteCalls: 0,
    async putSource(input) { this.putCalls += 1; if (objects.has(input.key)) return "existing"; objects.set(input.key, structuredClone(input)); return "created"; },
    async getSource(input) { return objects.get(input.key)?.bytes; },
    async deleteSourceIfExact(input) { this.deleteCalls += 1; return objects.delete(input.key); },
  };
}

const db = new PGlite();
let adminId;
let database;
let domain;

before(async () => {
  await db.exec(`
    CREATE TABLE public.admin_users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text NOT NULL UNIQUE);
    CREATE TABLE public.leads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, merged_into_lead_id uuid NULL, last_activity_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE public.lead_groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, status text NOT NULL DEFAULT 'new', updated_at timestamptz NOT NULL DEFAULT now());
    INSERT INTO public.admin_users (username) VALUES ('phase2c-admin');
  `);
  adminId = (await db.query(`SELECT id::text FROM public.admin_users LIMIT 1`)).rows[0].id;
  await db.exec(migrationSql);
  await db.exec(signerMigrationSql);
  await db.exec(deliveryMigrationSql);
  database = pgliteDatabase(db);
});

beforeEach(async () => {
  await db.exec(`TRUNCATE TABLE public.signature_events, public.signature_field_values, public.signature_sessions, public.signature_signing_tokens, public.signature_fields, public.signature_participants, public.signature_document_versions, public.signature_documents CASCADE;`);
  domain = createSignatureDomainServices({
    database,
    eventHmacKey: Buffer.from(EVENT_KEY, "base64url"), eventHmacKeyVersion: 2,
    resolveEventHmacKey: (version) => version === 2 ? Buffer.from(EVENT_KEY, "base64url") : version === 1 ? Buffer.from(OLD_KEY, "base64url") : null,
    networkEvidenceHmacKey: Buffer.from(NETWORK_KEY, "base64url"),
  });
});

after(async () => db.close());

test("Phase 2C creates a compatible private draft and deterministic whole-layout preview", async () => {
  const storage = fakeStorage();
  const drafts = createSignatureDraftApplicationService({ domain, storage });
  const created = await drafts.createDraft({ title: "Borrador sintético Phase 2C", documentType: "ordinary_offer_or_contract", createdByAdminId: adminId, filename: "synthetic-offer.pdf", mimeType: "application/pdf", bytes: compatibleBytes });
  assert.equal(created.compatibility.compatible, true);
  assert.equal(storage.putCalls, 1);
  assert.equal(storage.objects.size, 1);
  assert.match([...storage.objects.keys()][0], /^signatures\/source\/[0-9a-f-]{36}\/1\/[0-9a-f]{64}\.pdf$/);

  const participant = await domain.addParticipant({ documentVersionId: created.documentVersionId, nameSnapshot: "Synthetic Participant", emailSnapshot: "participant@example.test", phoneSnapshot: null, role: "buyer", routingOrder: 1, actorAdminId: adminId, idempotencyKey: randomUUID() });
  const geometry = (await db.query(`SELECT page_geometry_manifest FROM public.signature_document_versions WHERE id=$1::uuid`, [created.documentVersionId])).rows[0].page_geometry_manifest[0];
  await domain.addField({ documentVersionId: created.documentVersionId, participantId: participant.participantId, fieldType: "signature", pageIndex: 0, rect: { x: 0.1, y: 0.7, width: 0.3, height: 0.08 }, pageGeometryReference: geometry, label: "Firma", required: true, tabOrder: 1, validationLimits: {}, actorAdminId: adminId, idempotencyKey: randomUUID() });
  const detail = await createSignatureAdminRepository(database).detail(created.documentId);
  assert.equal(detail.participants.length, 1);
  assert.equal(detail.fields.length, 1);
  assert.equal(detail.version.sourceSha256, created.compatibility.sourceSha256);
  assert.equal(detail.currentFieldDefinitionSha256.length, 64);
  assert.equal(detail.currentFieldDefinitionSha256, hashSignatureFieldDefinition({ documentVersionId: detail.version.id, fields: [...detail.fields].reverse() }));

  await assert.rejects(domain.prepareDocumentForSend({ documentId: created.documentId, actorAdminId: adminId, idempotencyKey: randomUUID(), locale: "es", publicSigningEnabled: true }), /signature_document_type_not_counsel_approved/);
  const counts = await db.query(`SELECT (SELECT count(*) FROM public.signature_signing_tokens)::integer AS tokens, (SELECT count(*) FROM public.signature_documents WHERE status <> 'draft')::integer AS non_drafts`);
  assert.deepEqual(counts.rows[0], { tokens: 0, non_drafts: 0 });
});

test("field-definition hashing ignores order but changes for meaningful geometry", () => {
  const fields = [
    { participantId: "a", fieldType: "signature", pageIndex: 0, normalizedX: 0.1, normalizedY: 0.2, normalizedWidth: 0.3, normalizedHeight: 0.1, required: true, tabOrder: 1, validationLimits: {} },
    { participantId: "b", fieldType: "date", pageIndex: 1, normalizedX: 0.4, normalizedY: 0.5, normalizedWidth: 0.2, normalizedHeight: 0.06, required: true, tabOrder: 2, validationLimits: {} },
  ];
  const hash = hashSignatureFieldDefinition({ documentVersionId: "version", fields });
  assert.equal(hash, hashSignatureFieldDefinition({ documentVersionId: "version", fields: [...fields].reverse() }));
  assert.notEqual(hash, hashSignatureFieldDefinition({ documentVersionId: "version", fields: [{ ...fields[0], normalizedX: 0.11 }, fields[1]] }));
});

test("unsupported uploads fail before storage or database persistence", async () => {
  const storage = fakeStorage();
  const drafts = createSignatureDraftApplicationService({ domain, storage });
  await assert.rejects(drafts.createDraft({ title: "Invalid", documentType: "lease", createdByAdminId: adminId, filename: "invalid.pdf", mimeType: "text/plain", bytes: new Uint8Array([1, 2, 3]) }), (error) => error instanceof SignatureDraftValidationError && error.code === "invalid_mime");
  assert.equal(storage.putCalls, 0);
  assert.equal((await db.query(`SELECT count(*)::integer AS count FROM public.signature_documents`)).rows[0].count, 0);
});

test("new source objects are removed when the atomic database create fails", async () => {
  const storage = fakeStorage();
  const failingDomain = { ...domain, async createDraftWithVersion() { throw new Error("synthetic_database_failure"); } };
  const drafts = createSignatureDraftApplicationService({ domain: failingDomain, storage });
  await assert.rejects(drafts.createDraft({ title: "Cleanup", documentType: "lease", createdByAdminId: adminId, filename: "cleanup.pdf", mimeType: "application/pdf", bytes: compatibleBytes }), /synthetic_database_failure/);
  assert.equal(storage.putCalls, 1);
  assert.equal(storage.deleteCalls, 1);
  assert.equal(storage.objects.size, 0);
});

test("server-only HMAC key ring fails closed and resolves historical versions", () => {
  assert.throws(() => getSignatureSecurityConfig({}), /signature_event_hmac_current_version_invalid/);
  const config = getSignatureSecurityConfig({ SIGNATURE_EVENT_HMAC_KEYS_JSON: JSON.stringify({ 1: OLD_KEY, 2: EVENT_KEY }), SIGNATURE_EVENT_HMAC_CURRENT_VERSION: "2", SIGNATURE_NETWORK_EVIDENCE_HMAC_KEY: NETWORK_KEY });
  assert.equal(config.currentVersion, 2);
  assert.deepEqual(config.configuredKeyVersions, [1, 2]);
  assert.equal(config.resolveEventHmacKey(1)?.byteLength, 32);
  assert.equal(config.resolveEventHmacKey(99), null);
  assert.throws(() => getSignatureSecurityConfig({ SIGNATURE_EVENT_HMAC_KEYS_JSON: "{}", SIGNATURE_EVENT_HMAC_CURRENT_VERSION: "1", SIGNATURE_NETWORK_EVIDENCE_HMAC_KEY: NETWORK_KEY }), /current_key_missing/);
});

test("Admin prototype remains private and the later signer surface is independently feature-gated", async () => {
  const [uploadRoute, sourceRoute, pageRoute, actions, editor, storage] = await Promise.all([
    readFile(path.join(root, "app/api/admin/signatures/drafts/route.ts"), "utf8"),
    readFile(path.join(root, "app/admin/signatures/[id]/source/route.ts"), "utf8"),
    readFile(path.join(root, "app/admin/signatures/[id]/pages/[pageIndex]/route.ts"), "utf8"),
    readFile(path.join(root, "app/admin/signatures/actions.ts"), "utf8"),
    readFile(path.join(root, "components/admin/signatures/SignatureDraftEditor.tsx"), "utf8"),
    readFile(path.join(root, "lib/signatures/storage.ts"), "utf8"),
  ]);
  for (const source of [uploadRoute, sourceRoute, pageRoute, actions]) assert.match(source, /getAdminSession/);
  assert.match(uploadRoute, /sameOrigin/);
  assert.match(uploadRoute, /checkRateLimit/);
  assert.match(sourceRoute, /private, no-store/);
  assert.match(sourceRoute, /noindex, nofollow/);
  assert.match(editor, /Este tipo de documento todavía no está autorizado para firma electrónica/);
  assert.doesNotMatch(uploadRoute + actions + editor, /Resend|sendEmail|issueSigningToken/);
  assert.doesNotMatch(storage, /publicUrl|presign|R2_PUBLIC_BASE_URL/);
  await access(path.join(root, "app/firmar"));
  const publicConfig = await readFile(path.join(root, "lib/signatures/public-config.ts"), "utf8");
  assert.match(publicConfig, /SIGNING_PUBLIC_ENABLED/);
  assert.match(publicConfig, /=== "true"/);
});

test("Admin editor exposes keyboard movement, participant assignment, limits, and responsive overflow", async () => {
  const source = await readFile(path.join(root, "components/admin/signatures/SignatureDraftEditor.tsx"), "utf8");
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /application\/x-borikipr-signature-field/);
  assert.match(source, /detail\.participants\.length.*\/8/);
  assert.match(source, /detail\.fields\.length.*\/100/);
  assert.match(source, /overflow-auto/);
  assert.match(source, /aria-label/);
});
