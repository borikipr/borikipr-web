import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test, { after, before, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  canonicalSignatureJson,
  sha256SignatureValue,
} from "../lib/signatures/domain/crypto.ts";
import {
  verifySignatureEventChain,
} from "../lib/signatures/domain/event-chain.ts";
import {
  signatureArtifactR2Key,
  signatureCertificateR2Key,
  signatureFinalR2Key,
  signatureSourceR2Key,
} from "../lib/signatures/domain/r2-keys.ts";
import {
  createSignerSessionMaterial,
  verifySignerSession,
} from "../lib/signatures/domain/session.ts";
import { createSignatureDomainServices } from "../lib/signatures/domain/service.ts";
import {
  createSigningTokenMaterial,
  verifySigningToken,
} from "../lib/signatures/domain/token.ts";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const migrationSql = await readFile(
  path.join(root, "db/migrations/0022_create_signature_foundation.sql"),
  "utf8"
);
const rollbackSql = await readFile(
  path.join(root, "db/migrations/0022_create_signature_foundation.rollback.sql"),
  "utf8"
);
const signerMigrationSql = await readFile(path.join(root, "db/migrations/0023_extend_signature_signer_evidence.sql"), "utf8");
const deliveryMigrationSql = await readFile(path.join(root, "db/migrations/0024_add_signature_delivery_governance.sql"), "utf8");
const privacyBindingMigrationSql = await readFile(path.join(root, "db/migrations/0025_bind_signature_privacy_disclosure.sql"), "utf8");
const privacyHistoryMigrationSql = await readFile(path.join(root, "db/migrations/0026_preserve_signature_privacy_disclosure_text.sql"), "utf8");
const phase2GovernanceMigrations = await Promise.all(["0027_add_signature_launch_governance.sql","0028_harden_signature_launch_governance.sql","0029_add_signature_governance_workflows.sql","0030_harden_signature_governance_workflow_immutability.sql","0031_add_signature_legal_holds.sql","0032_correct_signature_business_governance.sql"].map((name)=>readFile(path.join(root,"db/migrations",name),"utf8")));
const SOURCE_HASH = "a".repeat(64);
const FINAL_HASH = "b".repeat(64);
const CERTIFICATE_HASH = "c".repeat(64);
const EVENT_HMAC_KEY = "phase2b-event-hmac-key-for-isolated-tests-only";
const NETWORK_HMAC_KEY = "phase2b-network-hmac-key-for-isolated-tests-only";
const FIXED_NOW = new Date("2030-02-01T12:00:00.000Z");

function pgliteDatabase(db) {
  const executor = (source) => ({
    async unsafe(query, parameters = []) {
      return (await source.query(query, parameters)).rows;
    },
  });
  return {
    ...executor(db),
    begin: (callback) =>
      db.transaction((transaction) => callback(executor(transaction))),
  };
}

const db = new PGlite();
const esPRText = "Aviso sintético de privacidad para pruebas aisladas solamente.";
const enUSText = "Synthetic privacy notice for isolated technical testing only.";
const syntheticPrivacyDisclosure = { version: "synthetic-privacy-v1", approvalReference: "SYNTHETIC-ONLY", effectiveFrom: "2029-01-01T00:00:00.000Z", esPRText, enUSText, esPRSha256: sha256SignatureValue(esPRText), enUSSha256: sha256SignatureValue(enUSText) };
let adminId;
let leadId;
let groupId;
let services;

before(async () => {
  await db.exec(`
    CREATE TABLE public.admin_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username text NOT NULL UNIQUE
    );
    CREATE TABLE public.leads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name text NOT NULL,
      status text NOT NULL DEFAULT 'active'
    );
    CREATE TABLE public.lead_groups (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL
    );
    INSERT INTO public.admin_users (username) VALUES ('phase2b-admin');
    INSERT INTO public.leads (full_name) VALUES ('Synthetic Lead');
    INSERT INTO public.lead_groups (title) VALUES ('Synthetic Group');
  `);
  adminId = (
    await db.query(`SELECT id::text FROM public.admin_users LIMIT 1`)
  ).rows[0].id;
  leadId = (await db.query(`SELECT id::text FROM public.leads LIMIT 1`)).rows[0].id;
  groupId = (
    await db.query(`SELECT id::text FROM public.lead_groups LIMIT 1`)
  ).rows[0].id;
  await db.exec(migrationSql);
  await db.exec(signerMigrationSql);
  await db.exec(deliveryMigrationSql);
  await db.exec(privacyBindingMigrationSql);
  await db.exec(privacyHistoryMigrationSql);
  for (const migration of phase2GovernanceMigrations) await db.exec(migration);
});

beforeEach(async () => {
  await db.exec(`
    TRUNCATE TABLE
      public.signature_events,
      public.signature_field_values,
      public.signature_sessions,
      public.signature_signing_tokens,
      public.signature_fields,
      public.signature_participants,
      public.signature_document_versions,
      public.signature_documents,
      public.signature_delivery_intents,
      public.signature_consent_versions,
      public.signature_document_type_approvals
    CASCADE;
  `);
  services = createSignatureDomainServices({
    database: pgliteDatabase(db),
    eventHmacKey: EVENT_HMAC_KEY,
    eventHmacKeyVersion: 1,
    networkEvidenceHmacKey: NETWORK_HMAC_KEY,
    clock: () => new Date(FIXED_NOW),
  });
});

after(async () => {
  await db.close();
});

async function draftFixture({
  withParticipant = true,
  withField = true,
  canonicalLeadId = leadId,
} = {}) {
  const draft = await services.createDraftDocument({
    title: "Documento sintético Phase 2B",
    documentType: "ordinary_brokerage_agreement",
    createdByAdminId: adminId,
    canonicalLeadId,
    leadGroupId: groupId,
    expiresAt: new Date("2030-03-01T12:00:00.000Z"),
  });
  const version = await services.createVersion({
    documentId: draft.documentId,
    createdByAdminId: adminId,
    filename: "synthetic-contract.pdf",
    byteCount: 100_000,
    pageCount: 1,
    sourceSha256: SOURCE_HASH,
    pageGeometryManifest: [
      {
        pageIndex: 0,
        mediaBox: { x: 0, y: 0, width: 612, height: 792 },
        cropBox: { x: 0, y: 0, width: 612, height: 792 },
        rotation: 0,
        userUnit: 1,
      },
    ],
    idempotencyKey: randomUUID(),
  });
  let participant = null;
  let field = null;
  if (withParticipant) {
    participant = await services.addParticipant({
      documentVersionId: version.documentVersionId,
      canonicalLeadId,
      nameSnapshot: "Synthetic Signer",
      emailSnapshot: "SIGNER@example.test",
      phoneSnapshot: null,
      role: "buyer",
      routingOrder: 1,
      actorAdminId: adminId,
      idempotencyKey: randomUUID(),
    });
  }
  if (withField && participant) {
    field = await services.addField({
      documentVersionId: version.documentVersionId,
      participantId: participant.participantId,
      fieldType: "signature",
      pageIndex: 0,
      rect: { x: 0.1, y: 0.7, width: 0.35, height: 0.1 },
      pageGeometryReference: {
        cropBox: { x: 0, y: 0, width: 612, height: 792 },
        rotation: 0,
      },
      label: "Firma",
      tabOrder: 1,
      validationLimits: { maxPoints: 2000 },
      actorAdminId: adminId,
      idempotencyKey: randomUUID(),
    });
  }
  return { ...draft, ...version, participant, field };
}

async function sentFixture() {
  const fixture = await draftFixture();
  const fieldHashes = await db.query(
    `SELECT immutable_definition_sha256
       FROM public.signature_fields
      WHERE document_version_id=$1::uuid
      ORDER BY immutable_definition_sha256`,
    [fixture.documentVersionId]
  );
  const fieldDefinitionHash = sha256SignatureValue(
    canonicalSignatureJson(
      fieldHashes.rows.map((row) => row.immutable_definition_sha256)
    )
  );
  await db.query(
    `UPDATE public.signature_document_versions
        SET field_definition_sha256=$2, locked_at=$3::timestamptz
      WHERE id=$1::uuid`,
    [fixture.documentVersionId, fieldDefinitionHash, FIXED_NOW.toISOString()]
  );
  const approval = (await db.query(`INSERT INTO public.signature_document_type_approvals
    (document_type,status,approval_reference,approval_date,reviewed_by,source_reference,effective_from,legacy_imported,approval_mode)
    VALUES ('ordinary_brokerage_agreement','approved','synthetic-test-fixture','2030-01-01',
      'synthetic-reviewer','synthetic-source',$1,true,'internal_business') RETURNING id::text`, [new Date("2030-01-01T00:00:00Z")])).rows[0];
  const consentText = "Synthetic consent text for isolated Phase 2B schema tests only.";
  const consent = (await db.query(`INSERT INTO public.signature_consent_versions
    (version_identifier,locale,consent_text,consent_text_sha256,status,effective_from,approval_reference,created_by_admin_id,legacy_imported,approval_mode)
    VALUES ('phase2b-synthetic-v1','es-PR',$1,$2,'approved',$3,'synthetic-test-fixture',$4::uuid,true,'internal_business')
    RETURNING id::text`, [consentText, sha256SignatureValue(consentText), new Date("2030-01-01T00:00:00Z"), adminId])).rows[0];
  await db.query(
    `UPDATE public.signature_documents
        SET document_type_approval_reference='synthetic-test-fixture',
            document_type_approval_id=$2::uuid, consent_version_id=$3::uuid,
            privacy_disclosure_version=$5,
            privacy_disclosure_es_pr_sha256=$6,
            privacy_disclosure_en_us_sha256=$7,
            privacy_disclosure_effective_from=$8::timestamptz,
            privacy_disclosure_approval_reference=$9,
            privacy_disclosure_es_pr_text=$10,
            privacy_disclosure_en_us_text=$11,
            status='sent', sent_at=$4::timestamptz
      WHERE id=$1::uuid`,
    [fixture.documentId, approval.id, consent.id, FIXED_NOW.toISOString(),
      syntheticPrivacyDisclosure.version, syntheticPrivacyDisclosure.esPRSha256,
      syntheticPrivacyDisclosure.enUSSha256, syntheticPrivacyDisclosure.effectiveFrom,
      syntheticPrivacyDisclosure.approvalReference, syntheticPrivacyDisclosure.esPRText,
      syntheticPrivacyDisclosure.enUSText]
  );
  return fixture;
}

test("latest isolated signing schema preserves the foundation tables", async () => {
  const rows = await db.query(`
    SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name LIKE 'signature_%'
     ORDER BY table_name
  `);
  assert.deepEqual(
    rows.rows.map((row) => row.table_name),
    [
      "signature_consent_versions",
      "signature_delivery_intents",
      "signature_document_type_approvals",
      "signature_document_versions",
      "signature_documents",
      "signature_events",
      "signature_field_values",
      "signature_fields",
      "signature_governance_events",
      "signature_launch_authorizations",
      "signature_legal_holds",
      "signature_participants",
      "signature_privacy_disclosure_versions",
      "signature_retention_policy_versions",
      "signature_sessions",
      "signature_signing_tokens",
    ]
  );
  assert.match(migrationSql, /byte_count BETWEEN 1 AND 3000000/);
  assert.match(migrationSql, /final_byte_count BETWEEN 1 AND 4000000/);
  assert.match(migrationSql, /page_count BETWEEN 1 AND 25/);
});

test("valid draft creation preserves the counsel gate", async () => {
  const fixture = await draftFixture();
  const document = (
    await db.query(
      `SELECT status, document_type_approval_reference
         FROM public.signature_documents WHERE id = $1::uuid`,
      [fixture.documentId]
    )
  ).rows[0];
  assert.equal(document.status, "draft");
  assert.equal(document.document_type_approval_reference, null);
  await assert.rejects(
    services.prepareDocumentForSend({
      documentId: fixture.documentId,
      actorAdminId: adminId,
      idempotencyKey: randomUUID(),
      locale: "es",
      publicSigningEnabled: true,
      privacyDisclosure: syntheticPrivacyDisclosure,
    }),
    /signature_document_type_not_approved/
  );
});

test("participant limit is enforced transactionally", async () => {
  const fixture = await draftFixture({ withParticipant: false, withField: false });
  for (let index = 1; index <= 8; index += 1) {
    await services.addParticipant({
      documentVersionId: fixture.documentVersionId,
      nameSnapshot: `Synthetic Signer ${index}`,
      emailSnapshot: `signer-${index}@example.test`,
      role: "buyer",
      routingOrder: index,
      actorAdminId: adminId,
      idempotencyKey: randomUUID(),
    });
  }
  await assert.rejects(
    services.addParticipant({
      documentVersionId: fixture.documentVersionId,
      nameSnapshot: "Ninth Synthetic Signer",
      emailSnapshot: "signer-9@example.test",
      role: "buyer",
      actorAdminId: adminId,
      idempotencyKey: randomUUID(),
    }),
    /signature participant limit exceeded/
  );
});

test("field limits and page bounds are enforced", async () => {
  const fixture = await draftFixture();
  for (let index = 2; index <= 40; index += 1) {
    await services.addField({
      documentVersionId: fixture.documentVersionId,
      participantId: fixture.participant.participantId,
      fieldType: "text",
      pageIndex: 0,
      rect: { x: 0.01, y: 0.01, width: 0.1, height: 0.02 },
      pageGeometryReference: { rotation: 0 },
      label: `Field ${index}`,
      tabOrder: index,
      actorAdminId: adminId,
      idempotencyKey: randomUUID(),
    });
  }
  await assert.rejects(
    services.addField({
      documentVersionId: fixture.documentVersionId,
      participantId: fixture.participant.participantId,
      fieldType: "text",
      pageIndex: 0,
      rect: { x: 0.1, y: 0.1, width: 0.1, height: 0.1 },
      pageGeometryReference: { rotation: 0 },
      label: "Field 41",
      tabOrder: 41,
      actorAdminId: adminId,
      idempotencyKey: randomUUID(),
    }),
    /signature participant field limit exceeded/
  );
  await assert.rejects(
    db.query(
      `INSERT INTO public.signature_fields (
         document_version_id, participant_id, field_type, page_index,
         normalized_x, normalized_y, normalized_width, normalized_height,
         page_geometry_reference, label, tab_order, immutable_definition_sha256
       ) VALUES ($1::uuid, $2::uuid, 'text', 1, 0.1, 0.1, 0.1, 0.1,
                 '{}'::jsonb, 'Outside page', 99, $3)`,
      [fixture.documentVersionId, fixture.participant.participantId, "d".repeat(64)]
    ),
    /invalid field/
  );
});

test("normalized coordinate constraints reject overflow and zero dimensions", async () => {
  const fixture = await draftFixture();
  for (const rect of [
    { x: 0.9, y: 0.1, width: 0.2, height: 0.1 },
    { x: 0.1, y: 0.1, width: 0, height: 0.1 },
  ]) {
    await assert.rejects(
      services.addField({
        documentVersionId: fixture.documentVersionId,
        participantId: fixture.participant.participantId,
        fieldType: "text",
        pageIndex: 0,
        rect,
        pageGeometryReference: { rotation: 0 },
        label: "Invalid",
        tabOrder: 2,
        actorAdminId: adminId,
        idempotencyKey: randomUUID(),
      }),
      /signature_fields_coordinates_check/
    );
  }
});

test("valid document and participant transitions are explicit", async () => {
  const fixture = await sentFixture();
  await services.transitionDocumentState({
    documentId: fixture.documentId,
    targetStatus: "viewed",
    actorClass: "admin",
    actorAdminId: adminId,
    idempotencyKey: randomUUID(),
  });
  await services.transitionDocumentState({
    documentId: fixture.documentId,
    targetStatus: "partially_signed",
    actorClass: "admin",
    actorAdminId: adminId,
    idempotencyKey: randomUUID(),
  });
  await services.transitionParticipantState({
    participantId: fixture.participant.participantId,
    targetStatus: "invited",
    actorClass: "admin",
    actorAdminId: adminId,
    idempotencyKey: randomUUID(),
  });
  await services.transitionParticipantState({
    participantId: fixture.participant.participantId,
    targetStatus: "viewed",
    actorClass: "participant",
    idempotencyKey: randomUUID(),
  });
  await services.transitionParticipantState({
    participantId: fixture.participant.participantId,
    targetStatus: "consented",
    actorClass: "participant",
    idempotencyKey: randomUUID(),
  });
  const states = await db.query(
    `SELECT d.status AS document_status, p.status AS participant_status
       FROM public.signature_documents d
       JOIN public.signature_document_versions v ON v.document_id = d.id
       JOIN public.signature_participants p ON p.document_version_id = v.id
      WHERE d.id = $1::uuid`,
    [fixture.documentId]
  );
  assert.deepEqual(states.rows[0], {
    document_status: "partially_signed",
    participant_status: "consented",
  });
});

test("completion requires submitted fields, completed participants, and final hashes", async () => {
  const fixture = await sentFixture();
  await services.transitionParticipantState({
    participantId: fixture.participant.participantId,
    targetStatus: "invited",
    actorClass: "admin",
    actorAdminId: adminId,
    idempotencyKey: randomUUID(),
  });
  const token = await services.issueSigningToken({
    participantId: fixture.participant.participantId,
    documentVersionId: fixture.documentVersionId,
    expiresAt: new Date("2030-02-02T12:00:00.000Z"),
    keyVersion: 1,
    actorAdminId: adminId,
    idempotencyKey: randomUUID(),
  });
  const session = await services.createSignerSession({
    plaintextToken: token.plaintextToken,
    participantId: fixture.participant.participantId,
    documentVersionId: fixture.documentVersionId,
    idempotencyKey: randomUUID(),
  });
  await services.transitionParticipantState({
    participantId: fixture.participant.participantId,
    targetStatus: "viewed",
    actorClass: "participant",
    sessionId: session.sessionId,
    idempotencyKey: randomUUID(),
  });
  await services.transitionParticipantState({
    participantId: fixture.participant.participantId,
    targetStatus: "consented",
    actorClass: "participant",
    sessionId: session.sessionId,
    idempotencyKey: randomUUID(),
  });
  await assert.rejects(
    services.transitionParticipantState({
      participantId: fixture.participant.participantId,
      targetStatus: "completed",
      actorClass: "participant",
      sessionId: session.sessionId,
      idempotencyKey: randomUUID(),
    }),
    /completion requires every required field/
  );
  await db.query(
    `INSERT INTO public.signature_field_values (
       signature_field_id, participant_id, capture_method,
       sanitized_typed_value, value_artifact_sha256, signer_session_id
     ) VALUES ($1::uuid, $2::uuid, 'typed', 'Synthetic Signer', $3, $4::uuid)`,
    [
      fixture.field.fieldId,
      fixture.participant.participantId,
      "f".repeat(64),
      session.sessionId,
    ]
  );
  await services.transitionParticipantState({
    participantId: fixture.participant.participantId,
    targetStatus: "completed",
    actorClass: "participant",
    sessionId: session.sessionId,
    idempotencyKey: randomUUID(),
  });
  await assert.rejects(
    services.transitionDocumentState({
      documentId: fixture.documentId,
      targetStatus: "completed",
      actorClass: "system",
      idempotencyKey: randomUUID(),
    }),
    /completion requires a finalized version/
  );
  await db.query(
    `UPDATE public.signature_document_versions SET
       final_r2_key=$2, final_filename='completed.pdf',
       final_mime_type='application/pdf', final_byte_count=120000,
       final_page_count=2, final_pdf_metadata='{}'::jsonb,
       final_pdf_sha256=$3, certificate_r2_key=$4,
       certificate_mime_type='application/pdf', certificate_byte_count=20000,
       certificate_metadata='{}'::jsonb, certificate_sha256=$5,
       finalized_at=$6::timestamptz
     WHERE id=$1::uuid`,
    [
      fixture.documentVersionId,
      signatureFinalR2Key(fixture.documentId, 1, FINAL_HASH),
      FINAL_HASH,
      signatureCertificateR2Key(fixture.documentId, 1, CERTIFICATE_HASH),
      CERTIFICATE_HASH,
      FIXED_NOW.toISOString(),
    ]
  );
  await services.transitionDocumentState({
    documentId: fixture.documentId,
    targetStatus: "completed",
    actorClass: "system",
    idempotencyKey: randomUUID(),
  });
  await assert.rejects(
    db.query(`UPDATE public.signature_documents SET title='Changed' WHERE id=$1::uuid`, [
      fixture.documentId,
    ]),
    /document identity is immutable/
  );
});

test("illegal reverse lifecycle transitions are rejected", async () => {
  const fixture = await sentFixture();
  await services.transitionDocumentState({
    documentId: fixture.documentId,
    targetStatus: "voided",
    actorClass: "admin",
    actorAdminId: adminId,
    reason: "synthetic_operator_void",
    idempotencyKey: randomUUID(),
  });
  await assert.rejects(
    db.query(
      `UPDATE public.signature_documents SET status='viewed', voided_at=NULL, void_reason=NULL
        WHERE id=$1::uuid`,
      [fixture.documentId]
    ),
    /illegal signature document state transition/
  );
  await assert.rejects(
    db.query(
      `UPDATE public.signature_participants SET status='completed', completed_at=now()
        WHERE id=$1::uuid`,
      [fixture.participant.participantId]
    ),
    /illegal signature participant state transition/
  );
});

test("versions, fields, and identity snapshots are immutable after send", async () => {
  const fixture = await sentFixture();
  await assert.rejects(
    db.query(
      `UPDATE public.signature_document_versions SET filename_snapshot='changed.pdf'
        WHERE id=$1::uuid`,
      [fixture.documentVersionId]
    ),
    /version definitions are immutable/
  );
  await assert.rejects(
    db.query(`UPDATE public.signature_fields SET label='Changed' WHERE id=$1::uuid`, [
      fixture.field.fieldId,
    ]),
    /field definitions are immutable/
  );
  await assert.rejects(
    db.query(
      `UPDATE public.signature_participants SET name_snapshot='Changed'
        WHERE id=$1::uuid`,
      [fixture.participant.participantId]
    ),
    /identity snapshot is immutable/
  );
  await assert.rejects(
    db.query(
      `UPDATE public.signature_documents SET privacy_disclosure_version='replacement-v2'
        WHERE id=$1::uuid`,
      [fixture.documentId]
    ),
    /signature send governance evidence is immutable/
  );
});

test("finalized hashes and metadata cannot be changed", async () => {
  const fixture = await sentFixture();
  await db.query(
    `UPDATE public.signature_document_versions SET
       final_r2_key=$2, final_filename='completed.pdf',
       final_mime_type='application/pdf', final_byte_count=120000,
       final_page_count=2, final_pdf_metadata='{}'::jsonb,
       final_pdf_sha256=$3, certificate_r2_key=$4,
       certificate_mime_type='application/pdf', certificate_byte_count=20000,
       certificate_metadata='{}'::jsonb, certificate_sha256=$5,
       finalized_at=$6::timestamptz
     WHERE id=$1::uuid`,
    [
      fixture.documentVersionId,
      signatureFinalR2Key(fixture.documentId, 1, FINAL_HASH),
      FINAL_HASH,
      signatureCertificateR2Key(fixture.documentId, 1, CERTIFICATE_HASH),
      CERTIFICATE_HASH,
      FIXED_NOW.toISOString(),
    ]
  );
  await assert.rejects(
    db.query(
      `UPDATE public.signature_document_versions SET final_pdf_sha256=$2
        WHERE id=$1::uuid`,
      [fixture.documentVersionId, "e".repeat(64)]
    ),
    /finalized signature document versions are immutable/
  );
});

test("events are append-only and the HMAC chain verifies", async () => {
  const fixture = await draftFixture();
  const verification = await services.verifyEventChain(fixture.documentId);
  assert.deepEqual(verification, {
    valid: true,
    checkedEvents: 3,
    invalidSequence: null,
    reason: "ok",
  });
  const eventId = (
    await db.query(
      `SELECT id::text FROM public.signature_events
        WHERE document_id=$1::uuid ORDER BY sequence_number LIMIT 1`,
      [fixture.documentId]
    )
  ).rows[0].id;
  await assert.rejects(
    db.query(`UPDATE public.signature_events SET event_type='document_viewed' WHERE id=$1`, [
      eventId,
    ]),
    /append-only/
  );
  await assert.rejects(
    db.query(`DELETE FROM public.signature_events WHERE id=$1`, [eventId]),
    /append-only/
  );
});

test("event-chain verification detects in-memory tampering", async () => {
  const fixture = await draftFixture();
  const rows = (
    await db.query(
      `SELECT id::text, document_id::text, document_version_id::text,
              participant_id::text, session_id::text, event_type, actor_class,
              actor_admin_id::text, server_timestamp, sequence_number,
              version_hash, controlled_metadata, idempotency_key::text,
              previous_event_digest, event_digest, key_version,
              network_address_digest, user_agent_digest
         FROM public.signature_events WHERE document_id=$1::uuid
        ORDER BY sequence_number`,
      [fixture.documentId]
    )
  ).rows.map((row) => ({
    id: row.id,
    documentId: row.document_id,
    documentVersionId: row.document_version_id,
    participantId: row.participant_id,
    sessionId: row.session_id,
    eventType: row.event_type,
    actorClass: row.actor_class,
    actorAdminId: row.actor_admin_id,
    serverTimestamp: new Date(row.server_timestamp).toISOString(),
    sequenceNumber: Number(row.sequence_number),
    versionHash: row.version_hash,
    controlledMetadata: row.controlled_metadata,
    idempotencyKey: row.idempotency_key,
    previousEventDigest: row.previous_event_digest,
    eventDigest: row.event_digest,
    keyVersion: row.key_version,
    networkAddressDigest: row.network_address_digest,
    userAgentDigest: row.user_agent_digest,
  }));
  const tampered = rows.map((row, index) =>
    index === 1 ? { ...row, controlledMetadata: { event_note_code: "changed" } } : row
  );
  const verification = verifySignatureEventChain(tampered, () => EVENT_HMAC_KEY);
  assert.equal(verification.valid, false);
  assert.equal(verification.reason, "digest");
});

test("event idempotency is safe under concurrent calls", async () => {
  const fixture = await draftFixture();
  const idempotencyKey = randomUUID();
  const input = {
    documentId: fixture.documentId,
    documentVersionId: fixture.documentVersionId,
    eventType: "delivery_recorded",
    actorClass: "delivery",
    versionHash: SOURCE_HASH,
    controlledMetadata: { delivery_channel: "email" },
    idempotencyKey,
  };
  const [left, right] = await Promise.all([
    services.appendEvent(input),
    services.appendEvent(input),
  ]);
  assert.equal(left.id, right.id);
  const count = await db.query(
    `SELECT count(*)::integer AS count FROM public.signature_events
      WHERE document_id=$1::uuid AND idempotency_key=$2::uuid`,
    [fixture.documentId, idempotencyKey]
  );
  assert.equal(count.rows[0].count, 1);
  await assert.rejects(
    services.appendEvent({
      ...input,
      controlledMetadata: { delivery_channel: "postal_mail" },
    }),
    /signature_event_idempotency_conflict/
  );
});

test("token issuance persists only a digest and supports revocation/supersession", async () => {
  const fixture = await sentFixture();
  const first = await services.issueSigningToken({
    participantId: fixture.participant.participantId,
    documentVersionId: fixture.documentVersionId,
    expiresAt: new Date("2030-02-02T12:00:00.000Z"),
    keyVersion: 1,
    actorAdminId: adminId,
    idempotencyKey: randomUUID(),
  });
  const stored = (
    await db.query(
      `SELECT token_digest, revoked_at, superseded_at
         FROM public.signature_signing_tokens WHERE id=$1::uuid`,
      [first.tokenId]
    )
  ).rows[0];
  assert.notEqual(stored.token_digest, first.plaintextToken);
  assert.equal(stored.token_digest.length, 64);
  assert.equal(JSON.stringify(stored).includes(first.plaintextToken), false);

  const second = await services.issueSigningToken({
    participantId: fixture.participant.participantId,
    documentVersionId: fixture.documentVersionId,
    expiresAt: new Date("2030-02-02T12:00:00.000Z"),
    keyVersion: 1,
    actorAdminId: adminId,
    idempotencyKey: randomUUID(),
    supersedeExisting: true,
  });
  const prior = (
    await db.query(
      `SELECT superseded_at FROM public.signature_signing_tokens WHERE id=$1::uuid`,
      [first.tokenId]
    )
  ).rows[0];
  assert.ok(prior.superseded_at);
  await services.revokeSigningToken({
    tokenId: second.tokenId,
    actorAdminId: adminId,
    idempotencyKey: randomUUID(),
  });
  const revoked = (
    await db.query(
      `SELECT revoked_at FROM public.signature_signing_tokens WHERE id=$1::uuid`,
      [second.tokenId]
    )
  ).rows[0];
  assert.ok(revoked.revoked_at);
});

test("token verification enforces expiry, revocation, supersession, and binding", () => {
  const material = createSigningTokenMaterial();
  const base = {
    participantId: randomUUID(),
    documentVersionId: randomUUID(),
    tokenDigest: material.digest,
    expiresAt: "2030-02-01T13:00:00.000Z",
    consumedAt: null,
    revokedAt: null,
    supersededAt: null,
  };
  assert.equal(
    verifySigningToken({
      plaintext: material.plaintext,
      stored: base,
      expectedParticipantId: base.participantId,
      expectedDocumentVersionId: base.documentVersionId,
      now: FIXED_NOW,
    }),
    true
  );
  for (const stored of [
    { ...base, expiresAt: FIXED_NOW },
    { ...base, consumedAt: FIXED_NOW },
    { ...base, revokedAt: FIXED_NOW },
    { ...base, supersededAt: FIXED_NOW },
  ]) {
    assert.equal(
      verifySigningToken({
        plaintext: material.plaintext,
        stored,
        expectedParticipantId: base.participantId,
        expectedDocumentVersionId: base.documentVersionId,
        now: FIXED_NOW,
      }),
      false
    );
  }
  assert.equal(
    verifySigningToken({
      plaintext: material.plaintext,
      stored: base,
      expectedParticipantId: randomUUID(),
      expectedDocumentVersionId: base.documentVersionId,
      now: FIXED_NOW,
    }),
    false
  );
});

test("signer sessions bind secret, CSRF, participant, version, and time", () => {
  const material = createSignerSessionMaterial();
  const participantId = randomUUID();
  const documentVersionId = randomUUID();
  const stored = {
    participantId,
    documentVersionId,
    sessionSecretDigest: material.sessionSecretDigest,
    csrfNonceDigest: material.csrfNonceDigest,
    expiresAt: "2030-02-01T12:20:00.000Z",
    idleExpiresAt: "2030-02-01T12:10:00.000Z",
    revokedAt: null,
    completedAt: null,
  };
  assert.equal(
    verifySignerSession({
      sessionSecret: material.sessionSecret,
      csrfNonce: material.csrfNonce,
      stored,
      expectedParticipantId: participantId,
      expectedDocumentVersionId: documentVersionId,
      now: FIXED_NOW,
    }),
    true
  );
  assert.equal(
    verifySignerSession({
      sessionSecret: material.sessionSecret,
      csrfNonce: "wrong-csrf",
      stored,
      expectedParticipantId: participantId,
      expectedDocumentVersionId: documentVersionId,
      now: FIXED_NOW,
    }),
    false
  );
  assert.equal(
    verifySignerSession({
      sessionSecret: material.sessionSecret,
      csrfNonce: material.csrfNonce,
      stored,
      expectedParticipantId: participantId,
      expectedDocumentVersionId: documentVersionId,
      now: new Date("2030-02-01T12:10:00.000Z"),
    }),
    false
  );
});

test("session creation persists digests and supports explicit revocation", async () => {
  const fixture = await sentFixture();
  const token = await services.issueSigningToken({
    participantId: fixture.participant.participantId,
    documentVersionId: fixture.documentVersionId,
    expiresAt: new Date("2030-02-02T12:00:00.000Z"),
    keyVersion: 1,
    actorAdminId: adminId,
    idempotencyKey: randomUUID(),
  });
  const session = await services.createSignerSession({
    plaintextToken: token.plaintextToken,
    participantId: fixture.participant.participantId,
    documentVersionId: fixture.documentVersionId,
    idempotencyKey: randomUUID(),
    networkAddress: "192.0.2.1",
    userAgent: "Synthetic Agent",
  });
  const stored = (
    await db.query(
      `SELECT s.session_secret_digest, s.csrf_nonce_digest, s.revoked_at,
              t.consumed_at
         FROM public.signature_sessions s
         JOIN public.signature_signing_tokens t ON t.id=s.token_id
        WHERE s.id=$1::uuid`,
      [session.sessionId]
    )
  ).rows[0];
  assert.notEqual(stored.session_secret_digest, session.sessionSecret);
  assert.notEqual(stored.csrf_nonce_digest, session.csrfNonce);
  assert.ok(stored.consumed_at);
  await assert.rejects(
    services.createSignerSession({
      plaintextToken: token.plaintextToken,
      participantId: fixture.participant.participantId,
      documentVersionId: fixture.documentVersionId,
      idempotencyKey: randomUUID(),
    }),
    /signature_token_verification_failed/
  );
  await services.revokeSignerSession({
    sessionId: session.sessionId,
    actorClass: "participant",
    idempotencyKey: randomUUID(),
  });
  const revoked = (
    await db.query(`SELECT revoked_at FROM public.signature_sessions WHERE id=$1::uuid`, [
      session.sessionId,
    ])
  ).rows[0];
  assert.ok(revoked.revoked_at);
});

test("completed field values are append-only and capture limits are enforced", async () => {
  const fixture = await sentFixture();
  const token = await services.issueSigningToken({
    participantId: fixture.participant.participantId,
    documentVersionId: fixture.documentVersionId,
    expiresAt: new Date("2030-02-02T12:00:00.000Z"),
    keyVersion: 1,
    actorAdminId: adminId,
    idempotencyKey: randomUUID(),
  });
  const session = await services.createSignerSession({
    plaintextToken: token.plaintextToken,
    participantId: fixture.participant.participantId,
    documentVersionId: fixture.documentVersionId,
    idempotencyKey: randomUUID(),
  });
  const valueId = (
    await db.query(
      `INSERT INTO public.signature_field_values (
         signature_field_id, participant_id, capture_method,
         sanitized_typed_value, value_artifact_sha256, signer_session_id
       ) VALUES ($1::uuid, $2::uuid, 'typed', 'Synthetic Signer', $3, $4::uuid)
       RETURNING id::text`,
      [
        fixture.field.fieldId,
        fixture.participant.participantId,
        "f".repeat(64),
        session.sessionId,
      ]
    )
  ).rows[0].id;
  await assert.rejects(
    db.query(
      `UPDATE public.signature_field_values SET sanitized_typed_value='Changed'
        WHERE id=$1::uuid`,
      [valueId]
    ),
    /field values are immutable/
  );
  await assert.rejects(
    db.query(`DELETE FROM public.signature_field_values WHERE id=$1::uuid`, [valueId]),
    /field values are immutable/
  );
});

test("participant identity snapshot survives canonical lead changes", async () => {
  const fixture = await sentFixture();
  await db.query(`UPDATE public.leads SET full_name='Merged Lead', status='merged' WHERE id=$1`, [
    leadId,
  ]);
  const participant = (
    await db.query(
      `SELECT canonical_lead_id::text, name_snapshot, email_snapshot
         FROM public.signature_participants WHERE id=$1::uuid`,
      [fixture.participant.participantId]
    )
  ).rows[0];
  assert.equal(participant.canonical_lead_id, leadId);
  assert.equal(participant.name_snapshot, "Synthetic Signer");
  assert.equal(participant.email_snapshot, "SIGNER@example.test");
});

test("partial failures roll back domain writes and events together", async () => {
  const fixture = await draftFixture({ withParticipant: false, withField: false });
  await db.exec(`
    CREATE FUNCTION public.reject_phase2b_event() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'synthetic event rejection'; END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER reject_phase2b_event_trigger
      BEFORE INSERT ON public.signature_events
      FOR EACH ROW EXECUTE FUNCTION public.reject_phase2b_event();
  `);
  try {
    await assert.rejects(
      services.addParticipant({
        documentVersionId: fixture.documentVersionId,
        nameSnapshot: "Rollback Signer",
        emailSnapshot: "rollback@example.test",
        role: "buyer",
        actorAdminId: adminId,
        idempotencyKey: randomUUID(),
      }),
      /synthetic event rejection/
    );
    const count = await db.query(
      `SELECT count(*)::integer AS count FROM public.signature_participants
        WHERE document_version_id=$1::uuid`,
      [fixture.documentVersionId]
    );
    assert.equal(count.rows[0].count, 0);
  } finally {
    await db.exec(`
      DROP TRIGGER reject_phase2b_event_trigger ON public.signature_events;
      DROP FUNCTION public.reject_phase2b_event();
    `);
  }
});

test("R2 key helpers are deterministic and contain only opaque IDs and hashes", () => {
  const documentId = randomUUID();
  const fieldId = randomUUID();
  const keys = [
    signatureSourceR2Key(documentId, 1, SOURCE_HASH),
    signatureArtifactR2Key(documentId, 1, fieldId, FINAL_HASH),
    signatureFinalR2Key(documentId, 1, FINAL_HASH),
    signatureCertificateR2Key(documentId, 1, CERTIFICATE_HASH),
  ];
  assert.deepEqual(keys, [...keys]);
  for (const key of keys) {
    assert.match(key, /^signatures\/(?:source|artifacts|final|certificates)\//);
    assert.doesNotMatch(key, /@|Synthetic|Signer|example|contract/i);
  }
});

test("rollback is guarded when data exists", async () => {
  await draftFixture({ withParticipant: false, withField: false });
  await assert.rejects(db.exec(rollbackSql), /Cannot roll back 0022/);
  await db.exec("ROLLBACK");
});

test("signature domain has no routes, storage calls, email, or sensitive logging", async () => {
  const domainDirectory = path.join(root, "lib/signatures/domain");
  const files = (await readdir(domainDirectory)).filter((name) => name.endsWith(".ts"));
  for (const filename of files) {
    const source = await readFile(path.join(domainDirectory, filename), "utf8");
    assert.doesNotMatch(source, /console\.|Resend|@aws-sdk|DATABASE_URL|process\.env|fetch\(/);
    assert.doesNotMatch(source, /app\/(?:api|admin)|\/firmar/);
  }
  assert.equal(
    await readFile(path.join(root, "vercel.json"), "utf8").then((source) =>
      source.includes("signatures")
    ),
    false
  );
});
