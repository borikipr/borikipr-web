import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test,{after,before,beforeEach} from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { createSignatureLegalHoldService,hasActiveSignatureLegalHold } from "../lib/signatures/legal-holds.ts";
import { isSignerAccessAuthorized } from "../lib/signatures/canary-gate.ts";
import { evaluateSignatureRetention,parseSignatureRetentionPolicy } from "../lib/signatures/retention-policy.ts";
import { getSignatureRetentionPreview } from "../lib/signatures/governance-workflow.ts";
import { createSignatureGovernanceWorkflow } from "../lib/signatures/governance-workflow.ts";

const root=path.dirname(fileURLToPath(new URL("../package.json",import.meta.url)));
const migrationNames=["0022_create_signature_foundation.sql","0023_extend_signature_signer_evidence.sql","0024_add_signature_delivery_governance.sql","0025_bind_signature_privacy_disclosure.sql","0026_preserve_signature_privacy_disclosure_text.sql","0027_add_signature_launch_governance.sql","0028_harden_signature_launch_governance.sql","0029_add_signature_governance_workflows.sql","0030_harden_signature_governance_workflow_immutability.sql","0031_add_signature_legal_holds.sql"];
const migrations=await Promise.all(migrationNames.map(n=>readFile(path.join(root,"db/migrations",n),"utf8")));
const adminActions=await readFile(path.join(root,"app/admin/signatures/gobernanza/actions.ts"),"utf8");
const signatureAdminActions=await readFile(path.join(root,"app/admin/signatures/actions.ts"),"utf8");
const signatureAdminPage=await readFile(path.join(root,"app/admin/signatures/[id]/page.tsx"),"utf8");
const signerRequest=await readFile(path.join(root,"lib/signatures/signer/request.ts"),"utf8");
const signingLanding=await readFile(path.join(root,"app/firmar/[token]/page.tsx"),"utf8");
const exchangeRoute=await readFile(path.join(root,"app/api/signatures/session/exchange/route.ts"),"utf8");
const db=new PGlite();
const executor=source=>({async unsafe(query,parameters=[]){return (await source.query(query,parameters)).rows;}});
const database={...executor(db),begin:callback=>db.transaction(tx=>callback(executor(tx)))};
let adminId,documentId,versionId,participantId;
before(async()=>{await db.exec(`CREATE TABLE admin_users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),username text UNIQUE NOT NULL);CREATE TABLE leads(id uuid PRIMARY KEY DEFAULT gen_random_uuid());CREATE TABLE lead_groups(id uuid PRIMARY KEY DEFAULT gen_random_uuid());INSERT INTO admin_users(username) VALUES('synthetic-phase2i-admin');`);for(const m of migrations)await db.exec(m);adminId=(await db.query(`SELECT id::text FROM admin_users LIMIT 1`)).rows[0].id;});
beforeEach(async()=>{await db.exec(`TRUNCATE signature_legal_holds,signature_governance_events,signature_launch_authorizations,signature_events,signature_field_values,signature_sessions,signature_delivery_intents,signature_signing_tokens,signature_fields,signature_participants,signature_document_versions,signature_documents CASCADE`);documentId=randomUUID();versionId=randomUUID();participantId=randomUUID();await db.query(`INSERT INTO signature_documents(id,title,document_type,created_by_admin_id) VALUES($1,'Synthetic Phase 2I','ordinary_brokerage_agreement',$2)`,[documentId,adminId]);await db.query(`INSERT INTO signature_document_versions(id,document_id,version_number,source_r2_key,filename_snapshot,mime_type,byte_count,page_count,source_sha256,page_geometry_manifest,created_by_admin_id) VALUES($1,$2,1,$3,'synthetic.pdf','application/pdf',100,1,$4,$5::jsonb,$6)`,[versionId,documentId,`signatures/source/${documentId}/1/${"a".repeat(64)}.pdf`,"a".repeat(64),JSON.stringify([{pageIndex:0}]),adminId]);await db.query(`INSERT INTO signature_participants(id,document_version_id,name_snapshot,email_snapshot,normalized_email,role) VALUES($1,$2,'Synthetic Participant','synthetic@example.test','synthetic@example.test','signer')`,[participantId,versionId]);});
after(()=>db.close());

const policy=parseSignatureRetentionPolicy(JSON.stringify({version:"test",approvalReference:"TEST",privacyReference:"TEST",sourcePdfDays:1,completedPdfDays:1,certificateDays:1,evidenceManifestDays:1,tokenDays:1,sessionHours:1,networkEvidenceDays:1,failedCancelledDraftDays:1,auditEventDays:1,completedCleanupEnabled:true}));

test("persisted legal hold protects every document evidence class and release is auditable",async()=>{
 const service=createSignatureLegalHoldService(database,()=>new Date("2032-05-01T00:00:00Z"));
 const hold=await service.place({scopeType:"document",documentId,reasonReference:"SYNTHETIC TEST HOLD",actorAdminId:adminId,idempotencyKey:"11111111-1111-4111-8111-111111111111"});
 for(const evidenceClass of ["source_pdf","completed_pdf","certificate","evidence_manifest","audit_event"]){
  assert.equal(await hasActiveSignatureLegalHold(database,{documentId,documentVersionId:versionId,evidenceClass}),true);
  assert.equal(evaluateSignatureRetention({policy,recordType:evidenceClass,createdAt:new Date(0),now:new Date("2032-05-02"),legalHold:true,completedRecord:true}).reason,"legal_hold");
 }
 assert.equal((await getSignatureRetentionPreview(database)).legal_holds,1);
 await assert.rejects(service.place({scopeType:"document",documentId,reasonReference:"REPLAY",actorAdminId:adminId,idempotencyKey:"11111111-1111-4111-8111-111111111111"}),/unique|duplicate/i);
 await service.release({id:hold.id,releaseReference:"SYNTHETIC RELEASE",actorAdminId:adminId,idempotencyKey:"22222222-2222-4222-8222-222222222222"});
 assert.equal(await hasActiveSignatureLegalHold(database,{documentId,documentVersionId:versionId,evidenceClass:"source_pdf"}),false);
 await assert.rejects(service.release({id:hold.id,releaseReference:"REPLAY",actorAdminId:adminId}),/release_rejected/);
 await assert.rejects(db.query(`UPDATE signature_legal_holds SET reason_reference='changed' WHERE id=$1`,[hold.id]),/immutable/);
 assert.deepEqual((await db.query(`SELECT action FROM signature_governance_events WHERE entity_type='legal_hold' ORDER BY created_at,id`)).rows.map(r=>r.action),["placed","released"]);
});

test("legal hold Admin mutations require server authentication boundary and never log evidence",()=>{
 assert.match(adminActions,/getAdminSession\(\)/);assert.match(adminActions,/placeLegalHoldAction/);assert.match(adminActions,/releaseLegalHoldAction/);assert.doesNotMatch(adminActions,/console\.(?:log|info|warn|error)/);
 assert.match(adminActions,/LIBERAR RETENCION LEGAL/);assert.match(adminActions,/immutableAcknowledged/);
});

test("production internal canary requires flag, matching readiness, participant, document type, environment and expiry",async()=>{
 const hash="b".repeat(64);const base={NODE_ENV:"production",SIGNING_PUBLIC_ENABLED:"false",SIGNING_INTERNAL_CANARY_ENABLED:"true",SIGNING_INTERNAL_CANARY_READINESS_SHA256:hash};
 assert.equal(await isSignerAccessAuthorized(database,{participantId,documentVersionId:versionId},{}),false);
 assert.equal(await isSignerAccessAuthorized(database,{participantId,documentVersionId:versionId},base,new Date("2032-05-01")),false);
 await db.query(`INSERT INTO signature_launch_authorizations(environment,authorization_type,readiness_snapshot_sha256,explicit_confirmation,authorized_by_admin_id,expires_at,authorized_participant_scope,authorized_document_types) VALUES('production','internal_canary',$1,true,$2,'2032-05-02',$3::jsonb,$4::text[])`,[hash,adminId,JSON.stringify([participantId]),["ordinary_brokerage_agreement"]]);
 assert.equal(await isSignerAccessAuthorized(database,{participantId,documentVersionId:versionId},{...base,SIGNING_INTERNAL_CANARY_READINESS_SHA256:"c".repeat(64)},new Date("2032-05-01")),false);
 assert.equal(await isSignerAccessAuthorized(database,{participantId:randomUUID(),documentVersionId:versionId},base,new Date("2032-05-01")),false);
 assert.equal(await isSignerAccessAuthorized(database,{participantId,documentVersionId:versionId},base,new Date("2032-05-03")),false);
 assert.equal(await isSignerAccessAuthorized(database,{participantId,documentVersionId:versionId},base,new Date("2032-05-01")),true);
 assert.equal(await isSignerAccessAuthorized(database,{participantId,documentVersionId:versionId},{...base,SIGNING_INTERNAL_CANARY_ENABLED:"false"},new Date("2032-05-01")),false);
});

test("public launch authorization cannot substitute for internal canary authorization",async()=>{
 const hash="d".repeat(64);await db.query(`INSERT INTO signature_launch_authorizations(environment,authorization_type,readiness_snapshot_sha256,explicit_confirmation,authorized_by_admin_id,authorized_participant_scope,authorized_document_types) VALUES('production','production_public_launch',$1,true,$2,$3::jsonb,$4::text[])`,[hash,adminId,JSON.stringify([participantId]),["ordinary_brokerage_agreement"]]);
 assert.equal(await isSignerAccessAuthorized(database,{participantId,documentVersionId:versionId},{NODE_ENV:"production",SIGNING_PUBLIC_ENABLED:"false",SIGNING_INTERNAL_CANARY_ENABLED:"true",SIGNING_INTERNAL_CANARY_READINESS_SHA256:hash},new Date("2032-05-01")),false);
});

test("emergency revocation immediately disables an authorized production canary",async()=>{
 const hash="e".repeat(64);const now=new Date("2032-05-01T00:00:00Z");
 const workflow=createSignatureGovernanceWorkflow(database,()=>now);
 const authorization=await workflow.authorizeProductionCanary({readinessSnapshotSha256:hash,participantScope:[participantId],documentTypes:["ordinary_brokerage_agreement"],expiresAt:new Date("2032-05-02"),actorAdminId:adminId,explicitConfirmation:true});
 const environment={NODE_ENV:"production",SIGNING_PUBLIC_ENABLED:"false",SIGNING_INTERNAL_CANARY_ENABLED:"true",SIGNING_INTERNAL_CANARY_READINESS_SHA256:hash};
 assert.equal(await isSignerAccessAuthorized(database,{participantId,documentVersionId:versionId},environment,now),true);
 await assert.rejects(workflow.revokeProductionCanary({id:authorization.id,actorAdminId:adminId,explicitConfirmation:false}),/confirmation_required/);
 await workflow.revokeProductionCanary({id:authorization.id,actorAdminId:adminId,explicitConfirmation:true,idempotencyKey:"33333333-3333-4333-8333-333333333333"});
 assert.equal(await isSignerAccessAuthorized(database,{participantId,documentVersionId:versionId},environment,now),false);
 await assert.rejects(workflow.revokeProductionCanary({id:authorization.id,actorAdminId:adminId,explicitConfirmation:true}),/revoke_rejected/);
});

test("production canary authorization is enforced at Admin send, landing, exchange and active sessions",()=>{
 for(const source of [signatureAdminActions,signatureAdminPage,signerRequest,signingLanding,exchangeRoute]) assert.match(source,/isSignerAccessAuthorized|assertSignerAccessAuthorized/);
 assert.match(signatureAdminActions,/participantId: participant\.id/);
 assert.match(signatureAdminActions,/documentVersionId: authorizationDetail!\.version\.id/);
 for(const source of [signatureAdminActions,signatureAdminPage,signerRequest,signingLanding,exchangeRoute]) assert.doesNotMatch(source,/searchParams|get\(["']canary["']\)/);
});
