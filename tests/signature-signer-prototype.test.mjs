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
import { SIGNER_COOKIE_PATH } from "../lib/signatures/signer/cookie.ts";
import { isIsolatedLocalSignerRequest, sameSignerOrigin } from "../lib/signatures/signer/origin.ts";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const [foundationSql, signerSql, deliverySql, privacyBindingSql, privacyHistorySql, sourceBytes] = await Promise.all([
  readFile(path.join(root, "db/migrations/0022_create_signature_foundation.sql"), "utf8"),
  readFile(path.join(root, "db/migrations/0023_extend_signature_signer_evidence.sql"), "utf8"),
  readFile(path.join(root, "db/migrations/0024_add_signature_delivery_governance.sql"), "utf8"),
  readFile(path.join(root, "db/migrations/0025_bind_signature_privacy_disclosure.sql"), "utf8"),
  readFile(path.join(root, "db/migrations/0026_preserve_signature_privacy_disclosure_text.sql"), "utf8"),
  readFile(path.join(root, "tests/fixtures/signatures/rejections/valid-ordinary.pdf")),
]);
const phase2GovernanceMigrations = await Promise.all(["0027_add_signature_launch_governance.sql","0028_harden_signature_launch_governance.sql","0029_add_signature_governance_workflows.sql","0030_harden_signature_governance_workflow_immutability.sql","0031_add_signature_legal_holds.sql","0032_correct_signature_business_governance.sql","0033_harden_signature_preflight_authorization.sql","0034_add_signature_operational_hiding.sql"].map((name)=>readFile(path.join(root,"db/migrations",name),"utf8")));

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
  await db.exec(foundationSql); await db.exec(signerSql); await db.exec(deliverySql); await db.exec(privacyBindingSql); await db.exec(privacyHistorySql);
  for (const migration of phase2GovernanceMigrations) await db.exec(migration);
});

beforeEach(async () => {
  clockState.now = new Date("2031-01-05T12:00:00.000Z");
  await db.exec(`TRUNCATE public.signature_events, public.signature_field_values, public.signature_sessions,
    public.signature_signing_tokens, public.signature_fields, public.signature_participants,
    public.signature_document_versions, public.signature_documents CASCADE`);
  await db.exec(`TRUNCATE public.signature_delivery_intents, public.signature_consent_versions,
    public.signature_document_type_approvals CASCADE`);
  services = createSignatureDomainServices({ database: pgliteDatabase(db),
    eventHmacKey: "phase2d-event-key-at-least-thirty-two-bytes", eventHmacKeyVersion: 1,
    networkEvidenceHmacKey: "phase2d-network-key-at-least-thirty-two-bytes", clock: () => new Date(clockState.now) });
});
after(() => db.close());

const geometry = { pageIndex: 0, mediaBox: { x: 0, y: 0, width: 612, height: 792 }, cropBox: { x: 0, y: 0, width: 612, height: 792 }, rotation: 0, userUnit: 1 };
const syntheticConsentText = "PROTOTIPO SINTÉTICO — NO APROBADO LEGALMENTE. Consentimiento técnico aislado.";
const syntheticConsentSha = sha256SignatureValue(syntheticConsentText);
const syntheticPrivacyEsPrText = "Aviso sintético de privacidad para pruebas aisladas solamente.";
const syntheticPrivacyEnUsText = "Synthetic privacy notice for isolated technical testing only.";
const syntheticPrivacyEsPrSha = sha256SignatureValue(syntheticPrivacyEsPrText);
const syntheticPrivacyEnUsSha = sha256SignatureValue(syntheticPrivacyEnUsText);

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
  const approval = (await db.query(`INSERT INTO public.signature_document_type_approvals
    (document_type,status,approval_reference,approval_date,reviewed_by,source_reference,effective_from,legacy_imported,approval_mode)
    VALUES ('ordinary_brokerage_agreement','approved','synthetic-test-only','2031-01-01','synthetic-reviewer','synthetic-only',$1,true,'internal_business')
    RETURNING id::text`, [new Date("2031-01-01T00:00:00Z")])).rows[0];
  const consent = (await db.query(`INSERT INTO public.signature_consent_versions
    (version_identifier,locale,consent_text,consent_text_sha256,status,effective_from,approval_reference,created_by_admin_id,legacy_imported,approval_mode)
    VALUES ('phase2d-synthetic-v1','es-PR',$1,$2,'approved',$3,'synthetic-test-only',$4::uuid,true,'internal_business') RETURNING id::text`,
    [syntheticConsentText, syntheticConsentSha, new Date("2031-01-01T00:00:00Z"), adminId])).rows[0];
  await db.query(`UPDATE public.signature_documents SET document_type_approval_reference='synthetic-test-only',
    document_type_approval_id=$2::uuid, consent_version_id=$3::uuid,
    privacy_disclosure_version=$5, privacy_disclosure_es_pr_sha256=$6,
    privacy_disclosure_en_us_sha256=$7, privacy_disclosure_effective_from=$8::timestamptz,
    privacy_disclosure_approval_reference=$9, privacy_disclosure_es_pr_text=$10,
    privacy_disclosure_en_us_text=$11, status='sent', sent_at=$4
    WHERE id=$1::uuid`, [documentId, approval.id, consent.id, clockState.now,
    "phase2d-synthetic-privacy-v1", syntheticPrivacyEsPrSha, syntheticPrivacyEnUsSha,
    new Date("2031-01-01T00:00:00Z"), "synthetic-test-only", syntheticPrivacyEsPrText, syntheticPrivacyEnUsText]);
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

test("signer origin and cookie scope support API mutations without weakening production origin checks", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalIsolated = process.env.SIGNING_ISOLATED_ENVIRONMENT;
  try {
    process.env.NODE_ENV = "production";
    process.env.SIGNING_ISOLATED_ENVIRONMENT = "true";
    assert.equal(SIGNER_COOKIE_PATH, "/");
    assert.equal(sameSignerOrigin(new Request("https://borikipr.com/api/signatures/session/field", {
      headers: { origin: "https://borikipr.com" },
    })), true);
    assert.equal(sameSignerOrigin(new Request("https://borikipr.com/api/signatures/session/field")), false);
    assert.equal(sameSignerOrigin(new Request("https://borikipr.com/api/signatures/session/field", {
      headers: { origin: "https://attacker.invalid" },
    })), false);

    process.env.NODE_ENV = "development";
    assert.equal(isIsolatedLocalSignerRequest(new Request("http://127.0.0.1:3100/api/signatures/session/field")), true);
    assert.equal(sameSignerOrigin(new Request("http://127.0.0.1:3100/api/signatures/session/field")), true);
    assert.equal(sameSignerOrigin(new Request("http://127.0.0.1:3100/api/signatures/session/field", {
      headers: { origin: "http://localhost:3100" },
    })), true);
    assert.equal(sameSignerOrigin(new Request("http://127.0.0.1:3100/api/signatures/session/field", {
      headers: { origin: "https://attacker.invalid" },
    })), false);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalIsolated === undefined) delete process.env.SIGNING_ISOLATED_ENVIRONMENT;
    else process.env.SIGNING_ISOLATED_ENVIRONMENT = originalIsolated;
  }
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

test("reissue preserves viewed/consented state and progress while terminal states remain ineligible", async () => {
  const { fixture, session } = await sessionFixture();
  const participantCountBefore = (await db.query(`SELECT count(*)::integer AS count FROM public.signature_participants
    WHERE document_version_id=$1::uuid`, [fixture.documentVersionId])).rows[0].count;
  const viewedReissue = await services.issueSigningToken({ participantId: fixture.participants[0].participantId,
    documentVersionId: fixture.documentVersionId, expiresAt: new Date("2031-01-05T13:00:00Z"), keyVersion: 1,
    actorAdminId: adminId, idempotencyKey: randomUUID() });
  assert.equal((await services.inspectSigningToken(viewedReissue.plaintextToken)).eligible, true);
  const viewedSession = await services.redeemSigningToken({ plaintextToken: viewedReissue.plaintextToken,
    idempotencyKey: randomUUID() });
  await services.acceptSignerConsent({ sessionId: session.sessionId, sessionSecret: session.sessionSecret,
    csrfNonce: session.csrfNonce, consentVersion: "phase2d-synthetic-v1", consentTextSha256: syntheticConsentSha,
    locale: "es-PR", idempotencyKey: randomUUID() });
  const consentedBefore = (await db.query(`SELECT consented_at FROM public.signature_participants WHERE id=$1::uuid`,
    [fixture.participants[0].participantId])).rows[0].consented_at;
  await services.submitSignerField({ sessionId: session.sessionId, sessionSecret: session.sessionSecret,
    csrfNonce: session.csrfNonce, fieldId: fixture.fields[0].fieldId,
    value: { method: "drawn", strokes: [[{ x: 0.1, y: 0.2 }, { x: 0.7, y: 0.6 }]] },
    idempotencyKey: randomUUID() });
  const consentedReissue = await services.issueSigningToken({ participantId: fixture.participants[0].participantId,
    documentVersionId: fixture.documentVersionId, expiresAt: new Date("2031-01-05T13:00:00Z"), keyVersion: 1,
    actorAdminId: adminId, idempotencyKey: randomUUID(), supersedeExisting: true });
  assert.equal((await services.inspectSigningToken(consentedReissue.plaintextToken)).eligible, true);
  const resumed = await services.redeemSigningToken({ plaintextToken: consentedReissue.plaintextToken,
    idempotencyKey: randomUUID() });
  const resumedContext = await services.getSessionContext({ sessionId: resumed.sessionId,
    sessionSecret: resumed.sessionSecret });
  assert.equal(resumedContext.participantStatus, "consented");
  assert.equal((await db.query(`SELECT count(*)::integer AS count FROM public.signature_field_values
    WHERE participant_id=$1::uuid`, [fixture.participants[0].participantId])).rows[0].count, 1);
  assert.equal((await db.query(`SELECT consented_at FROM public.signature_participants WHERE id=$1::uuid`,
    [fixture.participants[0].participantId])).rows[0].consented_at.toISOString(), consentedBefore.toISOString());
  assert.equal((await db.query(`SELECT count(*)::integer AS count FROM public.signature_participants
    WHERE document_version_id=$1::uuid`, [fixture.documentVersionId])).rows[0].count, participantCountBefore);

  const superseded = await services.issueSigningToken({ participantId: fixture.participants[0].participantId,
    documentVersionId: fixture.documentVersionId, expiresAt: new Date("2031-01-05T13:00:00Z"), keyVersion: 1,
    actorAdminId: adminId, idempotencyKey: randomUUID() });
  const newest = await services.issueSigningToken({ participantId: fixture.participants[0].participantId,
    documentVersionId: fixture.documentVersionId, expiresAt: new Date("2031-01-05T13:00:00Z"), keyVersion: 1,
    actorAdminId: adminId, idempotencyKey: randomUUID(), supersedeExisting: true });
  assert.equal((await services.inspectSigningToken(superseded.plaintextToken)).eligible, false);
  assert.equal((await services.inspectSigningToken(newest.plaintextToken)).eligible, true);
  await services.transitionParticipantState({ participantId: fixture.participants[0].participantId,
    targetStatus: "revoked", actorClass: "admin", actorAdminId: adminId, idempotencyKey: randomUUID() });
  assert.equal((await services.inspectSigningToken(newest.plaintextToken)).eligible, false);
  await assert.rejects(services.redeemSigningToken({ plaintextToken: newest.plaintextToken,
    idempotencyKey: randomUUID() }), /signature_token_verification_failed/);
  assert.ok(viewedSession.sessionId);
});

test("an expired participant cannot redeem an otherwise current link", async () => {
  const expiredFixture = await syntheticRequest();
  const expiredToken = await services.issueSigningToken({ participantId: expiredFixture.participants[0].participantId,
    documentVersionId: expiredFixture.documentVersionId, expiresAt: new Date("2031-01-05T13:00:00Z"), keyVersion: 1,
    actorAdminId: adminId, idempotencyKey: randomUUID() });
  await services.transitionParticipantState({ participantId: expiredFixture.participants[0].participantId,
    targetStatus: "expired", actorClass: "system", idempotencyKey: randomUUID() });
  assert.equal((await services.inspectSigningToken(expiredToken.plaintextToken)).eligible, false);
});

test("a completed participant cannot resume with a previously issued current link", async () => {
  const { fixture, session } = await sessionFixture();
  await services.acceptSignerConsent({ sessionId: session.sessionId, sessionSecret: session.sessionSecret,
    csrfNonce: session.csrfNonce, consentVersion: "phase2d-synthetic-v1", consentTextSha256: syntheticConsentSha,
    locale: "es-PR", idempotencyKey: randomUUID() });
  const activeBeforeCompletion = await services.issueSigningToken({ participantId: fixture.participants[0].participantId,
    documentVersionId: fixture.documentVersionId, expiresAt: new Date("2031-01-05T13:00:00Z"), keyVersion: 1,
    actorAdminId: adminId, idempotencyKey: randomUUID() });
  const values = [{ method: "drawn", strokes: [[{ x: 0.1, y: 0.2 }, { x: 0.7, y: 0.6 }]] },
    { method: "typed", value: "Synthetic Signer" }, { method: "typed", value: "SS" },
    { method: "date", value: "2031-01-05" }, { method: "text", value: "Synthetic acceptance only" }];
  for (let index = 0; index < values.length; index += 1) await services.submitSignerField({
    sessionId: session.sessionId, sessionSecret: session.sessionSecret, csrfNonce: session.csrfNonce,
    fieldId: fixture.fields[index].fieldId, value: values[index], idempotencyKey: randomUUID() });
  await services.completeSignerParticipant({ sessionId: session.sessionId, sessionSecret: session.sessionSecret,
    csrfNonce: session.csrfNonce, idempotencyKey: randomUUID() });
  assert.equal((await services.inspectSigningToken(activeBeforeCompletion.plaintextToken)).eligible, false);
  await assert.rejects(services.redeemSigningToken({ plaintextToken: activeBeforeCompletion.plaintextToken,
    idempotencyKey: randomUUID() }), /signature_token_verification_failed/);
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
    csrfNonce: "wrong", consentVersion: "phase2d-synthetic-v1", consentTextSha256: syntheticConsentSha, locale: "es-PR",
    idempotencyKey: randomUUID() }), /signature_session_invalid/);
  await services.acceptSignerConsent({ sessionId: session.sessionId, sessionSecret: session.sessionSecret,
    csrfNonce: session.csrfNonce, consentVersion: "phase2d-synthetic-v1", consentTextSha256: syntheticConsentSha, locale: "es-PR",
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
    consentVersion: "phase2d-synthetic-v1", consentTextSha256: syntheticConsentSha, locale: "es-PR", idempotencyKey: randomUUID() });
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
  const state = (await db.query(`SELECT d.status, v.finalized_at, v.final_pdf_sha256, v.certificate_sha256,
    v.certificate_metadata
    FROM public.signature_documents d JOIN public.signature_document_versions v ON v.id=d.active_version_id WHERE d.id=$1`, [fixture.documentId])).rows[0];
  assert.equal(state.status, "completed"); assert.ok(state.finalized_at); assert.match(state.final_pdf_sha256, /^[0-9a-f]{64}$/); assert.match(state.certificate_sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(state.certificate_metadata.privacyDisclosure, {
    version: "phase2d-synthetic-privacy-v1", esPrSha256: syntheticPrivacyEsPrSha, enUsSha256: syntheticPrivacyEnUsSha,
    effectiveFrom: "2031-01-01T00:00:00.000Z", approvalReference: "synthetic-test-only",
    locales: {
      "es-PR": { text: syntheticPrivacyEsPrText, sha256: syntheticPrivacyEsPrSha },
      "en-US": { text: syntheticPrivacyEnUsText, sha256: syntheticPrivacyEnUsSha },
    },
  });
});

test("temporary final-output failure retries safely without duplicate finalization", async () => {
  const { fixture, session } = await sessionFixture();
  await services.acceptSignerConsent({ sessionId: session.sessionId, sessionSecret: session.sessionSecret,
    csrfNonce: session.csrfNonce, consentVersion: "phase2d-synthetic-v1", consentTextSha256: syntheticConsentSha,
    locale: "es-PR", idempotencyKey: randomUUID() });
  const values = [{ method: "typed", value: "Synthetic Signer" }, { method: "typed", value: "Synthetic Signer" },
    { method: "typed", value: "SS" }, { method: "date", value: "2031-01-05" },
    { method: "text", value: "Synthetic retry test" }];
  for (let index = 0; index < values.length; index += 1) await services.submitSignerField({
    sessionId: session.sessionId, sessionSecret: session.sessionSecret, csrfNonce: session.csrfNonce,
    fieldId: fixture.fields[index].fieldId, value: values[index], idempotencyKey: randomUUID() });
  await services.completeSignerParticipant({ sessionId: session.sessionId, sessionSecret: session.sessionSecret,
    csrfNonce: session.csrfNonce, idempotencyKey: randomUUID() });
  let failFinal = true; const objects = new Map([[fixture.sourceR2Key, new Uint8Array(sourceBytes)]]);
  const storage = { async getSource() { return new Uint8Array(sourceBytes); },
    async putFinal(input) { if (failFinal) { failFinal = false; throw new Error("synthetic_temporary_storage_failure"); }
      objects.set(input.key, input.bytes); return "created"; },
    async putCertificate(input) { objects.set(input.key, input.bytes); return "created"; } };
  const runtime = { database: pgliteDatabase(db), domain: services, storage };
  await assert.rejects(finalizeCompletedSignatureDocument(fixture.documentId, runtime), /synthetic_temporary_storage_failure/);
  const beforeRetry = (await db.query(`SELECT finalized_at FROM public.signature_document_versions WHERE id=$1`, [fixture.documentVersionId])).rows[0];
  assert.equal(beforeRetry.finalized_at, null);
  const recovered = await finalizeCompletedSignatureDocument(fixture.documentId, runtime);
  assert.equal(recovered.existing, false); assert.equal(objects.size, 3);
  assert.equal((await services.verifyEventChain(fixture.documentId)).valid, true);
  const finalizedEvents = (await db.query(`SELECT count(*)::integer AS count FROM public.signature_events
    WHERE document_id=$1 AND event_type='finalization_completed'`, [fixture.documentId])).rows[0].count;
  assert.equal(finalizedEvents, 1);
});

test("event, source, and field substitution are rejected", async () => {
  const fixture = await syntheticRequest();
  await assert.rejects(db.query(`UPDATE public.signature_events SET controlled_metadata='{}' WHERE document_id=$1`, [fixture.documentId]), /append-only/);
  await assert.rejects(db.query(`UPDATE public.signature_document_versions SET source_sha256=$2 WHERE id=$1`, [fixture.documentVersionId, "f".repeat(64)]), /immutable/);
  await assert.rejects(db.query(`UPDATE public.signature_fields SET normalized_x=.2 WHERE id=$1`, [fixture.fields[0].fieldId]), /immutable/);
  await assert.rejects(db.query(`UPDATE public.signature_documents SET privacy_disclosure_es_pr_text=$2 WHERE id=$1`,
    [fixture.documentId, `${syntheticPrivacyEsPrText} replacement`]), /governance evidence is immutable/);
});

test("0023 stores no plaintext token, consent copy, or PDF body", async () => {
  const columns = (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name IN ('signature_participants','signature_field_values')
    AND column_name IN ('consent_text','plaintext_token','pdf_content','sanitized_value_payload') ORDER BY column_name`)).rows.map((row) => row.column_name);
  assert.deepEqual(columns, ["sanitized_value_payload"]);
});

test("signer routes enforce the server gate, same-origin POSTs, private headers, and no email/public storage", async () => {
  const [landing, sessionPage, documentViewer, exchange, consent, field, complete, config, storage] = await Promise.all([
    readFile(path.join(root, "app/firmar/[token]/page.tsx"), "utf8"),
    readFile(path.join(root, "app/firmar/sesion/page.tsx"), "utf8"),
    readFile(path.join(root, "app/firmar/sesion/SignerDocumentViewer.tsx"), "utf8"),
    readFile(path.join(root, "app/api/signatures/session/exchange/route.ts"), "utf8"),
    readFile(path.join(root, "app/api/signatures/session/consent/route.ts"), "utf8"),
    readFile(path.join(root, "app/api/signatures/session/field/route.ts"), "utf8"),
    readFile(path.join(root, "app/api/signatures/session/complete/route.ts"), "utf8"),
    readFile(path.join(root, "next.config.ts"), "utf8"),
    readFile(path.join(root, "lib/signatures/storage.ts"), "utf8"),
  ]);
  for (const route of [landing, exchange, consent, field, complete]) assert.match(route, /isSignerRuntimeEnabled/);
  for (const route of [exchange, consent, field, complete]) assert.match(route, /sameSignerOrigin/);
  assert.match(exchange, /checkRateLimit/); assert.match(exchange, /httpOnly: true/); assert.match(exchange, /sameSite: "strict"/);
  assert.match(exchange, /secure: !isolatedLocalDevelopment/); assert.match(exchange, /encodeSignerCookie\(session\.sessionId, session\.sessionSecret\)/);
  assert.doesNotMatch(exchange, /cookies\.set\([^\n]*token/i); assert.doesNotMatch(exchange, /export async function GET/);
  assert.match(config, /source: "\/firmar\/:path\*"/); assert.match(config, /Referrer-Policy/); assert.match(config, /noindex, nofollow/);
  assert.doesNotMatch(landing + exchange + consent + field + complete, /Resend|sendEmail/);
  assert.doesNotMatch(storage, /publicUrl|presign|R2_PUBLIC_BASE_URL/);
  assert.match(sessionPage, /privacy_disclosure_es_pr_text/);
  assert.doesNotMatch(sessionPage, /inspectSignaturePrivacyDisclosure/);
  assert.match(sessionPage, /SignerDocumentViewer pageCount=\{view\.page_count\}/);
  assert.match(documentViewer, /src=\{`\/firmar\/sesion\/pages\/\$\{pageIndex\}`\}/);
  assert.equal(documentViewer.match(/<Image/g)?.length, 1);
  assert.match(documentViewer, /max-h-\[75vh\]/);
  assert.match(documentViewer, /overscroll-contain/);
});
