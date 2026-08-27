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
const names=["0022_create_signature_foundation.sql","0023_extend_signature_signer_evidence.sql","0024_add_signature_delivery_governance.sql","0025_bind_signature_privacy_disclosure.sql","0026_preserve_signature_privacy_disclosure_text.sql","0027_add_signature_launch_governance.sql","0028_harden_signature_launch_governance.sql","0029_add_signature_governance_workflows.sql","0030_harden_signature_governance_workflow_immutability.sql","0031_add_signature_legal_holds.sql","0032_correct_signature_business_governance.sql","0033_harden_signature_preflight_authorization.sql","0034_add_signature_operational_hiding.sql","0035_productize_boriki_sign.sql","0040_add_signature_operational_restore.sql","0041_add_signature_test_cleanup.sql","0042_expand_test_signature_cleanup.sql"];
const migrations=await Promise.all(names.map((name)=>readFile(path.join(root,"db/migrations",name),"utf8")));
const db=new PGlite();
const executor=(source)=>({async unsafe(query,parameters=[]){return (await source.query(query,parameters)).rows;}});
const database={...executor(db),begin:(callback)=>db.transaction((tx)=>callback(executor(tx)))};
let adminId,domain;

before(async()=>{await db.exec(`CREATE TABLE admin_users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),username text UNIQUE NOT NULL);CREATE TABLE leads(id uuid PRIMARY KEY DEFAULT gen_random_uuid());CREATE TABLE lead_groups(id uuid PRIMARY KEY DEFAULT gen_random_uuid());INSERT INTO admin_users(username) VALUES ('phase2m-admin')`);for(const migration of migrations)await db.exec(migration);adminId=(await db.query(`SELECT id::text FROM admin_users LIMIT 1`)).rows[0].id;});
beforeEach(async()=>{await db.exec(`TRUNCATE signature_test_cleanup_events,signature_legal_holds,signature_governance_events,signature_launch_authorizations,signature_retention_policy_versions,signature_privacy_disclosure_versions,signature_events,signature_field_values,signature_sessions,signature_delivery_intents,signature_signing_tokens,signature_fields,signature_participants,signature_document_versions,signature_documents,signature_consent_versions,signature_document_type_approvals CASCADE`);domain=createSignatureDomainServices({database,eventHmacKey:"phase2m-event-key-at-least-thirty-two-bytes",eventHmacKeyVersion:1,networkEvidenceHmacKey:"phase2m-network-key-at-least-thirty-two-bytes"});});
after(()=>db.close());

function storageFor(key,bytes) { const objects=new Map([[key,new Uint8Array(bytes)]]);return {objects,async putSource(input){objects.set(input.key,new Uint8Array(input.bytes));return "created";},async getSource(input){const bytes=objects.get(input.key);if(!bytes)throw new Error("missing");return new Uint8Array(bytes);},async deleteSourceIfExact(input){return objects.delete(input.key);},async putFinal(input){objects.set(input.key,new Uint8Array(input.bytes));return "created";},async putCertificate(input){objects.set(input.key,new Uint8Array(input.bytes));return "created";},async getFinal(input){const value=objects.get(input.key);if(!value)throw new Error("missing");return new Uint8Array(value);},async getCertificate(input){const value=objects.get(input.key);if(!value)throw new Error("missing");return new Uint8Array(value);},async deleteFinalIfExact(input){return objects.delete(input.key);},async deleteCertificateIfExact(input){return objects.delete(input.key);}}; }
async function draft() { const bytes=new Uint8Array([37,80,68,70]);const hash=sha256SignatureValue(bytes);const documentId=randomUUID();const created=await domain.createDraftWithVersion({documentId,title:"Synthetic inert draft",documentType:"transaction_acknowledgment",createdByAdminId:adminId,expiresAt:new Date("2035-01-01"),filename:"synthetic.pdf",byteCount:bytes.length,pageCount:1,sourceSha256:hash,pageGeometryManifest:[{pageIndex:0,mediaBox:{x:0,y:0,width:612,height:792},cropBox:{x:0,y:0,width:612,height:792},rotation:0,userUnit:1}],documentCreatedIdempotencyKey:randomUUID(),versionCreatedIdempotencyKey:randomUUID()});return {...created,documentId,bytes,sourceSha256:hash};}

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

async function completedFixture({canary=true,active=false}={}) {
  const created=await draft();
  const participant=await domain.addParticipant({documentVersionId:created.documentVersionId,nameSnapshot:"Synthetic Cleanup",emailSnapshot:"synthetic@example.test",role:"Comprador",routingOrder:1,actorAdminId:adminId,idempotencyKey:randomUUID()});
  await domain.addField({documentVersionId:created.documentVersionId,participantId:participant.participantId,fieldType:"signature",pageIndex:0,rect:{x:.1,y:.7,width:.3,height:.08},pageGeometryReference:{pageIndex:0},label:"Firma sintética",required:false,tabOrder:1,validationLimits:{},actorAdminId:adminId,idempotencyKey:randomUUID()});
  const finalBytes=new Uint8Array([37,80,68,70,45,70]);const certificateBytes=new Uint8Array([37,80,68,70,45,67]);
  const finalHash=sha256SignatureValue(finalBytes);const certificateHash=sha256SignatureValue(certificateBytes);
  const finalKey=`signatures/final/${created.documentId}/1/${finalHash}.pdf`;const certificateKey=`signatures/certificates/${created.documentId}/1/${certificateHash}.pdf`;
  const approvalId=randomUUID();const consentId=randomUUID();
  await db.query(`INSERT INTO signature_document_type_approvals(id,document_type,status,approval_reference,approval_date,reviewed_by,source_reference,effective_from,legacy_imported) VALUES($1,'transaction_acknowledgment','approved','SYNTHETIC-TEST',current_date,'Synthetic reviewer','Synthetic source',now(),true)`,[approvalId]);
  await db.query(`INSERT INTO signature_consent_versions(id,version_identifier,locale,consent_text,consent_text_sha256,status,effective_from,approval_reference,created_by_admin_id,legacy_imported) VALUES($1,'synthetic-cleanup-v1','es-PR','Synthetic consent text for cleanup fixture only.',$2,'approved',now(),'SYNTHETIC-TEST',$3,true)`,[consentId,"c".repeat(64),adminId]);
  await db.query(`UPDATE signature_document_versions SET field_definition_sha256=$2,locked_at=now(),finalized_at=now(),final_r2_key=$3,final_filename='completed.pdf',final_mime_type='application/pdf',final_byte_count=$4,final_page_count=1,final_pdf_metadata='{}',final_pdf_sha256=$5,certificate_r2_key=$6,certificate_mime_type='application/pdf',certificate_byte_count=$7,certificate_metadata='{}',certificate_sha256=$8 WHERE id=$1`,[created.documentVersionId,"d".repeat(64),finalKey,finalBytes.length,finalHash,certificateKey,certificateBytes.length,certificateHash]);
  await db.exec(`ALTER TABLE signature_documents DISABLE TRIGGER signature_documents_transition_trigger;ALTER TABLE signature_participants DISABLE TRIGGER signature_participants_transition_trigger`);
  await db.query(`UPDATE signature_documents SET status='sent',document_type_approval_reference='SYNTHETIC-TEST',document_type_approval_id=$2,consent_version_id=$3,privacy_disclosure_version='synthetic-v1',privacy_disclosure_es_pr_sha256=$4,privacy_disclosure_en_us_sha256=$5,privacy_disclosure_effective_from=now(),privacy_disclosure_approval_reference='SYNTHETIC-TEST',privacy_disclosure_es_pr_text='Texto sintético de privacidad para la prueba de limpieza.',privacy_disclosure_en_us_text='Synthetic privacy text for cleanup testing only.',sent_at=now() WHERE id=$1`,[created.documentId,approvalId,consentId,"e".repeat(64),"f".repeat(64)]);
  await db.query(`UPDATE signature_participants SET status='invited',invited_at=now(),delivery_sent_at=now() WHERE id=$1`,[participant.participantId]);
  await db.query(`UPDATE signature_participants SET status='viewed',viewed_at=now() WHERE id=$1`,[participant.participantId]);
  await db.query(`UPDATE signature_participants SET status='consented',consented_at=now(),consent_version='synthetic-v1',consent_text_sha256=$2,consent_source_sha256=$3,consent_locale='es-PR' WHERE id=$1`,[participant.participantId,"a".repeat(64),created.sourceSha256]);
  await db.query(`UPDATE signature_participants SET status='completed',completed_at=now() WHERE id=$1`,[participant.participantId]);
  const tokenId=randomUUID();const sessionId=randomUUID();
  await db.query(`INSERT INTO signature_signing_tokens(id,participant_id,document_version_id,token_digest,purpose,key_version,issued_at,expires_at,consumed_at) VALUES($1,$2,$3,$4,'sign_document',1,now(),now()+interval '1 hour',now())`,[tokenId,participant.participantId,created.documentVersionId,"1".repeat(64)]);
  await db.query(`INSERT INTO signature_sessions(id,token_id,participant_id,document_version_id,session_secret_digest,csrf_nonce_digest,created_at,last_seen_at,expires_at,idle_expires_at,completed_at) VALUES($1,$2,$3,$4,$5,$6,now(),now(),now()+interval '1 hour',now()+interval '30 minutes',now())`,[sessionId,tokenId,participant.participantId,created.documentVersionId,"2".repeat(64),"3".repeat(64)]);
  const fieldId=(await db.query(`SELECT id::text FROM signature_fields WHERE document_version_id=$1 LIMIT 1`,[created.documentVersionId])).rows[0].id;
  await db.query(`INSERT INTO signature_field_values(signature_field_id,participant_id,capture_method,sanitized_typed_value,value_artifact_sha256,signer_session_id) VALUES($1,$2,'typed','Synthetic Signature',$3,$4)`,[fieldId,participant.participantId,"4".repeat(64),sessionId]);
  await db.query(`INSERT INTO signature_delivery_intents(participant_id,document_version_id,token_id,delivery_kind,locale,recipient_email_snapshot,status,attempts,idempotency_key,provider_message_reference,created_by_admin_id,attempted_at,delivered_at) VALUES($1,$2,$3,'invitation','es-PR','synthetic@example.test','sent',1,$4,'synthetic-message',$5,now(),now())`,[participant.participantId,created.documentVersionId,tokenId,randomUUID(),adminId]);
  await db.query(`UPDATE signature_documents SET status='completed',completed_at=now() WHERE id=$1`,[created.documentId]);
  await db.exec(`ALTER TABLE signature_documents ENABLE TRIGGER signature_documents_transition_trigger;ALTER TABLE signature_participants ENABLE TRIGGER signature_participants_transition_trigger`);
  if(canary){const snapshot={document:{id:created.documentId,versionId:created.documentVersionId,sourceSha256:created.sourceSha256}};const hash=sha256SignatureValue(JSON.stringify(snapshot));const readinessId=randomUUID();const authorizationId=randomUUID();await db.query(`INSERT INTO signature_readiness_snapshots(id,environment,authorization_type,overall_status,participant_emails,document_types,locales,snapshot,snapshot_sha256,created_by_admin_id) VALUES($1,'production','internal_canary','pass',ARRAY['synthetic@example.test'],ARRAY['transaction_acknowledgment'],ARRAY['es-PR'],$2::jsonb,$3,$4)`,[readinessId,JSON.stringify(snapshot),hash,adminId]);await db.query(`INSERT INTO signature_launch_authorizations(id,environment,authorization_type,status,readiness_snapshot_sha256,explicit_confirmation,authorized_by_admin_id,authorized_at,expires_at,revoked_at,readiness_snapshot_id,authorized_participant_scope,authorized_participant_emails,authorized_document_types,authorized_locales,phase2o_legacy) VALUES($1,'production','internal_canary',$2,$3,true,$4,now()-interval '2 hours',$5::timestamptz,$6::timestamptz,$7,'[]',ARRAY['synthetic@example.test'],ARRAY['transaction_acknowledgment'],ARRAY['es-PR'],false)`,[authorizationId,active?"active":"revoked",hash,adminId,active?new Date(Date.now()+3600000).toISOString():new Date(Date.now()-3600000).toISOString(),active?null:new Date(Date.now()-3600000).toISOString(),readinessId]);}
  const storage=storageFor(created.sourceR2Key,created.bytes);storage.objects.set(finalKey,finalBytes);storage.objects.set(certificateKey,certificateBytes);
  return {...created,storage,finalKey,certificateKey,participantId:participant.participantId};
}

test("completed internal-canary records require strong lineage and are permanently cleaned without orphans",async()=>{
  const created=await completedFixture();const service=createSignatureDraftLifecycleService(database,created.storage,()=>new Date("2032-06-01"));
  const eligibility=await service.inspectDeletion(created.documentId);assert.equal(eligibility.eligible,true);assert.equal(eligibility.mode,"internal_test_record");
  await assert.rejects(service.deleteEligibleRecord({documentId:created.documentId,actorAdminId:adminId,reason:"Approved test cleanup",confirmationPhrase:"ELIMINAR BORRADOR"}),/confirmation/);
  await service.deleteEligibleRecord({documentId:created.documentId,actorAdminId:adminId,reason:"Approved test cleanup",confirmationPhrase:"ELIMINAR PRUEBA"});
  assert.equal(created.storage.objects.size,0);assert.equal((await db.query(`SELECT count(*)::int count FROM signature_documents WHERE id=$1`,[created.documentId])).rows[0].count,0);
  assert.equal((await db.query(`SELECT count(*)::int count FROM signature_events WHERE document_id=$1`,[created.documentId])).rows[0].count,0);
  assert.equal((await db.query(`SELECT count(*)::int count FROM signature_test_cleanup_events WHERE document_id=$1`,[created.documentId])).rows[0].count,1);
  await assert.rejects(db.query(`DELETE FROM signature_test_cleanup_events WHERE document_id=$1`,[created.documentId]),/immutable/);
});

test("ordinary completed records and canaries with active protection remain fail-closed",async()=>{
  const ordinary=await completedFixture({canary:false});const ordinaryService=createSignatureDraftLifecycleService(database,ordinary.storage);
  assert.equal((await ordinaryService.inspectDeletion(ordinary.documentId)).eligible,false);
  await assert.rejects(ordinaryService.deleteEligibleRecord({documentId:ordinary.documentId,actorAdminId:adminId,reason:"No",confirmationPhrase:"ELIMINAR PRUEBA"}),/lineage/);
  await db.exec(`TRUNCATE signature_test_cleanup_events,signature_events,signature_field_values,signature_sessions,signature_delivery_intents,signature_signing_tokens,signature_fields,signature_participants,signature_document_versions,signature_documents,signature_readiness_snapshots,signature_launch_authorizations,signature_consent_versions,signature_document_type_approvals CASCADE`);
  const protectedCanary=await completedFixture({active:true});
  const protectedService=createSignatureDraftLifecycleService(database,protectedCanary.storage);assert.equal((await protectedService.inspectDeletion(protectedCanary.documentId)).eligible,false);
});

test("legacy synthetic records without a canary authorization remain removable only without business linkage",async()=>{
  const created=await completedFixture({canary:false});
  await db.exec(`ALTER TABLE signature_documents DISABLE TRIGGER signature_documents_transition_trigger`);
  try {
    await db.query(`UPDATE signature_documents SET status='archived',completed_at=NULL,document_type_approval_reference=NULL,archived_at=now(),archived_by_admin_id=$2::uuid,archive_reason='Legacy synthetic cleanup test' WHERE id=$1`,[created.documentId,adminId]);
  } finally { await db.exec(`ALTER TABLE signature_documents ENABLE TRIGGER signature_documents_transition_trigger`); }
  const service=createSignatureDraftLifecycleService(database,created.storage);
  const eligibility=await service.inspectDeletion(created.documentId);
  assert.equal(eligibility.eligible,true);assert.equal(eligibility.mode,"internal_test_record");
  await service.deleteEligibleRecord({documentId:created.documentId,actorAdminId:adminId,reason:"Legacy test cleanup",confirmationPhrase:"ELIMINAR PRUEBA"});
  assert.equal((await db.query(`SELECT count(*)::int count FROM signature_documents WHERE id=$1`,[created.documentId])).rows[0].count,0);
  assert.equal((await db.query(`SELECT internal_canary_authorization_id FROM signature_test_cleanup_events WHERE document_id=$1`,[created.documentId])).rows[0].internal_canary_authorization_id,null);
});

test("an eligible legacy template source removes its private template snapshot with the test record",async()=>{
  const created=await completedFixture({canary:false});
  const template=(await db.query(`INSERT INTO signature_templates(name,document_type,source_document_version_id,snapshot_sha256,created_by_admin_id) VALUES('Synthetic legacy template','transaction_acknowledgment',$1,$2,$3) RETURNING id::text`,[created.documentVersionId,"a".repeat(64),adminId])).rows[0];
  await db.exec(`ALTER TABLE signature_documents DISABLE TRIGGER signature_documents_transition_trigger`);
  try {
    await db.query(`UPDATE signature_documents SET status='archived',completed_at=NULL,document_type_approval_reference=NULL,archived_at=now(),archived_by_admin_id=$2::uuid,archive_reason='Legacy template cleanup test' WHERE id=$1`,[created.documentId,adminId]);
  } finally { await db.exec(`ALTER TABLE signature_documents ENABLE TRIGGER signature_documents_transition_trigger`); }
  const service=createSignatureDraftLifecycleService(database,created.storage);
  assert.equal((await service.inspectDeletion(created.documentId)).eligible,true);
  await service.deleteEligibleRecord({documentId:created.documentId,actorAdminId:adminId,reason:"Legacy template cleanup",confirmationPhrase:"ELIMINAR PRUEBA"});
  assert.equal((await db.query(`SELECT count(*)::int count FROM signature_templates WHERE id=$1`,[template.id])).rows[0].count,0);
});

test("synthetic cleanup eligibility is evaluated by safety state, not the lifecycle tab",async()=>{
  const created=await completedFixture();const service=createSignatureDraftLifecycleService(database,created.storage);
  await db.exec(`ALTER TABLE signature_documents DISABLE TRIGGER signature_documents_transition_trigger`);
  try {
    for(const status of ["draft","sent","viewed","partially_signed","completed","voided","expired","archived"]){
      await db.query(`UPDATE signature_documents SET status=$2,completed_at=CASE WHEN $2='completed' THEN now() ELSE NULL END,voided_at=CASE WHEN $2='voided' THEN now() ELSE NULL END,void_reason=CASE WHEN $2='voided' THEN 'Synthetic terminal-state test' ELSE NULL END,archived_at=CASE WHEN $2='archived' THEN now() ELSE NULL END,archived_by_admin_id=CASE WHEN $2='archived' THEN $3::uuid ELSE NULL END,archive_reason=CASE WHEN $2='archived' THEN 'Synthetic terminal-state test' ELSE NULL END WHERE id=$1`,[created.documentId,status,adminId]);
      const eligibility=await service.inspectDeletion(created.documentId);
      assert.equal(eligibility.eligible,true,status);
      assert.equal(eligibility.mode,"internal_test_record",status);
    }
  } finally { await db.exec(`ALTER TABLE signature_documents ENABLE TRIGGER signature_documents_transition_trigger`); }
});

test("artifact cleanup failure restores prior objects and leaves database evidence untouched",async()=>{
  const created=await completedFixture();const failingStorage={...created.storage,async deleteFinalIfExact(){return false;}};
  const service=createSignatureDraftLifecycleService(database,failingStorage);
  await assert.rejects(service.deleteEligibleRecord({documentId:created.documentId,actorAdminId:adminId,reason:"Compensation test",confirmationPhrase:"ELIMINAR PRUEBA"}),/final_delete_failed/);
  assert.equal(created.storage.objects.size,3);
  assert.equal((await db.query(`SELECT count(*)::int count FROM signature_documents WHERE id=$1`,[created.documentId])).rows[0].count,1);
  assert.equal((await db.query(`SELECT count(*)::int count FROM signature_test_cleanup_events WHERE document_id=$1`,[created.documentId])).rows[0].count,0);
});

test("active access and legal holds independently deny permanent test cleanup",async()=>{
  const activeAccess=await completedFixture();await db.query(`INSERT INTO signature_signing_tokens(participant_id,document_version_id,token_digest,purpose,key_version,issued_at,expires_at) VALUES($1,$2,$3,'sign_document',1,now(),now()+interval '1 hour')`,[activeAccess.participantId,activeAccess.documentVersionId,"9".repeat(64)]);
  assert.ok((await createSignatureDraftLifecycleService(database,activeAccess.storage).inspectDeletion(activeAccess.documentId)).reasons.includes("usable_tokens_exist"));
  await db.exec(`TRUNCATE signature_test_cleanup_events,signature_legal_holds,signature_events,signature_field_values,signature_sessions,signature_delivery_intents,signature_signing_tokens,signature_fields,signature_participants,signature_document_versions,signature_documents,signature_readiness_snapshots,signature_launch_authorizations,signature_consent_versions,signature_document_type_approvals CASCADE`);
  const held=await completedFixture();await db.query(`INSERT INTO signature_legal_holds(scope_type,document_id,evidence_classes,reason_reference,status,created_by_admin_id) VALUES('document',$1,ARRAY[]::text[],'Synthetic legal-hold test','active',$2)`,[held.documentId,adminId]);
  assert.ok((await createSignatureDraftLifecycleService(database,held.storage).inspectDeletion(held.documentId)).reasons.includes("legal_hold_exists"));
});
