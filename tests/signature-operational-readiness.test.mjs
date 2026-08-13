import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { createSignatureDomainServices } from "../lib/signatures/domain/service.ts";
import { getSignatureGovernanceReadiness } from "../lib/signatures/governance-readiness.ts";
import { inspectSignatureEventKeyCoverage } from "../lib/signatures/key-rotation.ts";
import { getSignatureOperationalSnapshot } from "../lib/signatures/monitoring.ts";
import { evaluateSignatureRetention, parseSignatureRetentionPolicy } from "../lib/signatures/retention-policy.ts";
import { parseSignaturePrivacyDisclosure } from "../lib/signatures/privacy-disclosure.ts";
import { createSignatureGovernanceConfigurationService } from "../lib/signatures/governance-config.ts";
import { isInternalCanarySigningEnabled, isSignerRuntimeEnabled } from "../lib/signatures/public-config.ts";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const deliverySource = await readFile(path.join(root, "lib/signatures/delivery.ts"), "utf8");
const migrations = await Promise.all([
  "0022_create_signature_foundation.sql",
  "0023_extend_signature_signer_evidence.sql",
  "0024_add_signature_delivery_governance.sql",
  "0025_bind_signature_privacy_disclosure.sql",
  "0026_preserve_signature_privacy_disclosure_text.sql",
  "0027_add_signature_launch_governance.sql",
  "0028_harden_signature_launch_governance.sql",
  "0029_add_signature_governance_workflows.sql",
  "0030_harden_signature_governance_workflow_immutability.sql",
  "0031_add_signature_legal_holds.sql",
  "0032_correct_signature_business_governance.sql",
  "0033_harden_signature_preflight_authorization.sql",
].map((name) => readFile(path.join(root, "db/migrations", name), "utf8")));
const db = new PGlite();
const executor = (source) => ({ async unsafe(query, parameters = []) { return (await source.query(query, parameters)).rows; } });
const database = { ...executor(db), begin: (callback) => db.transaction((tx) => callback(executor(tx))) };
let adminId;

before(async () => {
  await db.exec(`CREATE TABLE public.admin_users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text UNIQUE NOT NULL);
    CREATE TABLE public.leads (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE TABLE public.lead_groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    INSERT INTO public.admin_users(username) VALUES ('synthetic-readiness-admin');`);
  adminId = (await db.query(`SELECT id::text FROM public.admin_users LIMIT 1`)).rows[0].id;
  for (const migration of migrations) await db.exec(migration);
});
beforeEach(async () => db.exec(`TRUNCATE public.signature_governance_events, public.signature_launch_authorizations,
  public.signature_retention_policy_versions, public.signature_privacy_disclosure_versions,
  public.signature_events, public.signature_field_values,
  public.signature_sessions, public.signature_delivery_intents, public.signature_signing_tokens,
  public.signature_fields, public.signature_participants, public.signature_document_versions,
  public.signature_documents, public.signature_consent_versions,
  public.signature_document_type_approvals CASCADE`));
after(() => db.close());

function environment(overrides = {}) {
  const keyOne = Buffer.alloc(32, 1).toString("base64url");
  return {
    SIGNATURE_EVENT_HMAC_KEYS_JSON: JSON.stringify({ 1: keyOne }),
    SIGNATURE_EVENT_HMAC_CURRENT_VERSION: "1",
    SIGNATURE_NETWORK_EVIDENCE_HMAC_KEY: Buffer.alloc(32, 2).toString("base64url"),
    SIGNING_PUBLIC_ENABLED: "false",
    ...overrides,
  };
}

const policyJson = JSON.stringify({
  version: "synthetic-v1",
  approvalReference: "SYNTHETIC-POLICY",
  privacyReference: "SYNTHETIC-PRIVACY",
  sourcePdfDays: 3650,
  completedPdfDays: null,
  certificateDays: null,
  evidenceManifestDays: null,
  tokenDays: 30,
  sessionHours: 24,
  networkEvidenceDays: 90,
  failedCancelledDraftDays: 90,
  auditEventDays: null,
  completedCleanupEnabled: false,
});

const privacyJson = JSON.stringify({
  version: "synthetic-privacy-v1",
  approvalReference: "SYNTHETIC-PRIVACY-ONLY",
  effectiveFrom: "2032-04-01T00:00:00.000Z",
  locales: {
    "es-PR": "Divulgación sintética de privacidad para pruebas aisladas únicamente.",
    "en-US": "Synthetic privacy disclosure for isolated tests only and not for production.",
  },
});

test("retention configuration fails closed and preserves completed evidence", () => {
  assert.throws(() => parseSignatureRetentionPolicy(undefined), /signature_retention_policy_invalid/);
  assert.throws(() => parseSignatureRetentionPolicy(JSON.stringify({ version: "bad" })), /signature_retention_policy_invalid/);
  const policy = parseSignatureRetentionPolicy(policyJson);
  assert.deepEqual(evaluateSignatureRetention({ policy, recordType: "completed_pdf", createdAt: new Date(0), now: new Date("2035-01-01"), legalHold: false, completedRecord: true }), { eligible: false, reason: "preserved" });
  assert.deepEqual(evaluateSignatureRetention({ policy, recordType: "token", createdAt: new Date("2030-01-01"), now: new Date("2030-02-15"), legalHold: true, completedRecord: false }), { eligible: false, reason: "legal_hold" });
});

test("privacy disclosure requires both approved-language slots and hashes exact normalized text", () => {
  assert.throws(() => parseSignaturePrivacyDisclosure(undefined), /signature_privacy_disclosure_invalid/);
  assert.throws(() => parseSignaturePrivacyDisclosure(JSON.stringify({ version: "partial" })), /signature_privacy_disclosure_invalid/);
  const disclosure = parseSignaturePrivacyDisclosure(privacyJson);
  assert.equal(disclosure.locales["es-PR"].sha256.length, 64);
  assert.equal(disclosure.locales["en-US"].sha256.length, 64);
  assert.notEqual(disclosure.locales["es-PR"].sha256, disclosure.locales["en-US"].sha256);
  assert.equal(Object.isFrozen(disclosure.locales), true);
});

test("production signing mail requires an explicit Reply-To without logging it", () => {
  assert.match(deliverySource, /SIGNATURE_REPLY_TO_EMAIL/);
  assert.match(deliverySource, /replyTo, subject/);
  assert.doesNotMatch(deliverySource, /console\.(?:log|info|warn|error)/);
});

test("internal canary gate is isolated-only and never weakens production", () => {
  assert.equal(isInternalCanarySigningEnabled({ NODE_ENV: "production", SIGNING_ISOLATED_ENVIRONMENT: "true", SIGNING_INTERNAL_CANARY_ENABLED: "true" }), false);
  assert.equal(isInternalCanarySigningEnabled({ NODE_ENV: "development", SIGNING_ISOLATED_ENVIRONMENT: "false", SIGNING_INTERNAL_CANARY_ENABLED: "true" }), false);
  assert.equal(isSignerRuntimeEnabled({ NODE_ENV: "development", SIGNING_ISOLATED_ENVIRONMENT: "true", SIGNING_INTERNAL_CANARY_ENABLED: "true", SIGNING_PUBLIC_ENABLED: "false" }), true);
  assert.equal(isSignerRuntimeEnabled({ NODE_ENV: "production", SIGNING_INTERNAL_CANARY_ENABLED: "true", SIGNING_PUBLIC_ENABLED: "false" }), false);
});

test("governance versions are durable, audited, and require explicit launch confirmation", async () => {
  const service = createSignatureGovernanceConfigurationService(database, () => new Date("2032-05-01T00:00:00Z"));
  const privacyId = await service.createPrivacyDraft({ versionIdentifier: "synthetic-privacy-v2", esPRText: "Texto sintético de privacidad suficientemente largo.", enUSText: "Synthetic privacy wording sufficiently long for tests.", actorAdminId: adminId });
  await service.approvePrivacy({ id: privacyId, approvalReference: "TEST-ONLY", approverRole: "Operador autorizado", effectiveFrom: new Date("2032-05-01"), actorAdminId: adminId });
  await assert.rejects(db.query(`UPDATE public.signature_privacy_disclosure_versions SET es_pr_text='changed after approval' WHERE id=$1`, [privacyId]), /immutable/);
  const policy = parseSignatureRetentionPolicy(policyJson);
  const policyId = await service.createRetentionDraft({ versionIdentifier: "synthetic-retention-v2", privacyReference: "TEST-ONLY", policy, actorAdminId: adminId });
  await service.activateRetention({ id: policyId, approvalReference: "TEST-ONLY", approverRole: "Operador autorizado", actorAdminId: adminId });
  await assert.rejects(service.authorize({ environment: "isolated", authorizationType: "internal_canary", readinessSnapshotSha256: "a".repeat(64), expiresAt: new Date("2032-05-02"), actorAdminId: adminId, explicitConfirmation: false }), /confirmation_required/);
  await service.authorize({ environment: "isolated", authorizationType: "internal_canary", readinessSnapshotSha256: "a".repeat(64), expiresAt: new Date("2032-05-02"), actorAdminId: adminId, explicitConfirmation: true });
  await assert.rejects(db.query(`UPDATE public.signature_launch_authorizations SET notes='rewritten'`), /immutable/);
  const counts = (await db.query(`SELECT (SELECT count(*)::int FROM signature_governance_events) events,(SELECT count(*)::int FROM signature_launch_authorizations) authorizations`)).rows[0];
  assert.deepEqual(counts, { events: 8, authorizations: 1 });
  await assert.rejects(db.query(`DELETE FROM signature_governance_events`), /immutable/);
});

test("governance readiness reports every fail-closed launch requirement", async () => {
  const blocked = await getSignatureGovernanceReadiness(database, environment(), new Date("2032-05-01"));
  assert.equal(blocked.launchReady, false);
  assert.deepEqual(new Set(blocked.blockers), new Set([
    "document_classification_approval_missing", "approved_consent_es_pr_missing",
    "approved_consent_en_us_missing", "retention_policy_missing",
    "approved_privacy_es_pr_missing", "approved_privacy_en_us_missing",
  ]));
  assert.equal(blocked.evidenceKeysConfigured, true);
});

test("approved synthetic governance records and full policy satisfy readiness only with explicit gate", async () => {
  await db.query(`INSERT INTO public.signature_document_type_approvals
      (document_type,status,approval_reference,approval_date,reviewed_by,source_reference,effective_from,legacy_imported,approval_mode)
    VALUES ('ordinary_brokerage_agreement','approved','SYNTHETIC-ONLY','2032-04-01','Synthetic operator','synthetic','2032-04-01',true,'internal_business')`);
  for (const locale of ["es-PR", "en-US"]) {
    await db.query(`INSERT INTO public.signature_consent_versions
      (version_identifier,locale,consent_text,consent_text_sha256,status,effective_from,approval_reference,created_by_admin_id,legacy_imported,approval_mode)
      VALUES ($1,$2,'Synthetic consent only',$3,'approved','2032-04-01','SYNTHETIC-ONLY',$4::uuid,true,'internal_business')`,
      [`synthetic-${locale.toLowerCase()}`, locale, "a".repeat(64), adminId]);
  }
  const ready = await getSignatureGovernanceReadiness(database, environment({
    SIGNING_PUBLIC_ENABLED: "true",
    SIGNATURE_RETENTION_POLICY_JSON: policyJson,
    SIGNATURE_PRIVACY_DISCLOSURE_JSON: privacyJson,
  }), new Date("2032-05-01"));
  assert.equal(ready.launchReady, true);
  assert.deepEqual(ready.blockers, []);
});

test("historical HMAC key removal is detected and monitoring remains aggregate-only", async () => {
  const versionOneKey = "synthetic-event-key-version-one-32bytes";
  const versionTwoKey = "synthetic-event-key-version-two-32bytes";
  const domain = createSignatureDomainServices({ database, eventHmacKey: versionOneKey, eventHmacKeyVersion: 1, networkEvidenceHmacKey: "synthetic-network-key-at-least-32bytes" });
  const draft = await domain.createDraftWithVersion({ documentId: randomUUID(), title: "Synthetic", documentType: "ordinary_brokerage_agreement", createdByAdminId: adminId,
    filename: "synthetic.pdf", byteCount: 100, pageCount: 1, sourceSha256: "a".repeat(64), pageGeometryManifest: [{ pageIndex: 0, mediaBox: { x: 0, y: 0, width: 612, height: 792 }, cropBox: { x: 0, y: 0, width: 612, height: 792 }, rotation: 0, userUnit: 1 }],
    documentCreatedIdempotencyKey: randomUUID(), versionCreatedIdempotencyKey: randomUUID() });
  const rotatedDomain = createSignatureDomainServices({ database, eventHmacKey: versionTwoKey,
    eventHmacKeyVersion: 2, networkEvidenceHmacKey: "synthetic-network-key-at-least-32bytes",
    resolveEventHmacKey: (version) => version === 1 ? versionOneKey : version === 2 ? versionTwoKey : null });
  await rotatedDomain.appendEvent({ documentId: draft.documentId,
    documentVersionId: draft.documentVersionId, eventType: "document_viewed",
    actorClass: "system", versionHash: "a".repeat(64), idempotencyKey: randomUUID() });
  assert.equal((await rotatedDomain.verifyEventChain(draft.documentId)).valid, true);
  const safeCoverage = await inspectSignatureEventKeyCoverage(database, [1, 2], 2);
  assert.equal(safeCoverage.safe, true);
  assert.deepEqual(safeCoverage.usedKeyVersions, [1, 2]);
  const missing = await inspectSignatureEventKeyCoverage(database, [2], 2);
  assert.equal(missing.safe, false);
  assert.deepEqual(missing.missingKeyVersions, [1]);
  const snapshot = await getSignatureOperationalSnapshot(database);
  assert.equal(snapshot.drafts, 1);
  assert.equal(Object.values(snapshot).every(Number.isFinite), true);
  assert.doesNotMatch(JSON.stringify(snapshot), /email|name|token|r2/i);
});

test("maximum MVP topology supports 8 participants, 100 fields, 25 pages, and repeated status reads", async () => {
  const started = performance.now();
  const geometry = Array.from({ length: 25 }, (_, pageIndex) => ({
    pageIndex,
    mediaBox: { x: 0, y: 0, width: 612, height: 792 },
    cropBox: { x: 0, y: 0, width: 612, height: 792 },
    rotation: pageIndex % 4 * 90,
    userUnit: 1,
  }));
  const domain = createSignatureDomainServices({ database,
    eventHmacKey: "synthetic-load-event-key-at-least-32bytes",
    eventHmacKeyVersion: 1,
    networkEvidenceHmacKey: "synthetic-load-network-key-at-least-32bytes" });
  const draft = await domain.createDraftWithVersion({ documentId: randomUUID(),
    title: "Synthetic maximum topology", documentType: "ordinary_brokerage_agreement",
    createdByAdminId: adminId, filename: "synthetic-25-pages.pdf", byteCount: 2_999_999,
    pageCount: 25, sourceSha256: "b".repeat(64), pageGeometryManifest: geometry,
    documentCreatedIdempotencyKey: randomUUID(), versionCreatedIdempotencyKey: randomUUID() });
  const participants = [];
  for (let index = 0; index < 8; index += 1) {
    participants.push(await domain.addParticipant({ documentVersionId: draft.documentVersionId,
      nameSnapshot: `Synthetic Participant ${index + 1}`,
      emailSnapshot: `synthetic-${index + 1}@example.test`, role: "signer",
      routingOrder: index + 1, actorAdminId: adminId, idempotencyKey: randomUUID() }));
  }
  for (let index = 0; index < 100; index += 1) {
    const participant = participants[index % participants.length];
    const pageIndex = index % geometry.length;
    await domain.addField({ documentVersionId: draft.documentVersionId,
      participantId: participant.participantId, fieldType: index % 4 === 0 ? "signature" : "text",
      pageIndex, rect: { x: 0.05 + (index % 4) * 0.2, y: 0.1 + (index % 5) * 0.14,
        width: 0.15, height: 0.08 }, pageGeometryReference: geometry[pageIndex],
      label: `Synthetic field ${index + 1}`, required: true, tabOrder: index + 1,
      validationLimits: { maxLength: index % 4 === 0 ? 120 : 500 },
      actorAdminId: adminId, idempotencyKey: randomUUID() });
  }
  const counts = (await db.query(`SELECT
      (SELECT count(*)::int FROM signature_participants WHERE document_version_id=$1) AS participants,
      (SELECT count(*)::int FROM signature_fields WHERE document_version_id=$1) AS fields`,
    [draft.documentVersionId])).rows[0];
  assert.deepEqual(counts, { participants: 8, fields: 100 });
  const snapshots = await Promise.all(Array.from({ length: 10 }, () => getSignatureOperationalSnapshot(database)));
  assert.equal(snapshots.every((snapshot) => snapshot.drafts === 1), true);
  // Windows/PGlite cold starts can exceed the Linux CI timing without changing
  // the topology or query behavior. Keep a generous regression ceiling here;
  // the dedicated maximum-PDF drill records the meaningful performance data.
  assert.ok(performance.now() - started < 120_000);
});
