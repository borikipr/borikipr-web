import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { createSignatureDomainServices } from "../lib/signatures/domain/service.ts";
import { hashSignatureFieldDefinition } from "../lib/signatures/field-definition.ts";
import { sha256SignatureValue } from "../lib/signatures/domain/crypto.ts";
import { finalizeCompletedSignatureDocument } from "../lib/signatures/signer/finalize.ts";
import { isPublicSigningEnabled } from "../lib/signatures/public-config.ts";
import { shouldExcludeAnalyticsPath } from "../lib/analytics-routes.ts";
import { normalizeSignerCapture } from "../lib/signatures/signer/capture.ts";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const [foundationSql, signerSql, sourceBytes] = await Promise.all([
  readFile(path.join(root, "db/migrations/0022_create_signature_foundation.sql"), "utf8"),
  readFile(path.join(root, "db/migrations/0023_extend_signature_signer_evidence.sql"), "utf8"),
  readFile(path.join(root, "tests/fixtures/signatures/rejections/valid-ordinary.pdf")),
]);

function pgliteDatabase(db) {
  const executor = (source) => ({ async unsafe(query, parameters = []) { return (await source.query(query, parameters)).rows; } });
  return { ...executor(db), begin: (callback) => db.transaction((transaction) => callback(executor(transaction))) };
}

const db = new PGlite();
const clockState = { now: new Date("2031-01-05T12:00:00.000Z") };
let adminId;
let services;

before(async () => {
  await db.exec(`CREATE TABLE public.admin_users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text NOT NULL UNIQUE);
    CREATE TABLE public.leads (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE TABLE public.lead_groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    INSERT INTO public.admin_users(username) VALUES ('synthetic-phase2d-admin');`);
  adminId = (await db.query(`SELECT id::text FROM public.admin_users LIMIT 1`)).rows[0].id;
  await db.exec(foundationSql); await db.exec(signerSql);
});

beforeEach(async () => {
  clockState.now = new Date("2031-01-05T12:00:00.000Z");
  await db.exec(`TRUNCATE public.signature_events, public.signature_field_values, public.signature_sessions,
    public.signature_signing_tokens, public.signature_fields, public.signature_participants,
    public.signature_document_versions, public.signature_documents CASCADE`);
  services = createSignatureDomainServices({ database: pgliteDatabase(db),
    eventHmacKey: "phase2d-event-key-at-least-thirty-two-bytes", eventHmacKeyVersion: 1,
    networkEvidenceHmacKey: "phase2d-network-key-at-least-thirty-two-bytes", clock: () => new Date(clockState.now) });
});
after(() => db.close());

const geometry = { pageIndex: 0, mediaBox: { x: 0, y: 0, width: 612, height: 792 }, cropBox: { x: 0, y: 0, width: 612, height: 792 }, rotation: 0, userUnit: 1 };

async function syntheticRequest({ participants = 1 } = {}) {
  const documentId = randomUUID(); const sourceSha256 = sha256SignatureValue(sourceBytes);
  const draft = await services.createDraftWithVersion({ documentId, title: "Synthetic Phase 2D signing request",
    documentType: "ordinary_brokerage_agreement", createdByAdminId: adminId, filename: "synthetic.pdf",
    byteCount: sourceBytes.byteLength, pageCount: 1, sourceSha256, pageGeometryManifest: [geometry],
    documentCreatedIdempotencyKey: randomUUID(), versionCreatedIdempotencyKey: randomUUID() });
  const participantRows = [];
  for (let index = 0; index < participants; index += 1) participantRows.push(await services.addParticipant({
    documentVersionId: draft.documentVersionId, nameSnapshot: `Synthetic Participant ${index + 1}`,
    emailSnapshot: `synthetic-${index + 1}@example.test`, role: index ? "seller" : "buyer", routingOrder: index + 1,
    actorAdminId: adminId, idempotencyKey: randomUUID() }));
  const definitions = [["signature", "Firma dibujada", { maxPoints: 2000 }], ["signature", "Firma escrita", { maxLength: 120 }],
    ["initials", "Iniciales", { maxLength: 8 }], ["date", "Fecha", {}], ["text", "Texto", { maxLength: 500 }]];
  const fields = [];
  for (let index = 0; index < definitions.length; index += 1) {
    const [fieldType, label, validationLimits] = definitions[index];
    fields.push(await services.addField({ documentVersionId: draft.documentVersionId, participantId: participantRows[0].participantId,
      fieldType, pageIndex: 0, rect: { x: 0.08, y: 0.1 + index * 0.12, width: 0.38, height: 0.08 },
      pageGeometryReference: geometry, label, required: true, tabOrder: index + 1, validationLimits,
      actorAdminId: adminId, idempotencyKey: randomUUID() }));
  }
  if (participants > 1) fields.push(await services.addField({ documentVersionId: draft.documentVersionId,
    participantId: participantRows[1].participantId, fieldType: "signature", pageIndex: 0,
    rect: { x: 0.52, y: 0.1, width: 0.38, height: 0.08 }, pageGeometryReference: geometry,
    label: "Firma vendedor", required: true, tabOrder: 1, validationLimits: { maxLength: 120 }, actorAdminId: adminId,
    idempotencyKey: randomUUID() }));
  const rows = (await db.query(`SELECT participant_id::text, field_type, page_index, normalized_x::float8,
    normalized_y::float8, normalized_width::float8, normalized_height::float8, required, tab_order, validation_limits
    FROM public.signature_fields WHERE document_version_id=$1::uuid`, [draft.documentVersionId])).rows;
  const fieldHash = hashSignatureFieldDefinition({ documentVersionId: draft.documentVersionId, fields: rows.map((row) => ({
    participantId: row.participant_id, fieldType: row.field_type, pageIndex: row.page_index, normalizedX: row.normalized_x,
    normalizedY: row.normalized_y, normalizedWidth: row.normalized_width, normalizedHeight: row.normalized_height,
    required: row.required, tabOrder: row.tab_order, validationLimits: row.validation_limits })) });
  await db.query(`UPDATE public.signature_document_versions SET field_definition_sha256=$2, locked_at=$3 WHERE id=$1::uuid`, [draft.documentVersionId, fieldHash, clockState.now]);
  await db.query(`UPDATE public.signature_documents SET document_type_approval_reference='synthetic-test-only', status='sent', sent_at=$2 WHERE id=$1::uuid`, [documentId, clockState.now]);
  for (const participant of participantRows) await services.transitionParticipantState({ participantId: participant.participantId,
    targetStatus: "invited", actorClass: "admin", actorAdminId: adminId, idempotencyKey: randomUUID() });
  return { ...draft, documentId, sourceSha256, participants: participantRows, fields, fieldHash };
}

async function sessionFixture(options) {
  const fixture = await syntheticRequest(options);
  const issued = await services.issueSigningToken({ participantId: fixture.participants[0].participantId,
    documentVersionId: fixture.documentVersionId, expiresAt: new Date("2031-01-05T13:00:00Z"), keyVersion: 1,
    actorAdminId: adminId, idempotencyKey: randomUUID() });
  const session = await services.redeemSigningToken({ plaintextToken: issued.plaintextToken, idempotencyKey: randomUUID(),
    networkAddress: "192.0.2.10", userAgent: "synthetic-agent" });
  return { fixture, issued, session };
}

test("public signing defaults closed and signer paths are excluded from analytics", () => {
  assert.equal(isPublicSigningEnabled({}), false); assert.equal(isPublicSigningEnabled({ SIGNING_PUBLIC_ENABLED: "false" }), false);
  assert.equal(isPublicSigningEnabled({ SIGNING_PUBLIC_ENABLED: "true" }), true);
  assert.equal(shouldExcludeAnalyticsPath("/firmar/token"), true); assert.equal(shouldExcludeAnalyticsPath("/firmar/sesion"), true);
});

test("eligibility inspection does not consume a token; exchange is one-time", async () => {
  const fixture = await syntheticRequest();
  const issued = await services.issueSigningToken({ participantId: fixture.participants[0].participantId,
    documentVersionId: fixture.documentVersionId, expiresAt: new Date("2031-01-05T13:00:00Z"), keyVersion: 1,
    actorAdminId: adminId, idempotencyKey: randomUUID() });
  assert.equal((await services.inspectSigningToken(issued.plaintextToken)).eligible, true);
  assert.equal((await db.query(`SELECT consumed_at FROM public.signature_signing_tokens WHERE id=$1`, [issued.tokenId])).rows[0].consumed_at, null);
  await services.redeemSigningToken({ plaintextToken: issued.plaintextToken, idempotencyKey: randomUUID() });
  await assert.rejects(services.redeemSigningToken({ plaintextToken: issued.plaintextToken, idempotencyKey: randomUUID() }), /signature_token_verification_failed/);
  assert.equal((await services.inspectSigningToken("bad-token")).eligible, false);
});

test("expired and revoked tokens fail with the same result", async () => {
  const fixture = await syntheticRequest();
  const issued = await services.issueSigningToken({ participantId: fixture.participants[0].participantId,
    documentVersionId: fixture.documentVersionId, expiresAt: new Date("2031-01-05T12:01:00Z"), keyVersion: 1,
    actorAdminId: adminId, idempotencyKey: randomUUID() });
  clockState.now = new Date("2031-01-05T12:02:00Z"); assert.deepEqual(await services.inspectSigningToken(issued.plaintextToken), { eligible: false });
  clockState.now = new Date("2031-01-05T12:00:00Z"); await services.revokeSigningToken({ tokenId: issued.tokenId, actorAdminId: adminId, idempotencyKey: randomUUID() });
  assert.deepEqual(await services.inspectSigningToken(issued.plaintextToken), { eligible: false });
});

test("consent, CSRF, ownership, limits, and immutable submissions are enforced", async () => {
  const { fixture, session } = await sessionFixture({ participants: 2 });
  await assert.rejects(services.submitSignerField({ sessionId: session.sessionId, sessionSecret: session.sessionSecret,
    csrfNonce: session.csrfNonce, fieldId: fixture.fields[0].fieldId, value: { method: "typed", value: "Synthetic" },
    idempotencyKey: randomUUID() }), /signature_field_not_owned/);
  await assert.rejects(services.acceptSignerConsent({ sessionId: session.sessionId, sessionSecret: session.sessionSecret,
    csrfNonce: "wrong", consentVersion: "phase2d-synthetic-v1", consentTextSha256: "a".repeat(64), locale: "es-PR",
    idempotencyKey: randomUUID() }), /signature_session_invalid/);
  await services.acceptSignerConsent({ sessionId: session.sessionId, sessionSecret: session.sessionSecret,
    csrfNonce: session.csrfNonce, consentVersion: "phase2d-synthetic-v1", consentTextSha256: "a".repeat(64), locale: "es-PR",
    idempotencyKey: randomUUID() });
  await assert.rejects(services.submitSignerField({ sessionId: session.sessionId, sessionSecret: session.sessionSecret,
    csrfNonce: session.csrfNonce, fieldId: fixture.fields.at(-1).fieldId, value: { method: "typed", value: "Not mine" },
    idempotencyKey: randomUUID() }), /signature_field_not_owned/);
  assert.throws(() => normalizeSignerCapture("signature", { method: "typed", value: "x".repeat(121) }));
  assert.throws(() => normalizeSignerCapture("signature", { method: "drawn", strokes: [Array.from({ length: 2001 }, () => ({ x: 0.5, y: 0.5 }))] }));
  assert.throws(() => normalizeSignerCapture("text", { method: "text", value: "<script>alert(1)</script>" }), /markup_rejected/);
  await services.submitSignerField({ sessionId: session.sessionId, sessionSecret: session.sessionSecret, csrfNonce: session.csrfNonce,
    fieldId: fixture.fields[0].fieldId, value: { method: "drawn", strokes: [[{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.7 }]] }, idempotencyKey: randomUUID() });
  await assert.rejects(services.submitSignerField({ sessionId: session.sessionId, sessionSecret: session.sessionSecret,
    csrfNonce: session.csrfNonce, fieldId: fixture.fields[0].fieldId, value: { method: "typed", value: "Replay" },
    idempotencyKey: randomUUID() }), /signature_field_already_completed/);
  await assert.rejects(db.query(`UPDATE public.signature_field_values SET sanitized_value_payload='{}' WHERE signature_field_id=$1`, [fixture.fields[0].fieldId]), /immutable/);
});

test("session idle expiry fails closed", async () => {
  const { session } = await sessionFixture(); clockState.now = new Date("2031-01-05T12:11:00Z");
  await assert.rejects(services.getSessionContext({ sessionId: session.sessionId, sessionSecret: session.sessionSecret }), /signature_session_invalid/);
});

test("synthetic flow finalizes once, writes private outputs, and verifies event chain", async () => {
  const { fixture, session } = await sessionFixture();
  await services.acceptSignerConsent({ sessionId: session.sessionId, sessionSecret: session.sessionSecret, csrfNonce: session.csrfNonce,
    consentVersion: "phase2d-synthetic-v1", consentTextSha256: "b".repeat(64), locale: "es-PR", idempotencyKey: randomUUID() });
  const values = [{ method: "drawn", strokes: [[{ x: 0.1, y: 0.2 }, { x: 0.7, y: 0.6 }]] },
    { method: "typed", value: "Synthetic Signer" }, { method: "typed", value: "SS" },
    { method: "date", value: "2031-01-05" }, { method: "text", value: "Synthetic acceptance only" }];
  for (let index = 0; index < 5; index += 1) await services.submitSignerField({ sessionId: session.sessionId,
    sessionSecret: session.sessionSecret, csrfNonce: session.csrfNonce, fieldId: fixture.fields[index].fieldId,
    value: values[index], idempotencyKey: randomUUID() });
  const completed = await services.completeSignerParticipant({ sessionId: session.sessionId, sessionSecret: session.sessionSecret,
    csrfNonce: session.csrfNonce, idempotencyKey: randomUUID() }); assert.equal(completed.allParticipantsCompleted, true);
  const objects = new Map([[fixture.sourceR2Key, new Uint8Array(sourceBytes)]]);
  const storage = { async getSource() { return new Uint8Array(sourceBytes); }, async putSource() { return "existing"; },
    async deleteSourceIfExact() { return false; }, async putFinal(input) { assert.match(input.key, /^signatures\/final\//); objects.set(input.key, input.bytes); return "created"; },
    async putCertificate(input) { assert.match(input.key, /^signatures\/certificates\//); objects.set(input.key, input.bytes); return "created"; } };
  const runtime = { database: pgliteDatabase(db), domain: services, storage };
  const concurrent = await Promise.all([
    finalizeCompletedSignatureDocument(fixture.documentId, runtime),
    finalizeCompletedSignatureDocument(fixture.documentId, runtime),
  ]);
  const first = concurrent.find((result) => !result.existing);
  const second = await finalizeCompletedSignatureDocument(fixture.documentId, runtime);
  assert.ok(first); assert.equal(second.existing, true); assert.equal(first.finalSha256, second.finalSha256);
  assert.equal(objects.size, 3); assert.equal((await services.verifyEventChain(fixture.documentId)).valid, true);
  const state = (await db.query(`SELECT d.status, v.finalized_at, v.final_pdf_sha256, v.certificate_sha256
    FROM public.signature_documents d JOIN public.signature_document_versions v ON v.id=d.active_version_id WHERE d.id=$1`, [fixture.documentId])).rows[0];
  assert.equal(state.status, "completed"); assert.ok(state.finalized_at); assert.match(state.final_pdf_sha256, /^[0-9a-f]{64}$/); assert.match(state.certificate_sha256, /^[0-9a-f]{64}$/);
});

test("event, source, and field substitution are rejected", async () => {
  const fixture = await syntheticRequest();
  await assert.rejects(db.query(`UPDATE public.signature_events SET controlled_metadata='{}' WHERE document_id=$1`, [fixture.documentId]), /append-only/);
  await assert.rejects(db.query(`UPDATE public.signature_document_versions SET source_sha256=$2 WHERE id=$1`, [fixture.documentVersionId, "f".repeat(64)]), /immutable/);
  await assert.rejects(db.query(`UPDATE public.signature_fields SET normalized_x=.2 WHERE id=$1`, [fixture.fields[0].fieldId]), /immutable/);
});

test("0023 stores no plaintext token, consent copy, or PDF body", async () => {
  const columns = (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name IN ('signature_participants','signature_field_values')
    AND column_name IN ('consent_text','plaintext_token','pdf_content','sanitized_value_payload') ORDER BY column_name`)).rows.map((row) => row.column_name);
  assert.deepEqual(columns, ["sanitized_value_payload"]);
});

test("signer routes enforce the server gate, same-origin POSTs, private headers, and no email/public storage", async () => {
  const [landing, exchange, consent, field, complete, config, storage] = await Promise.all([
    readFile(path.join(root, "app/firmar/[token]/page.tsx"), "utf8"),
    readFile(path.join(root, "app/api/signatures/session/exchange/route.ts"), "utf8"),
    readFile(path.join(root, "app/api/signatures/session/consent/route.ts"), "utf8"),
    readFile(path.join(root, "app/api/signatures/session/field/route.ts"), "utf8"),
    readFile(path.join(root, "app/api/signatures/session/complete/route.ts"), "utf8"),
    readFile(path.join(root, "next.config.ts"), "utf8"),
    readFile(path.join(root, "lib/signatures/storage.ts"), "utf8"),
  ]);
  for (const route of [landing, exchange, consent, field, complete]) assert.match(route, /isPublicSigningEnabled/);
  for (const route of [exchange, consent, field, complete]) assert.match(route, /sameSignerOrigin/);
  assert.match(exchange, /checkRateLimit/); assert.match(exchange, /httpOnly: true/); assert.match(exchange, /sameSite: "strict"/);
  assert.match(config, /source: "\/firmar\/:path\*"/); assert.match(config, /Referrer-Policy/); assert.match(config, /noindex, nofollow/);
  assert.doesNotMatch(landing + exchange + consent + field + complete, /Resend|sendEmail/);
  assert.doesNotMatch(storage, /publicUrl|presign|R2_PUBLIC_BASE_URL/);
});
