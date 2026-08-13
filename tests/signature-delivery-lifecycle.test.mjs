import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PDFDocument } from "pdf-lib";
import { createSignatureDomainServices } from "../lib/signatures/domain/service.ts";
import { createSignatureDeliveryService } from "../lib/signatures/delivery.ts";
import { evaluateSignatureSendReadiness } from "../lib/signatures/send-readiness.ts";
import { sha256SignatureValue } from "../lib/signatures/domain/crypto.ts";
import { finalizeCompletedSignatureDocument } from "../lib/signatures/signer/finalize.ts";
import { getCompletedArtifactDescriptor } from "../lib/signatures/completed-access.ts";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const [foundationSql, signerSql, deliverySql, privacyBindingSql, privacyHistorySql, sourceBytes] = await Promise.all([
  readFile(path.join(root, "db/migrations/0022_create_signature_foundation.sql"), "utf8"),
  readFile(path.join(root, "db/migrations/0023_extend_signature_signer_evidence.sql"), "utf8"),
  readFile(path.join(root, "db/migrations/0024_add_signature_delivery_governance.sql"), "utf8"),
  readFile(path.join(root, "db/migrations/0025_bind_signature_privacy_disclosure.sql"), "utf8"),
  readFile(path.join(root, "db/migrations/0026_preserve_signature_privacy_disclosure_text.sql"), "utf8"),
  readFile(path.join(root, "tests/fixtures/signatures/rejections/valid-ordinary.pdf")),
]);
const phase2GovernanceMigrations = await Promise.all(["0027_add_signature_launch_governance.sql","0028_harden_signature_launch_governance.sql","0029_add_signature_governance_workflows.sql","0030_harden_signature_governance_workflow_immutability.sql","0031_add_signature_legal_holds.sql","0032_correct_signature_business_governance.sql","0033_harden_signature_preflight_authorization.sql"].map((name)=>readFile(path.join(root,"db/migrations",name),"utf8")));
function adapter(db) { const executor = (source) => ({ async unsafe(query, parameters = []) { return (await source.query(query, parameters)).rows; } }); return { ...executor(db), begin: (callback) => db.transaction((tx) => callback(executor(tx))) }; }
const db = new PGlite();
const esPRText = "Aviso sintético de privacidad para pruebas aisladas solamente.";
const enUSText = "Synthetic privacy notice for isolated technical testing only.";
const syntheticPrivacyDisclosure = { version: "synthetic-privacy-v1", approvalReference: "SYNTHETIC-ONLY", effectiveFrom: "2031-01-01T00:00:00.000Z", esPRText, enUSText, esPRSha256: sha256SignatureValue(esPRText), enUSSha256: sha256SignatureValue(enUSText) };
const now = new Date("2032-05-01T12:00:00.000Z");
const geometry = { pageIndex: 0, mediaBox: { x: 0, y: 0, width: 612, height: 792 }, cropBox: { x: 0, y: 0, width: 612, height: 792 }, rotation: 0, userUnit: 1 };
let adminId, database, domain, delivery, sentMessages;

before(async () => {
  await db.exec(`CREATE TABLE public.admin_users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text NOT NULL UNIQUE);
    CREATE TABLE public.leads (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE TABLE public.lead_groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    INSERT INTO public.admin_users(username) VALUES ('synthetic-phase2e-admin');`);
  adminId = (await db.query(`SELECT id::text FROM public.admin_users LIMIT 1`)).rows[0].id;
  await db.exec(foundationSql); await db.exec(signerSql); await db.exec(deliverySql); await db.exec(privacyBindingSql); await db.exec(privacyHistorySql);
  for (const migration of phase2GovernanceMigrations) await db.exec(migration);
});
beforeEach(async () => {
  await db.exec(`TRUNCATE public.signature_events, public.signature_field_values, public.signature_sessions,
    public.signature_delivery_intents, public.signature_signing_tokens, public.signature_fields,
    public.signature_participants, public.signature_document_versions, public.signature_documents,
    public.signature_consent_versions, public.signature_document_type_approvals CASCADE`);
  database = adapter(db);
  domain = createSignatureDomainServices({ database, eventHmacKey: "phase2e-event-key-at-least-thirty-two-bytes",
    eventHmacKeyVersion: 1, networkEvidenceHmacKey: "phase2e-network-key-at-least-thirty-two-bytes", clock: () => new Date(now) });
  sentMessages = [];
  delivery = createSignatureDeliveryService({ database, domain,
    mail: { async send(message) { sentMessages.push(structuredClone(message)); return { reference: `synthetic-${sentMessages.length}` }; } },
    publicBaseUrl: "https://synthetic.example.test", tokenKeyVersion: 1, now: () => new Date(now) });
});
after(() => db.close());

async function fixture({ approval = true, consent = true, pdfBytes = sourceBytes, geometries = [geometry] } = {}) {
  if (approval) await db.query(`INSERT INTO signature_document_type_approvals(document_type,status,approval_mode,approval_reference,approval_date,reviewed_by,source_reference,effective_from,legacy_imported) VALUES ('ordinary_brokerage_agreement','approved','internal_business','SYNTHETIC-ONLY','2032-04-30','Synthetic operator','synthetic-fixture','2032-05-01',true)`);
  if (consent) await db.query(`INSERT INTO signature_consent_versions(version_identifier,locale,consent_text,consent_text_sha256,status,effective_from,approval_reference,created_by_admin_id,legacy_imported,approval_mode) VALUES ('phase2e-synthetic-v1','es-PR','CONSENTIMIENTO SINTÉTICO NO APROBADO PARA PRODUCCIÓN. Prueba técnica aislada.',$1,'approved','2032-05-01','SYNTHETIC-ONLY',$2,true,'internal_business')`,[sha256SignatureValue("CONSENTIMIENTO SINTÉTICO NO APROBADO PARA PRODUCCIÓN. Prueba técnica aislada."),adminId]);
  const documentId = randomUUID();
  const draft = await domain.createDraftWithVersion({ documentId, title: "Synthetic Phase 2E request", documentType: "ordinary_brokerage_agreement", createdByAdminId: adminId, expiresAt: new Date("2032-05-03T12:00:00Z"), filename: "synthetic.pdf", byteCount: pdfBytes.byteLength, pageCount: geometries.length, sourceSha256: sha256SignatureValue(pdfBytes), pageGeometryManifest: geometries, documentCreatedIdempotencyKey: randomUUID(), versionCreatedIdempotencyKey: randomUUID() });
  const participant = await domain.addParticipant({ documentVersionId: draft.documentVersionId, nameSnapshot: "Synthetic Participant", emailSnapshot: "synthetic@example.test", role: "buyer", routingOrder: 1, actorAdminId: adminId, idempotencyKey: randomUUID() });
  const field = await domain.addField({ documentVersionId: draft.documentVersionId, participantId: participant.participantId, fieldType: "signature", pageIndex: 0, rect: { x: .1, y: .7, width: .35, height: .1 }, pageGeometryReference: geometry, label: "Firma sintética", required: true, tabOrder: 1, validationLimits: { maxLength: 120 }, actorAdminId: adminId, idempotencyKey: randomUUID() });
  return { ...draft, documentId, participantId: participant.participantId, fieldId: field.fieldId };
}
async function prepared(options) {
  const value = await fixture(options);
  const readiness = await evaluateSignatureSendReadiness({ database, documentId: value.documentId, locale: "es-PR", publicSigningEnabled: true, eventKeysConfigured: true, retentionPolicyConfigured: true, privacyDisclosureConfigured: true, now });
  if (readiness.eligible) await domain.prepareDocumentForSend({ documentId: value.documentId, actorAdminId: adminId, idempotencyKey: randomUUID(), locale: "es-PR", publicSigningEnabled: true, privacyDisclosure: syntheticPrivacyDisclosure });
  return { value, readiness };
}

test("classification and consent gates fail closed", async () => {
  const noApproval = await prepared({ approval: false }); assert.ok(noApproval.readiness.reasons.includes("document_classification_approval_missing"));
  await db.exec(`TRUNCATE public.signature_events, public.signature_fields, public.signature_participants, public.signature_document_versions, public.signature_documents, public.signature_consent_versions CASCADE`);
  const noConsent = await prepared({ consent: false }); assert.ok(noConsent.readiness.reasons.includes("approved_consent_missing"));
  const disabled = await evaluateSignatureSendReadiness({ database, documentId: noConsent.value.documentId, locale: "es-PR", publicSigningEnabled: false, eventKeysConfigured: true, retentionPolicyConfigured: true, privacyDisclosureConfigured: true, now });
  assert.ok(disabled.reasons.includes("public_signing_disabled"));
  const policyBlocked = await evaluateSignatureSendReadiness({ database, documentId: noConsent.value.documentId, locale: "es-PR", publicSigningEnabled: true, eventKeysConfigured: true, retentionPolicyConfigured: false, privacyDisclosureConfigured: false, now });
  assert.ok(policyBlocked.reasons.includes("retention_policy_missing"));
  assert.ok(policyBlocked.reasons.includes("privacy_disclosure_missing"));
});

test("token is created only at delivery and never persisted in intent/html", async () => {
  const { value, readiness } = await prepared(); assert.equal(readiness.eligible, true);
  const key = randomUUID();
  const first = await delivery.createIntent({ participantId: value.participantId, documentVersionId: value.documentVersionId, locale: "es-PR", actorAdminId: adminId, idempotencyKey: key });
  const duplicate = await delivery.createIntent({ participantId: value.participantId, documentVersionId: value.documentVersionId, locale: "es-PR", actorAdminId: adminId, idempotencyKey: key });
  assert.equal(first.intentId, duplicate.intentId); assert.equal(duplicate.created, false);
  assert.equal((await db.query(`SELECT token_id FROM public.signature_delivery_intents WHERE id=$1`, [first.intentId])).rows[0].token_id, null);
  assert.deepEqual(await delivery.deliverIntent(first.intentId), { status: "sent" });
  const token = sentMessages[0].html.match(/\/firmar\/([A-Za-z0-9_-]{43})/)[1];
  const stored = (await db.query(`SELECT to_jsonb(di)::text AS body, t.token_digest FROM public.signature_delivery_intents di JOIN public.signature_signing_tokens t ON t.id=di.token_id WHERE di.id=$1`, [first.intentId])).rows[0];
  assert.match(stored.token_digest, /^[0-9a-f]{64}$/); assert.doesNotMatch(stored.body, new RegExp(token)); assert.doesNotMatch(stored.body, /\/firmar\//);
});

test("resend supersedes the old link and is race-idempotent", async () => {
  const { value } = await prepared();
  const first = await delivery.createIntent({ participantId: value.participantId, documentVersionId: value.documentVersionId, locale: "es-PR", actorAdminId: adminId, idempotencyKey: randomUUID() });
  await delivery.deliverIntent(first.intentId); const old = sentMessages[0].html.match(/\/firmar\/([A-Za-z0-9_-]{43})/)[1]; const key = randomUUID();
  const attempts = await Promise.all([0, 1].map(() => delivery.reissueInvitation({ participantId: value.participantId, documentVersionId: value.documentVersionId, locale: "es-PR", actorAdminId: adminId, idempotencyKey: key })));
  assert.equal(attempts[0].intentId, attempts[1].intentId); assert.equal((await domain.inspectSigningToken(old)).eligible, false);
  assert.equal((await db.query(`SELECT count(*)::int AS count FROM public.signature_delivery_intents`)).rows[0].count, 2);
});

test("delivery failure revokes the transient link and requires explicit reissue", async () => {
  const { value } = await prepared();
  const failingDelivery = createSignatureDeliveryService({ database, domain,
    mail: { async send() { const error = new Error("synthetic-provider-failure"); error.status = 503; throw error; } },
    publicBaseUrl: "https://synthetic.example.test", tokenKeyVersion: 1, now: () => new Date(now) });
  const intent = await failingDelivery.createIntent({ participantId: value.participantId,
    documentVersionId: value.documentVersionId, locale: "es-PR", actorAdminId: adminId,
    idempotencyKey: randomUUID() });
  assert.deepEqual(await failingDelivery.deliverIntent(intent.intentId), { status: "failed", retryable: false });
  const state = (await db.query(`SELECT di.status, di.attempts, t.revoked_at IS NOT NULL AS revoked
    FROM public.signature_delivery_intents di JOIN public.signature_signing_tokens t ON t.id=di.token_id
    WHERE di.id=$1::uuid`, [intent.intentId])).rows[0];
  assert.deepEqual(state, { status: "failed", attempts: 1, revoked: true });
  assert.deepEqual(await failingDelivery.processPending(), { processed: 0, sent: 0, failed: 0 });
});

test("expiration atomically closes participants, sessions, links, and pending delivery", async () => {
  const { value } = await prepared();
  await delivery.createIntent({ participantId: value.participantId,
    documentVersionId: value.documentVersionId, locale: "es-PR", actorAdminId: adminId,
    idempotencyKey: randomUUID() });
  const expiringDomain = createSignatureDomainServices({ database,
    eventHmacKey: "phase2e-event-key-at-least-thirty-two-bytes", eventHmacKeyVersion: 1,
    networkEvidenceHmacKey: "phase2e-network-key-at-least-thirty-two-bytes",
    clock: () => new Date("2032-05-04T12:00:00.000Z") });
  assert.deepEqual(await expiringDomain.expireSignatureDocument({ documentId: value.documentId,
    idempotencyKey: randomUUID() }), { status: "expired", participantsExpired: 1 });
  const state = (await db.query(`SELECT d.status AS document_status, p.status AS participant_status,
    di.status AS delivery_status FROM public.signature_documents d
    JOIN public.signature_document_versions v ON v.document_id=d.id
    JOIN public.signature_participants p ON p.document_version_id=v.id
    JOIN public.signature_delivery_intents di ON di.participant_id=p.id WHERE d.id=$1::uuid`, [value.documentId])).rows[0];
  assert.deepEqual(state, { document_status: "expired", participant_status: "expired", delivery_status: "cancelled" });
});

test("void requires a reason and atomically revokes access without mutating completed records", async () => {
  const { value } = await prepared();
  const first = await delivery.createIntent({ participantId: value.participantId,
    documentVersionId: value.documentVersionId, locale: "es-PR", actorAdminId: adminId,
    idempotencyKey: randomUUID() });
  await delivery.deliverIntent(first.intentId);
  const token = sentMessages[0].html.match(/\/firmar\/([A-Za-z0-9_-]{43})/)[1];
  await domain.redeemSigningToken({ plaintextToken: token, idempotencyKey: randomUUID() });
  await delivery.reissueInvitation({ participantId: value.participantId,
    documentVersionId: value.documentVersionId, locale: "es-PR", actorAdminId: adminId,
    idempotencyKey: randomUUID() });
  await assert.rejects(domain.voidSignatureDocument({ documentId: value.documentId,
    actorAdminId: adminId, reason: "", idempotencyKey: randomUUID() }), /signature_void_reason_invalid/);
  assert.deepEqual(await domain.voidSignatureDocument({ documentId: value.documentId,
    actorAdminId: adminId, reason: "Synthetic operational drill", idempotencyKey: randomUUID() }),
    { status: "voided", participantsRevoked: 1 });
  const state = (await db.query(`SELECT d.status AS document_status, d.void_reason,
      p.status AS participant_status,
      count(DISTINCT s.id) FILTER (WHERE s.revoked_at IS NOT NULL)::int AS revoked_sessions,
      count(DISTINCT di.id) FILTER (WHERE di.status='cancelled')::int AS cancelled_deliveries
    FROM public.signature_documents d
    JOIN public.signature_document_versions v ON v.document_id=d.id
    JOIN public.signature_participants p ON p.document_version_id=v.id
    LEFT JOIN public.signature_sessions s ON s.participant_id=p.id
    LEFT JOIN public.signature_delivery_intents di ON di.participant_id=p.id
    WHERE d.id=$1::uuid GROUP BY d.status,d.void_reason,p.status`, [value.documentId])).rows[0];
  assert.deepEqual(state, { document_status: "voided", void_reason: "Synthetic operational drill",
    participant_status: "revoked", revoked_sessions: 1, cancelled_deliveries: 1 });
  assert.equal((await domain.verifyEventChain(value.documentId)).valid, true);
});

test("synthetic invitation signs, finalizes, and yields participant-bound private completion access", async () => {
  const { value } = await prepared();
  const intent = await delivery.createIntent({ participantId: value.participantId, documentVersionId: value.documentVersionId, locale: "es-PR", actorAdminId: adminId, idempotencyKey: randomUUID() });
  await delivery.deliverIntent(intent.intentId); const token = sentMessages[0].html.match(/\/firmar\/([A-Za-z0-9_-]{43})/)[1];
  const session = await domain.redeemSigningToken({ plaintextToken: token, idempotencyKey: randomUUID() });
  const context = await domain.getSessionContext({ sessionId: session.sessionId, sessionSecret: session.sessionSecret });
  await domain.acceptSignerConsent({ sessionId: session.sessionId, sessionSecret: session.sessionSecret, csrfNonce: session.csrfNonce, consentVersion: context.consentVersion, consentTextSha256: context.consentTextSha256, locale: context.consentLocale, idempotencyKey: randomUUID() });
  await domain.submitSignerField({ sessionId: session.sessionId, sessionSecret: session.sessionSecret, csrfNonce: session.csrfNonce, fieldId: value.fieldId, value: { method: "typed", value: "Synthetic Participant" }, idempotencyKey: randomUUID() });
  assert.equal((await domain.completeSignerParticipant({ sessionId: session.sessionId, sessionSecret: session.sessionSecret, csrfNonce: session.csrfNonce, idempotencyKey: randomUUID() })).allParticipantsCompleted, true);
  const objects = new Map([[value.sourceR2Key, new Uint8Array(sourceBytes)]]);
  const storage = { async putSource() { return "existing"; }, async deleteSourceIfExact() { return false; }, async getSource() { return new Uint8Array(sourceBytes); }, async putFinal(v) { objects.set(v.key, new Uint8Array(v.bytes)); return "created"; }, async putCertificate(v) { objects.set(v.key, new Uint8Array(v.bytes)); return "created"; }, async getFinal(v) { return objects.get(v.key); }, async getCertificate(v) { return objects.get(v.key); } };
  await finalizeCompletedSignatureDocument(value.documentId, { database, domain, storage });
  await assert.rejects(domain.voidSignatureDocument({ documentId: value.documentId,
    actorAdminId: adminId, reason: "Must remain immutable", idempotencyKey: randomUUID() }),
  /signature_document_not_voidable/);
  const completion = await delivery.createIntent({ participantId: value.participantId, documentVersionId: value.documentVersionId, locale: "es-PR", actorAdminId: adminId, idempotencyKey: randomUUID(), kind: "completed_document" });
  await delivery.deliverIntent(completion.intentId); const accessToken = sentMessages[1].html.match(/\/firmar\/completado\/([A-Za-z0-9_-]{43})/)[1];
  const access = await domain.redeemCompletionAccessToken({ plaintextToken: accessToken, idempotencyKey: randomUUID() });
  const accessContext = await domain.getSessionContext({ sessionId: access.sessionId, sessionSecret: access.sessionSecret, purpose: "completed_document_access" });
  const descriptor = await getCompletedArtifactDescriptor({ database, documentVersionId: accessContext.documentVersionId, participantId: accessContext.participantId, kind: "document" });
  assert.ok(descriptor); assert.equal((await storage.getFinal(descriptor)).byteLength, descriptor.byteCount);
  assert.equal((await domain.verifyEventChain(value.documentId)).valid, true); assert.equal(sentMessages.length, 2);
});

test("browser-equivalent 25-page 100-field multi-participant state finalizes after the last participant", async () => {
  const source = await PDFDocument.create();
  const geometries = Array.from({ length: 25 }, (_, pageIndex) => {
    source.addPage([612, 792]);
    return { ...geometry, pageIndex };
  });
  const maximumSourceBytes = new Uint8Array(await source.save({ useObjectStreams: false }));
  const value = await fixture({ pdfBytes: maximumSourceBytes, geometries });
  const participantIds = [value.participantId];
  for (const [name, role] of [["Synthetic Participant B", "seller"], ["Synthetic Participant C", "broker"]]) {
    participantIds.push((await domain.addParticipant({ documentVersionId: value.documentVersionId,
      nameSnapshot: name, emailSnapshot: `${role}@example.test`, role, routingOrder: null,
      actorAdminId: adminId, idempotencyKey: randomUUID() })).participantId);
  }
  const fields = [{ fieldId: value.fieldId, participantId: value.participantId, fieldType: "signature" }];
  const fieldTypes = ["text", "signature", "date", "initials"];
  for (let index = 1; index < 100; index += 1) {
    const participantId = participantIds[index % participantIds.length];
    const fieldType = fieldTypes[index % fieldTypes.length];
    const created = await domain.addField({ documentVersionId: value.documentVersionId, participantId,
      fieldType, pageIndex: index % 25, rect: { x: .35, y: .45, width: fieldType === "date" || fieldType === "initials" ? .18 : .3, height: .07 },
      pageGeometryReference: geometries[index % 25], label: `Synthetic ${fieldType} ${index}`, required: true,
      tabOrder: index + 1, validationLimits: { maxLength: 120 }, actorAdminId: adminId,
      idempotencyKey: randomUUID() });
    fields.push({ fieldId: created.fieldId, participantId, fieldType });
  }
  const readiness = await evaluateSignatureSendReadiness({ database, documentId: value.documentId,
    locale: "es-PR", publicSigningEnabled: true, eventKeysConfigured: true,
    retentionPolicyConfigured: true, privacyDisclosureConfigured: true, now });
  assert.equal(readiness.eligible, true);
  await domain.prepareDocumentForSend({ documentId: value.documentId, actorAdminId: adminId,
    idempotencyKey: randomUUID(), locale: "es-PR", publicSigningEnabled: true,
    privacyDisclosure: syntheticPrivacyDisclosure });
  for (const participantId of participantIds) {
    const intent = await delivery.createIntent({ participantId, documentVersionId: value.documentVersionId,
      locale: "es-PR", actorAdminId: adminId, idempotencyKey: randomUUID() });
    await delivery.deliverIntent(intent.intentId);
    const token = sentMessages.at(-1).html.match(/\/firmar\/([A-Za-z0-9_-]{43})/)[1];
    const session = await domain.redeemSigningToken({ plaintextToken: token, idempotencyKey: randomUUID() });
    const context = await domain.getSessionContext({ sessionId: session.sessionId, sessionSecret: session.sessionSecret });
    await domain.acceptSignerConsent({ sessionId: session.sessionId, sessionSecret: session.sessionSecret,
      csrfNonce: session.csrfNonce, consentVersion: context.consentVersion,
      consentTextSha256: context.consentTextSha256, locale: context.consentLocale,
      idempotencyKey: randomUUID() });
    for (const field of fields.filter((candidate) => candidate.participantId === participantId)) {
      const capture = field.fieldType === "date" ? { method: "date", value: "2032-05-01" }
        : field.fieldType === "text" ? { method: "text", value: "Synthetic browser-equivalent value" }
          : { method: "typed", value: field.fieldType === "initials" ? "SP" : "Synthetic Participant" };
      await domain.submitSignerField({ sessionId: session.sessionId, sessionSecret: session.sessionSecret,
        csrfNonce: session.csrfNonce, fieldId: field.fieldId, value: capture, idempotencyKey: randomUUID() });
    }
    const completed = await domain.completeSignerParticipant({ sessionId: session.sessionId,
      sessionSecret: session.sessionSecret, csrfNonce: session.csrfNonce, idempotencyKey: randomUUID() });
    assert.equal(completed.allParticipantsCompleted, participantId === participantIds.at(-1));
  }
  const objects = new Map([[value.sourceR2Key, maximumSourceBytes]]);
  const storage = { async getSource() { return maximumSourceBytes; },
    async putFinal(input) { objects.set(input.key, input.bytes); return "created"; },
    async putCertificate(input) { objects.set(input.key, input.bytes); return "created"; } };
  const result = await finalizeCompletedSignatureDocument(value.documentId, { database, domain, storage });
  assert.equal(result.existing, false);
  const state = (await db.query(`SELECT d.status, v.finalized_at,
      (SELECT count(*)::int FROM signature_field_values fv JOIN signature_fields f ON f.id=fv.signature_field_id WHERE f.document_version_id=v.id) field_values,
      (SELECT count(*)::int FROM signature_events e WHERE e.document_id=d.id AND e.event_type='finalization_completed') finalization_events
    FROM signature_documents d JOIN signature_document_versions v ON v.id=d.active_version_id WHERE d.id=$1`, [value.documentId])).rows[0];
  assert.equal(state.status, "completed"); assert.ok(state.finalized_at);
  assert.equal(state.field_values, 100); assert.equal(state.finalization_events, 1);
  assert.equal((await domain.verifyEventChain(value.documentId)).valid, true);
});

test("expiration and security boundaries are explicit", async () => {
  const files = await Promise.all(["lib/signatures/delivery.ts", "lib/signatures/delivery-template.ts", "app/api/cron/process-email-queue/route.ts", "app/admin/signatures/[id]/final/route.ts", "app/firmar/completado/archivos/[kind]/route.ts", "lib/signatures/admin-download.ts"].map((file) => readFile(path.join(root, file), "utf8")));
  assert.doesNotMatch(deliverySql, /plaintext_token|signing_url|email_html/);
  assert.doesNotMatch(files[0] + files[1] + files[3] + files[4], /console\.|publicUrl|presign/i);
  assert.match(files[2], /EMAIL QUEUE PROCESSOR ERROR/);
  assert.match(files[2], /isPublicSigningEnabled/); assert.match(files[3], /privatePdfResponse/); assert.match(files[4], /no-store/); assert.match(files[5], /private, no-store/);
  assert.doesNotMatch(files[0] + files[2], /setInterval|automaticReminder/);
  await assert.rejects(Promise.resolve().then(() => getCompletedArtifactDescriptor({ database, documentVersionId: randomUUID(), participantId: randomUUID(), kind: "document" })).then((value) => { assert.equal(value, null); throw new Error("expected-null"); }), /expected-null/);
});
