import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { createSignatureDomainServices } from "../lib/signatures/domain/service.ts";
import { sha256SignatureValue } from "../lib/signatures/domain/crypto.ts";
import { createSignatureDraftLifecycleService } from "../lib/signatures/draft-lifecycle.ts";
import { parseSignatureParticipantDraft, SignatureParticipantAdminValidationError } from "../lib/signatures/admin-participant.ts";
import { createSignatureGovernanceWorkflow } from "../lib/signatures/governance-workflow.ts";
import { GOVERNANCE_APPROVAL_PHRASE } from "../lib/signatures/governance-constants.ts";

const root=path.dirname(fileURLToPath(new URL("../package.json",import.meta.url)));
const names=["0022_create_signature_foundation.sql","0023_extend_signature_signer_evidence.sql","0024_add_signature_delivery_governance.sql","0025_bind_signature_privacy_disclosure.sql","0026_preserve_signature_privacy_disclosure_text.sql","0027_add_signature_launch_governance.sql","0028_harden_signature_launch_governance.sql","0029_add_signature_governance_workflows.sql","0030_harden_signature_governance_workflow_immutability.sql","0031_add_signature_legal_holds.sql","0032_correct_signature_business_governance.sql","0033_harden_signature_preflight_authorization.sql","0034_add_signature_operational_hiding.sql","0035_productize_boriki_sign.sql"];
const migrations=await Promise.all(names.map((name)=>readFile(path.join(root,"db/migrations",name),"utf8")));
const db=new PGlite();
const executor=(source)=>({async unsafe(query,parameters=[]){return (await source.query(query,parameters)).rows;}});
const database={...executor(db),begin:(callback)=>db.transaction((tx)=>callback(executor(tx)))};
let adminId,domain;

before(async()=>{await db.exec(`CREATE TABLE admin_users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),username text UNIQUE NOT NULL);CREATE TABLE leads(id uuid PRIMARY KEY DEFAULT gen_random_uuid());CREATE TABLE lead_groups(id uuid PRIMARY KEY DEFAULT gen_random_uuid());INSERT INTO admin_users(username) VALUES ('phase2m-admin')`);for(const migration of migrations)await db.exec(migration);adminId=(await db.query(`SELECT id::text FROM admin_users LIMIT 1`)).rows[0].id;});
beforeEach(async()=>{await db.exec(`TRUNCATE signature_legal_holds,signature_governance_events,signature_launch_authorizations,signature_retention_policy_versions,signature_privacy_disclosure_versions,signature_events,signature_field_values,signature_sessions,signature_delivery_intents,signature_signing_tokens,signature_fields,signature_participants,signature_document_versions,signature_documents,signature_consent_versions,signature_document_type_approvals CASCADE`);domain=createSignatureDomainServices({database,eventHmacKey:"phase2m-event-key-at-least-thirty-two-bytes",eventHmacKeyVersion:1,networkEvidenceHmacKey:"phase2m-network-key-at-least-thirty-two-bytes"});});
after(()=>db.close());

function storageFor(key,bytes) { const objects=new Map([[key,new Uint8Array(bytes)]]);return {objects,async putSource(input){objects.set(input.key,new Uint8Array(input.bytes));return "created";},async getSource(input){const bytes=objects.get(input.key);if(!bytes)throw new Error("missing");return new Uint8Array(bytes);},async deleteSourceIfExact(input){return objects.delete(input.key);}}; }
async function draft() { const bytes=new Uint8Array([37,80,68,70]);const hash=sha256SignatureValue(bytes);const documentId=randomUUID();const created=await domain.createDraftWithVersion({documentId,title:"Synthetic inert draft",documentType:"transaction_acknowledgment",createdByAdminId:adminId,expiresAt:new Date("2035-01-01"),filename:"synthetic.pdf",byteCount:bytes.length,pageCount:1,sourceSha256:hash,pageGeometryManifest:[{pageIndex:0,mediaBox:{x:0,y:0,width:612,height:792},cropBox:{x:0,y:0,width:612,height:792},rotation:0,userUnit:1}],documentCreatedIdempotencyKey:randomUUID(),versionCreatedIdempotencyKey:randomUUID()});return {...created,documentId,bytes};}

test("participant draft validation accepts business roles and returns specific Spanish errors",()=>{
  assert.deepEqual(parseSignatureParticipantDraft({name:"Persona Sintética",email:"TEST@EXAMPLE.TEST",role:"Comprador principal",routingOrder:"2"}),{name:"Persona Sintética",email:"test@example.test",role:"Comprador principal",routingOrder:2});
  for(const [input,message] of [[{name:"",email:"a@example.test",role:"Comprador",routingOrder:""},"nombre"],[{name:"A",email:"bad",role:"Comprador",routingOrder:""},"correo válido"],[{name:"A",email:"a@example.test",role:"",routingOrder:""},"rol"],[{name:"A",email:"a@example.test",role:"Comprador",routingOrder:"9"},"orden"]]) assert.throws(()=>parseSignatureParticipantDraft(input),(error)=>error instanceof SignatureParticipantAdminValidationError&&error.userMessage.toLowerCase().includes(message));
});

test("draft preparation remains available while sending stays independently disabled",async()=>{
  const created=await draft();
  const participant=await domain.addParticipant({documentVersionId:created.documentVersionId,nameSnapshot:"Synthetic Person",emailSnapshot:"synthetic@example.test",role:"Comprador principal",routingOrder:1,actorAdminId:adminId,idempotencyKey:randomUUID()});
  await domain.addField({documentVersionId:created.documentVersionId,participantId:participant.participantId,fieldType:"signature",pageIndex:0,rect:{x:.1,y:.7,width:.3,height:.08},pageGeometryReference:{pageIndex:0,mediaBox:{x:0,y:0,width:612,height:792},cropBox:{x:0,y:0,width:612,height:792},rotation:0,userUnit:1},label:"Firma",required:true,tabOrder:1,validationLimits:{},actorAdminId:adminId,idempotencyKey:randomUUID()});
  assert.equal((await db.query(`SELECT count(*)::int count FROM signature_participants`)).rows[0].count,1);
  await assert.rejects(domain.prepareDocumentForSend({documentId:created.documentId,actorAdminId:adminId,idempotencyKey:randomUUID(),locale:"es-PR",publicSigningEnabled:false,privacyDisclosure:{version:"test-v1",approvalReference:"TEST",effectiveFrom:"2025-01-01T00:00:00.000Z",esPRSha256:"a".repeat(64),enUSSha256:"b".repeat(64),esPRText:"Texto sintético suficientemente largo.",enUSText:"Synthetic text sufficiently long."}}),/public_signing_disabled|privacy_disclosure_invalid/);
});

test("participant identity remains unique and the eight-participant limit is enforced",async()=>{
  const created=await draft();
  for(let index=0;index<8;index++) await domain.addParticipant({documentVersionId:created.documentVersionId,nameSnapshot:`Synthetic ${index}`,emailSnapshot:`synthetic-${index}@example.test`,role:"Participante",actorAdminId:adminId,idempotencyKey:randomUUID()});
  await assert.rejects(domain.addParticipant({documentVersionId:created.documentVersionId,nameSnapshot:"Duplicate",emailSnapshot:"synthetic-0@example.test",role:"Participante",actorAdminId:adminId,idempotencyKey:randomUUID()}),/duplicate|limit|unique/i);
  await assert.rejects(domain.addParticipant({documentVersionId:created.documentVersionId,nameSnapshot:"Ninth",emailSnapshot:"synthetic-9@example.test",role:"Participante",actorAdminId:adminId,idempotencyKey:randomUUID()}),/limit exceeded/i);
  assert.equal((await db.query(`SELECT count(*)::int count FROM signature_participants`)).rows[0].count,8);
});

test("formal categories can be restricted without fabricating external approval",async()=>{
  const workflow=createSignatureGovernanceWorkflow(database,()=>new Date("2032-06-01"));
  const created=await workflow.createClassificationDraft({documentType:"notarized_document",displayName:"Synthetic notarial example",description:"Synthetic only",permittedSigningUse:"Not permitted in Borikí Signing",actorAdminId:adminId});
  await workflow.submitClassification({id:created.id,actorAdminId:adminId});
  await workflow.approveClassification({id:created.id,approvalMode:"out_of_scope",approvalReference:"INTERNAL-SCOPE-DECISION",approverRole:"Operador autorizado",approvalDate:"2032-06-01",effectiveFrom:new Date("2032-06-01"),actorAdminId:adminId,confirmationPhrase:GOVERNANCE_APPROVAL_PHRASE,immutableAcknowledged:true});
  const row=(await db.query(`SELECT status,approval_mode,counsel_name FROM signature_document_type_approvals WHERE id=$1`,[created.id])).rows[0];
  assert.deepEqual(row,{status:"restricted",approval_mode:"out_of_scope",counsel_name:null});
  await assert.rejects(db.query(`UPDATE signature_document_type_approvals SET display_name='rewritten' WHERE id=$1`,[created.id]),/immutable/);
});

test("inert draft deletion removes the exact private source and preserves an immutable tombstone event",async()=>{
  const created=await draft();const storage=storageFor(created.sourceR2Key,created.bytes);const service=createSignatureDraftLifecycleService(database,storage,()=>new Date("2032-06-01"));
  assert.equal((await service.inspectDeletion(created.documentId)).eligible,true);
  await service.deleteInertDraft({documentId:created.documentId,actorAdminId:adminId,reason:"Synthetic cleanup",confirmationPhrase:"ELIMINAR BORRADOR"});
  assert.equal(storage.objects.size,0);
  const state=(await db.query(`SELECT d.status,d.deleted_at IS NOT NULL deleted,v.source_deleted_at IS NOT NULL source_deleted FROM signature_documents d JOIN signature_document_versions v ON v.id=d.active_version_id WHERE d.id=$1`,[created.documentId])).rows[0];
  assert.deepEqual(state,{status:"archived",deleted:true,source_deleted:true});
  assert.equal((await db.query(`SELECT count(*)::int count FROM signature_governance_events WHERE entity_type='signing_draft' AND action='deleted'`)).rows[0].count,1);
  await assert.rejects(db.query(`DELETE FROM signature_governance_events WHERE entity_type='signing_draft'`),/immutable/);
});

test("participant activity blocks destructive deletion but explicit archive preserves source",async()=>{
  const created=await draft();const storage=storageFor(created.sourceR2Key,created.bytes);const service=createSignatureDraftLifecycleService(database,storage);
  await domain.addParticipant({documentVersionId:created.documentVersionId,nameSnapshot:"Synthetic Person",emailSnapshot:"synthetic@example.test",role:"Comprador",actorAdminId:adminId,idempotencyKey:randomUUID()});
  assert.deepEqual((await service.inspectDeletion(created.documentId)).reasons,["participants_exist"]);
  await assert.rejects(service.deleteInertDraft({documentId:created.documentId,actorAdminId:adminId,reason:"No",confirmationPhrase:"ELIMINAR BORRADOR"}),/blocked/);
  await service.archiveDraft({documentId:created.documentId,actorAdminId:adminId,reason:"Preserve activity"});
  assert.equal(storage.objects.size,1);assert.equal((await db.query(`SELECT status FROM signature_documents WHERE id=$1`,[created.documentId])).rows[0].status,"archived");
});
