import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { createSignatureGovernanceWorkflow, getSignatureRetentionPreview } from "../lib/signatures/governance-workflow.ts";
import { GOVERNANCE_APPROVAL_PHRASE, RETENTION_ACTIVATION_PHRASE } from "../lib/signatures/governance-constants.ts";
import { parseSignatureRetentionPolicy } from "../lib/signatures/retention-policy.ts";

const root=path.dirname(fileURLToPath(new URL("../package.json",import.meta.url)));
const actionSource=await readFile(path.join(root,"app/admin/signatures/gobernanza/actions.ts"),"utf8");
const migrations=await Promise.all(["0022_create_signature_foundation.sql","0023_extend_signature_signer_evidence.sql","0024_add_signature_delivery_governance.sql","0025_bind_signature_privacy_disclosure.sql","0026_preserve_signature_privacy_disclosure_text.sql","0027_add_signature_launch_governance.sql","0028_harden_signature_launch_governance.sql","0029_add_signature_governance_workflows.sql","0030_harden_signature_governance_workflow_immutability.sql","0031_add_signature_legal_holds.sql","0032_correct_signature_business_governance.sql","0033_harden_signature_preflight_authorization.sql"].map(name=>readFile(path.join(root,"db/migrations",name),"utf8")));
const db=new PGlite();
const executor=(source)=>({async unsafe(query,parameters=[]){return (await source.query(query,parameters)).rows;}});
const database={...executor(db),begin:(callback)=>db.transaction(tx=>callback(executor(tx)))};
let adminId;
before(async()=>{await db.exec(`CREATE TABLE public.admin_users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),username text UNIQUE NOT NULL);CREATE TABLE public.leads(id uuid PRIMARY KEY DEFAULT gen_random_uuid());CREATE TABLE public.lead_groups(id uuid PRIMARY KEY DEFAULT gen_random_uuid());INSERT INTO public.admin_users(username) VALUES('synthetic-governance-admin');`);adminId=(await db.query(`SELECT id::text FROM admin_users LIMIT 1`)).rows[0].id;for(const migration of migrations)await db.exec(migration);});
beforeEach(()=>db.exec(`TRUNCATE signature_legal_holds,signature_governance_events,signature_launch_authorizations,signature_retention_policy_versions,signature_privacy_disclosure_versions,signature_events,signature_field_values,signature_sessions,signature_delivery_intents,signature_signing_tokens,signature_fields,signature_participants,signature_document_versions,signature_documents,signature_consent_versions,signature_document_type_approvals CASCADE`));
after(()=>db.close());

const policy=parseSignatureRetentionPolicy(JSON.stringify({version:"synthetic-v1",approvalReference:"TEST-PENDING-REFERENCE",privacyReference:"TEST-PRIVACY",sourcePdfDays:3650,completedPdfDays:null,certificateDays:null,evidenceManifestDays:null,tokenDays:30,sessionHours:24,networkEvidenceDays:90,failedCancelledDraftDays:90,auditEventDays:null,completedCleanupEnabled:false}));

test("internal business approval is normal, external review remains optional, and approvals are immutable",async()=>{
  const workflow=createSignatureGovernanceWorkflow(database,()=>new Date("2032-05-01T00:00:00Z"));
  const draft=await workflow.createClassificationDraft({documentType:"ordinary_brokerage_agreement",displayName:"Synthetic classification",description:"Synthetic test only",permittedSigningUse:"Synthetic isolated test only",actorAdminId:adminId});
  await assert.rejects(workflow.approveClassification({id:draft.id,approvalMode:"internal_business",approverRole:"Broker owner",approvalReference:"TEST-ONLY",approvalDate:"2032-05-01",effectiveFrom:new Date("2032-05-01"),actorAdminId:adminId,confirmationPhrase:GOVERNANCE_APPROVAL_PHRASE,immutableAcknowledged:true}),/approval_rejected/);
  await workflow.submitClassification({id:draft.id,actorAdminId:adminId});
  await workflow.approveClassification({id:draft.id,approvalMode:"internal_business",approverRole:"Broker owner",approvalReference:"TEST-ONLY",approvalDate:"2032-05-01",effectiveFrom:new Date("2032-05-01"),actorAdminId:adminId,confirmationPhrase:GOVERNANCE_APPROVAL_PHRASE,immutableAcknowledged:true});
  const row=(await db.query(`SELECT approval_mode,counsel_name,approved_by_admin_id::text,entered_by_admin_id::text,status,approval_snapshot_sha256 FROM signature_document_type_approvals WHERE id=$1`,[draft.id])).rows[0];
  assert.equal(row.approval_mode,"internal_business");assert.equal(row.counsel_name,null);assert.equal(row.approved_by_admin_id,adminId);assert.equal(row.entered_by_admin_id,adminId);assert.equal(row.status,"approved");assert.match(row.approval_snapshot_sha256,/^[0-9a-f]{64}$/);
  await assert.rejects(db.query(`UPDATE signature_document_type_approvals SET approver_role='changed' WHERE id=$1`,[draft.id]),/immutable/);

  const external=await workflow.createClassificationDraft({documentType:"lease",displayName:"Synthetic external review",description:"Synthetic",permittedSigningUse:"Synthetic",actorAdminId:adminId});
  await workflow.submitClassification({id:external.id,actorAdminId:adminId});
  await workflow.approveClassification({id:external.id,approvalMode:"external_review",approverRole:"Authorized operator",externalReviewerName:"External Reviewer",externalReviewerOrganization:"Test Organization",externalReviewerRole:"Reviewer",externalReviewerReference:"TEST-EVIDENCE",approvalReference:"TEST-EXTERNAL",approvalDate:"2032-05-01",effectiveFrom:new Date("2032-05-01"),actorAdminId:adminId,confirmationPhrase:GOVERNANCE_APPROVAL_PHRASE,immutableAcknowledged:true});
  assert.equal((await db.query(`SELECT approval_mode,counsel_name FROM signature_document_type_approvals WHERE id=$1`,[external.id])).rows[0].approval_mode,"external_review");
});

test("consent and privacy require review and exact immutable hashes",async()=>{
  const workflow=createSignatureGovernanceWorkflow(database,()=>new Date("2032-05-01T00:00:00Z"));
  const consent=await workflow.createConsentDraft({versionIdentifier:"synthetic-consent-v1",locale:"es-PR",text:"Synthetic consent text for isolated tests only.",actorAdminId:adminId});
  await workflow.submitConsent({id:consent.id,actorAdminId:adminId});
  await assert.rejects(workflow.approveConsent({id:consent.id,approvalMode:"internal_business",approverRole:"Authorized operator",approvalReference:"TEST",effectiveFrom:new Date("2032-05-01"),actorAdminId:adminId,confirmationPhrase:"wrong",immutableAcknowledged:true}),/confirmation_required/);
  await workflow.approveConsent({id:consent.id,approvalMode:"internal_business",approverRole:"Authorized operator",approvalReference:"TEST",effectiveFrom:new Date("2032-05-01"),actorAdminId:adminId,confirmationPhrase:GOVERNANCE_APPROVAL_PHRASE,immutableAcknowledged:true});
  const privacy=await workflow.createPrivacyDraft({versionIdentifier:"synthetic-privacy-v1",esPRText:"Texto sintetico de privacidad solo para pruebas aisladas.",enUSText:"Synthetic privacy text only for isolated testing.",actorAdminId:adminId});
  await workflow.submitPrivacy({id:privacy.id,actorAdminId:adminId});
  await workflow.approvePrivacy({id:privacy.id,approvalMode:"internal_business",approverRole:"Authorized operator",approvalReference:"TEST",effectiveFrom:new Date("2032-05-01"),actorAdminId:adminId,confirmationPhrase:GOVERNANCE_APPROVAL_PHRASE,immutableAcknowledged:true});
  await assert.rejects(db.query(`UPDATE signature_privacy_disclosure_versions SET en_us_text='changed' WHERE id=$1`,[privacy.id]),/immutable/);
  const events=(await db.query(`SELECT action,previous_state,new_state FROM signature_governance_events ORDER BY created_at,id`)).rows;
  assert.equal(events.length,6);assert.equal(events.every(event=>event.new_state),true);
});

test("retention approval and activation are separate and preview never deletes",async()=>{
  const workflow=createSignatureGovernanceWorkflow(database,()=>new Date("2032-05-01T00:00:00Z"));
  const retention=await workflow.createRetentionDraft({versionIdentifier:"synthetic-retention-v1",privacyReference:"TEST-PRIVACY",policy,actorAdminId:adminId});
  await workflow.submitRetention({id:retention.id,actorAdminId:adminId});
  await workflow.approveRetention({id:retention.id,approvalMode:"internal_business",approverRole:"Authorized operator",approvalReference:"TEST",actorAdminId:adminId,confirmationPhrase:GOVERNANCE_APPROVAL_PHRASE,immutableAcknowledged:true});
  assert.equal((await db.query(`SELECT status FROM signature_retention_policy_versions WHERE id=$1`,[retention.id])).rows[0].status,"approved");
  await workflow.activateRetention({id:retention.id,actorAdminId:adminId,confirmationPhrase:RETENTION_ACTIVATION_PHRASE,immutableAcknowledged:true});
  await assert.rejects(db.query(`UPDATE signature_retention_policy_versions SET token_days=1 WHERE id=$1`,[retention.id]),/immutable/);
  const preview=await getSignatureRetentionPreview(database,new Date("2032-05-01"));
  assert.equal(preview.destructiveActionPerformed,false);assert.equal(preview.completed,0);
  await assert.rejects(db.query(`DELETE FROM signature_governance_events`),/immutable/);
});

test("governance mutations are server-authenticated and reject replayed or stale approval",async()=>{
  assert.match(actionSource,/"use server"/);
  assert.match(actionSource,/getAdminSession\(\)/);
  assert.doesNotMatch(actionSource,/console\.(?:log|info|warn|error)|SIGNING_PUBLIC_ENABLED|SIGNING_INTERNAL_CANARY_ENABLED/);
  const workflow=createSignatureGovernanceWorkflow(database,()=>new Date("2032-05-01T00:00:00Z"));
  const consent=await workflow.createConsentDraft({versionIdentifier:"synthetic-consent-v2",locale:"en-US",text:"Synthetic immutable consent text for security tests.",actorAdminId:adminId,idempotencyKey:"11111111-1111-4111-8111-111111111111"});
  await assert.rejects(workflow.createConsentDraft({versionIdentifier:"synthetic-consent-v3",locale:"en-US",text:"Another synthetic immutable consent text.",actorAdminId:adminId,idempotencyKey:"11111111-1111-4111-8111-111111111111"}),/unique|duplicate/i);
  await workflow.submitConsent({id:consent.id,actorAdminId:adminId});
  const approval={id:consent.id,approvalMode:"internal_business",approverRole:"Authorized operator",approvalReference:"TEST",effectiveFrom:new Date("2032-05-01"),actorAdminId:adminId,confirmationPhrase:GOVERNANCE_APPROVAL_PHRASE,immutableAcknowledged:true};
  await workflow.approveConsent(approval);
  await assert.rejects(workflow.approveConsent(approval),/approval_rejected|hash_mismatch/);
});

test("legacy caller-supplied readiness cannot create a production canary authorization",async()=>{
  const workflow=createSignatureGovernanceWorkflow(database,()=>new Date("2032-05-01T00:00:00Z"));
  await assert.rejects(workflow.authorizeProductionCanary({readinessSnapshotSha256:"a".repeat(64),participantScope:["synthetic-internal-1"],documentTypes:["ordinary_brokerage_agreement"],expiresAt:new Date("2032-05-02"),actorAdminId:adminId,explicitConfirmation:true}),/confirmation_required/);
  assert.equal((await db.query(`SELECT count(*)::integer count FROM signature_launch_authorizations`)).rows[0].count,0);
});
