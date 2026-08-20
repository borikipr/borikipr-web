import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { createSignatureAdminRepository } from "../../lib/signatures/admin-repository";
import { createSignatureDraftApplicationService } from "../../lib/signatures/draft-application";
import { createPostgresSignatureDatabase } from "../../lib/signatures/domain/database";
import { createConfiguredSignatureDomainServices } from "../../lib/signatures/config";
import { createSignatureDraftLifecycleService } from "../../lib/signatures/draft-lifecycle";
import { GOVERNANCE_APPROVAL_PHRASE, RETENTION_ACTIVATION_PHRASE } from "../../lib/signatures/governance-constants";
import { createSignatureGovernanceWorkflow } from "../../lib/signatures/governance-workflow";
import { buildTemplateBlueprint, BROKER_SETTINGS_CONFIRMATION, createSignatureProductRepository } from "../../lib/signatures/productization";
import { createPrivateSignatureStorage } from "../../lib/signatures/storage";

type RoleSpec=Readonly<{key:string;role:string;order:number;optional?:boolean}>;
type FieldSpec=Readonly<{roleKey:string;type:"signature"|"initials"|"date"|"date_signed"|"text";page:number;
  x:number;y:number;width:number;height:number;label:string;required?:boolean;maxLength?:number}>;
type TemplateSpec=Readonly<{name:string;description:string;documentType:string;path:string;routingMode:"parallel"|"sequential"|"grouped";
  requiresBrokerSignature:boolean;roles:readonly RoleSpec[];fields:readonly FieldSpec[]}>;

const required=(name:string)=>{const value=process.env[name]?.normalize("NFC").trim();if(!value)throw new Error(`missing_${name}`);return value;};
const normalizeEmail=(value:string)=>value.normalize("NFC").trim().toLowerCase();
const point=(pageWidth:number,pageHeight:number,value:{x:number;y:number;width:number;height:number})=>({
  x:value.x/pageWidth,y:value.y/pageHeight,width:value.width/pageWidth,height:value.height/pageHeight,
});

const offer:TemplateSpec={name:"Hoja de Oferta",description:"Oferta ordinaria de compraventa para el flujo pre-cierre de Erickson Real Estate.",
  documentType:"ordinary_offer_or_contract",path:required("PHASE3B_OFFER_PDF"),routingMode:"grouped",requiresBrokerSignature:true,
  roles:[{key:"buyer-1",role:"Comprador 1",order:1},{key:"buyer-2",role:"Comprador 2",order:1,optional:true},
    {key:"seller-1",role:"Vendedor 1",order:1,optional:true},{key:"seller-2",role:"Vendedor 2",order:1,optional:true}],
  fields:[
    {roleKey:"buyer-1",type:"text",page:0,x:79,y:207,width:450,height:22,label:"Propiedad o dirección",required:true,maxLength:180},
    {roleKey:"buyer-1",type:"text",page:0,x:335,y:249,width:198,height:22,label:"Importe de la oferta",required:true,maxLength:80},
    {roleKey:"buyer-1",type:"text",page:0,x:404,y:277,width:28,height:22,label:"Marca X si Efectivo",required:true,maxLength:1},
    {roleKey:"buyer-1",type:"text",page:0,x:164,y:361,width:366,height:24,label:"Otros términos",required:true,maxLength:180},
    {roleKey:"buyer-1",type:"signature",page:0,x:79,y:512,width:150,height:30,label:"Firma Comprador 1",required:true},
    {roleKey:"buyer-1",type:"date_signed",page:0,x:236,y:512,width:60,height:30,label:"Fecha de firma Comprador 1",required:true},
    {roleKey:"buyer-1",type:"text",page:0,x:79,y:646,width:204,height:28,label:"Agente comprador",maxLength:100},
    {roleKey:"buyer-2",type:"signature",page:0,x:79,y:578,width:150,height:30,label:"Firma Comprador 2",required:true},
    {roleKey:"buyer-2",type:"date_signed",page:0,x:236,y:578,width:60,height:30,label:"Fecha de firma Comprador 2",required:true},
    {roleKey:"seller-1",type:"signature",page:0,x:318,y:512,width:150,height:30,label:"Firma Vendedor 1",required:true},
    {roleKey:"seller-1",type:"date_signed",page:0,x:473,y:512,width:60,height:30,label:"Fecha de firma Vendedor 1",required:true},
    {roleKey:"seller-2",type:"signature",page:0,x:318,y:578,width:150,height:30,label:"Firma Vendedor 2",required:true},
    {roleKey:"seller-2",type:"date_signed",page:0,x:473,y:578,width:60,height:30,label:"Fecha de firma Vendedor 2",required:true},
    {roleKey:"broker",type:"signature",page:0,x:329,y:644,width:204,height:32,label:"Corredora · Firma final — Agente Listador",required:true},
  ]};

const buyerInfoFields=(key:string,offset:number):FieldSpec[]=>[
  {roleKey:key,type:"text",page:0,x:125,y:177+offset,width:210,height:25,label:`Nombre ${key}`,required:true,maxLength:120},
  {roleKey:key,type:"text",page:0,x:447,y:177+offset,width:85,height:25,label:`Licencia de conducir ${key}`,required:true,maxLength:40},
  {roleKey:key,type:"text",page:0,x:145,y:205+offset,width:228,height:25,label:`Estado civil ${key}`,required:true,maxLength:30},
  {roleKey:key,type:"text",page:0,x:129,y:233+offset,width:114,height:24,label:`Teléfono ${key}`,required:true,maxLength:30},
  {roleKey:key,type:"text",page:0,x:344,y:233+offset,width:188,height:24,label:`Correo electrónico ${key}`,required:true,maxLength:120},
  {roleKey:key,type:"text",page:0,x:123,y:260+offset,width:162,height:25,label:`Patrono ${key}`,required:true,maxLength:100},
  {roleKey:key,type:"text",page:0,x:346,y:260+offset,width:186,height:25,label:`Ocupación ${key}`,required:true,maxLength:100},
  {roleKey:key,type:"text",page:0,x:167,y:288+offset,width:366,height:25,label:`Dirección actual ${key}`,required:true,maxLength:180},
];
const buyerInfo:TemplateSpec={name:"Hoja Informativa de los Compradores",description:"Información y autorización de compradores para el flujo privado de corretaje.",
  documentType:"transaction_acknowledgment",path:required("PHASE3B_BUYER_INFO_PDF"),routingMode:"parallel",requiresBrokerSignature:false,
  roles:[{key:"buyer-1",role:"Comprador 1",order:1},{key:"buyer-2",role:"Comprador 2",order:1,optional:true}],fields:[
    ...buyerInfoFields("buyer-1",0),...buyerInfoFields("buyer-2",182),
    {roleKey:"buyer-1",type:"text",page:0,x:79,y:497,width:450,height:25,label:"Dirección de la propiedad para comprar",required:true,maxLength:180},
    {roleKey:"buyer-1",type:"text",page:0,x:395,y:539,width:131,height:24,label:"Financiamiento — Sí o No",required:true,maxLength:3},
    {roleKey:"buyer-1",type:"text",page:0,x:189,y:566,width:162,height:25,label:"Institución financiera",maxLength:120},
    {roleKey:"buyer-1",type:"text",page:0,x:401,y:566,width:132,height:25,label:"Sucursal",maxLength:80},
    {roleKey:"buyer-1",type:"text",page:0,x:138,y:594,width:222,height:25,label:"Originador",maxLength:120},
    {roleKey:"buyer-1",type:"text",page:0,x:129,y:622,width:114,height:24,label:"Teléfono del originador",maxLength:30},
    {roleKey:"buyer-1",type:"text",page:0,x:344,y:622,width:188,height:24,label:"Correo del originador",maxLength:120},
    {roleKey:"buyer-1",type:"signature",page:0,x:79,y:702,width:204,height:32,label:"Firma de autorización Comprador 1",required:true},
    {roleKey:"buyer-2",type:"signature",page:0,x:329,y:702,width:204,height:32,label:"Firma de autorización Comprador 2",required:true},
  ]};

const contract:TemplateSpec={name:"Contrato de Opción de Compraventa",description:"Contrato ordinario de opción de compraventa para preparación y firma de las partes.",
  documentType:"ordinary_offer_or_contract",path:required("PHASE3B_OPTION_PDF"),routingMode:"grouped",requiresBrokerSignature:false,
  roles:[{key:"seller-1",role:"Vendedor 1",order:1},{key:"seller-2",role:"Vendedor 2",order:1,optional:true},
    {key:"buyer-1",role:"Comprador 1",order:1},{key:"buyer-2",role:"Comprador 2",order:1,optional:true}],fields:[
    {roleKey:"buyer-1",type:"text",page:0,x:185,y:139,width:107,height:26,label:"Ciudad",required:true,maxLength:80},
    {roleKey:"buyer-1",type:"text",page:0,x:430,y:139,width:28,height:26,label:"Día",required:true,maxLength:2},
    {roleKey:"buyer-1",type:"text",page:0,x:505,y:139,width:82,height:26,label:"Mes",required:true,maxLength:20},
    {roleKey:"buyer-1",type:"text",page:0,x:82,y:157,width:70,height:25,label:"Año",required:true,maxLength:4},
    {roleKey:"seller-1",type:"text",page:0,x:250,y:182,width:283,height:48,label:"Parte vendedora",required:true,maxLength:220},
    {roleKey:"buyer-1",type:"text",page:0,x:248,y:237,width:284,height:48,label:"Parte compradora",required:true,maxLength:220},
    {roleKey:"seller-1",type:"text",page:0,x:82,y:389,width:450,height:68,label:"Descripción de la propiedad",required:true,maxLength:300},
    {roleKey:"seller-1",type:"text",page:0,x:182,y:458,width:350,height:27,label:"Número de catastro",required:true,maxLength:100},
    {roleKey:"buyer-1",type:"text",page:0,x:82,y:568,width:370,height:27,label:"Precio en palabras",required:true,maxLength:180},
    {roleKey:"buyer-1",type:"text",page:0,x:470,y:568,width:62,height:27,label:"Precio numérico",required:true,maxLength:30},
    {roleKey:"buyer-1",type:"text",page:0,x:225,y:584,width:190,height:27,label:"Método — financiado o efectivo",required:true,maxLength:20},
    {roleKey:"buyer-1",type:"text",page:0,x:300,y:624,width:232,height:27,label:"Término de la opción",required:true,maxLength:100},
    {roleKey:"buyer-1",type:"text",page:0,x:82,y:639,width:90,height:27,label:"Días calendario",required:true,maxLength:10},
    {roleKey:"buyer-1",type:"text",page:0,x:377,y:747,width:154,height:27,label:"Entrega de la propiedad",required:true,maxLength:80},
    {roleKey:"seller-1",type:"text",page:0,x:340,y:886,width:192,height:48,label:"Muebles o enseres incluidos",maxLength:220},
    {roleKey:"buyer-1",type:"initials",page:0,x:397,y:935,width:32,height:24,label:"Iniciales Comprador 1 — página 1",required:true},
    {roleKey:"buyer-2",type:"initials",page:0,x:433,y:935,width:32,height:24,label:"Iniciales Comprador 2 — página 1",required:true},
    {roleKey:"seller-1",type:"initials",page:0,x:469,y:935,width:32,height:24,label:"Iniciales Vendedor 1 — página 1",required:true},
    {roleKey:"seller-2",type:"initials",page:0,x:505,y:935,width:32,height:24,label:"Iniciales Vendedor 2 — página 1",required:true},
    {roleKey:"buyer-1",type:"text",page:1,x:248,y:161,width:286,height:27,label:"Depósito de opción en palabras",required:true,maxLength:180},
    {roleKey:"buyer-1",type:"text",page:1,x:456,y:161,width:77,height:27,label:"Depósito numérico",required:true,maxLength:30},
    {roleKey:"buyer-1",type:"text",page:1,x:79,y:630,width:62,height:26,label:"Inspección física — Sí o No",required:true,maxLength:3},
    {roleKey:"buyer-1",type:"text",page:1,x:79,y:658,width:62,height:26,label:"Inspección de plomo — Sí o No",required:true,maxLength:3},
    {roleKey:"buyer-1",type:"text",page:1,x:190,y:685,width:343,height:54,label:"Acuerdos adicionales",maxLength:250},
    {roleKey:"seller-1",type:"signature",page:1,x:79,y:862,width:204,height:32,label:"Firma Vendedor 1",required:true},
    {roleKey:"buyer-1",type:"signature",page:1,x:329,y:862,width:204,height:32,label:"Firma Comprador 1",required:true},
    {roleKey:"seller-2",type:"signature",page:1,x:79,y:905,width:204,height:32,label:"Firma Vendedor 2",required:true},
    {roleKey:"buyer-2",type:"signature",page:1,x:329,y:905,width:204,height:32,label:"Firma Comprador 2",required:true},
    {roleKey:"buyer-1",type:"initials",page:1,x:397,y:935,width:32,height:24,label:"Iniciales Comprador 1 — página 2",required:true},
    {roleKey:"buyer-2",type:"initials",page:1,x:433,y:935,width:32,height:24,label:"Iniciales Comprador 2 — página 2",required:true},
    {roleKey:"seller-1",type:"initials",page:1,x:469,y:935,width:32,height:24,label:"Iniciales Vendedor 1 — página 2",required:true},
    {roleKey:"seller-2",type:"initials",page:1,x:505,y:935,width:32,height:24,label:"Iniciales Vendedor 2 — página 2",required:true},
  ]};

async function main(){
  const apply=process.argv.includes("--apply");const connection=required("DATABASE_URL");
  const cedricEmail=normalizeEmail(required("PHASE3B_CEDRIC_EMAIL"));const ivonneEmail=normalizeEmail(required("PHASE3B_IVONNE_EMAIL"));
  const consent=required("PHASE3B_CONSENT_ES_PR");const privacyEs=required("PHASE3B_PRIVACY_ES_PR");const privacyEn=required("PHASE3B_PRIVACY_EN_US");
  const client=postgres(connection,{max:1});const database=createPostgresSignatureDatabase(client);
  try{
    const admins=await database.unsafe<{id:string;email:string;display_name:string|null;username:string}>(`SELECT id::text,lower(email) email,display_name,username FROM admin_users WHERE activo=true AND lower(email)=ANY($1::text[])`,[[cedricEmail,ivonneEmail]]);
    if(admins.length!==2)throw new Error("phase3b_admin_identity_mismatch");
    const cedric=admins.find((row)=>row.email===cedricEmail)!;const ivonne=admins.find((row)=>row.email===ivonneEmail)!;
    const [leadMatch]=await database.unsafe<{count:number}>(`SELECT count(*)::integer count FROM leads WHERE email_normalized=ANY($1::text[]) AND status<>'merged'`,[[cedricEmail,ivonneEmail]]);
    if((leadMatch?.count??0)>0)throw new Error("phase3b_customer_identity_detected");
    const existingTemplates=await database.unsafe<{name:string}>(`SELECT name FROM signature_templates WHERE status='active' AND name=ANY($1::text[])`,[[offer.name,buyerInfo.name,contract.name]]);
    console.log(JSON.stringify({mode:apply?"apply":"dry-run",admins:admins.map((row)=>row.display_name||row.username),leadMatches:0,
      existingTemplates:existingTemplates.map((row)=>row.name),plannedTemplates:[offer,buyerInfo,contract].map((item)=>({name:item.name,roles:item.roles.length,fields:item.fields.length,broker:item.requiresBrokerSignature}))}));
    if(!apply)return;

    const workflow=createSignatureGovernanceWorkflow(database);const effectiveFrom=new Date("2026-08-13T04:00:00.000Z");
    for(const item of [{documentType:"ordinary_offer_or_contract",displayName:"Ofertas y contratos ordinarios de compraventa — flujo pre-cierre"},
      {documentType:"transaction_acknowledgment",displayName:"Formularios informativos, autorizaciones y acuses de transacción"}]){
      const [approved]=await database.unsafe<{id:string}>(`SELECT id::text FROM signature_document_type_approvals WHERE document_type=$1 AND status='approved' AND approval_reference='ERE-SIGN-INITIAL-APPROVAL-2026-08-13'`,[item.documentType]);
      if(!approved){const draft=await workflow.createClassificationDraft({documentType:item.documentType,displayName:item.displayName,
        description:"Documento operacional ordinario de corretaje utilizado por Erickson Real Estate antes del cierre.",
        permittedSigningUse:"Uso en el flujo de corretaje. Excluye escrituras, instrumentos notariales y documentos de cierre que requieran formalidades externas.",actorAdminId:ivonne.id});
        await workflow.submitClassification({id:draft.id,actorAdminId:ivonne.id});await workflow.approveClassification({id:draft.id,approvalMode:"internal_business",
          approvalReference:"ERE-SIGN-INITIAL-APPROVAL-2026-08-13",approverRole:"Corredora principal",approvalDate:"2026-08-13",effectiveFrom,
          notes:"Aprobación operacional interna; no constituye asesoría legal ni autorización de instrumentos notariales o de cierre.",actorAdminId:ivonne.id,
          confirmationPhrase:GOVERNANCE_APPROVAL_PHRASE,immutableAcknowledged:true});}
    }
    const [existingConsent]=await database.unsafe<{id:string}>(`SELECT id::text FROM signature_consent_versions WHERE version_identifier='ere-sign-consent-espr-2026-08-13-v1'`);
    if(!existingConsent){const draft=await workflow.createConsentDraft({versionIdentifier:"ere-sign-consent-espr-2026-08-13-v1",locale:"es-PR",text:consent,actorAdminId:ivonne.id});
      await workflow.submitConsent({id:draft.id,actorAdminId:ivonne.id});await workflow.approveConsent({id:draft.id,approvalMode:"internal_business",approvalReference:"ERE-SIGN-CONSENT-ESPR-2026-08-13",approverRole:"Corredora principal",effectiveFrom,actorAdminId:ivonne.id,confirmationPhrase:GOVERNANCE_APPROVAL_PHRASE,immutableAcknowledged:true});}
    const [existingPrivacy]=await database.unsafe<{id:string}>(`SELECT id::text FROM signature_privacy_disclosure_versions WHERE version_identifier='ere-sign-privacy-2026-08-13-v1'`);
    if(!existingPrivacy){const draft=await workflow.createPrivacyDraft({versionIdentifier:"ere-sign-privacy-2026-08-13-v1",esPRText:privacyEs,enUSText:privacyEn,actorAdminId:ivonne.id});
      await workflow.submitPrivacy({id:draft.id,actorAdminId:ivonne.id});await workflow.approvePrivacy({id:draft.id,approvalMode:"internal_business",approvalReference:"ERE-SIGN-PRIVACY-2026-08-13",approverRole:"Corredora principal",effectiveFrom,actorAdminId:ivonne.id,confirmationPhrase:GOVERNANCE_APPROVAL_PHRASE,immutableAcknowledged:true});}
    const [existingRetention]=await database.unsafe<{id:string;status:string}>(`SELECT id::text,status FROM signature_retention_policy_versions WHERE version_identifier='ere-sign-retention-canary-2026-08-13-v1'`);
    if(!existingRetention){const policy={version:"ere-sign-retention-canary-2026-08-13-v1",approvalReference:"ERE-SIGN-RETENTION-CANARY-2026-08-13",privacyReference:"ERE-SIGN-PRIVACY-2026-08-13",sourcePdfDays:365,completedPdfDays:null,certificateDays:null,evidenceManifestDays:null,tokenDays:30,sessionHours:24,networkEvidenceDays:90,failedCancelledDraftDays:90,auditEventDays:null,completedCleanupEnabled:false};
      const draft=await workflow.createRetentionDraft({versionIdentifier:policy.version,privacyReference:policy.privacyReference,policy,actorAdminId:ivonne.id});await workflow.submitRetention({id:draft.id,actorAdminId:ivonne.id});
      await workflow.approveRetention({id:draft.id,approvalMode:"internal_business",approvalReference:policy.approvalReference,approverRole:"Corredora principal",actorAdminId:ivonne.id,confirmationPhrase:GOVERNANCE_APPROVAL_PHRASE,immutableAcknowledged:true});
      await workflow.activateRetention({id:draft.id,actorAdminId:ivonne.id,confirmationPhrase:RETENTION_ACTIVATION_PHRASE,immutableAcknowledged:true});
    }else if(existingRetention.status!=="active")throw new Error("phase3b_retention_partial_state_requires_review");

    const storage=createPrivateSignatureStorage();const domain=createConfiguredSignatureDomainServices(database);
    const drafts=createSignatureDraftApplicationService({domain,database,storage});const product=createSignatureProductRepository(database);
    await product.saveBrokerSettings({brokerAdminUserId:ivonne.id,actorAdminId:cedric.id,confirmationPhrase:BROKER_SETTINGS_CONFIRMATION});
    const lifecycle=createSignatureDraftLifecycleService(database,storage);const repository=createSignatureAdminRepository(database);
    for(const spec of [offer,buyerInfo,contract]){
      const [existing]=await database.unsafe<{id:string}>(`SELECT id::text FROM signature_templates WHERE name=$1 AND status='active'`,[spec.name]);if(existing)continue;
      const bytes=new Uint8Array(await readFile(spec.path));const created=await drafts.createDraft({title:`PLANTILLA FUENTE — ${spec.name}`,documentType:spec.documentType,
        createdByAdminId:cedric.id,expiresAt:new Date("2036-08-13T04:00:00.000Z"),filename:spec.path.split(/[\\/]/).pop()!,mimeType:"application/pdf",bytes,
        routingMode:spec.routingMode,requiresBrokerSignature:spec.requiresBrokerSignature});
      const participantByKey=new Map<string,string>();const optionalIds=new Set<string>();
      for(const role of spec.roles){const added=await domain.addParticipant({documentVersionId:created.documentVersionId,nameSnapshot:`Rol de plantilla — ${role.role}`,
        emailSnapshot:`${role.key}.${spec.documentType}@example.invalid`,role:role.role,routingOrder:role.order,actorAdminId:cedric.id,idempotencyKey:randomUUID()});participantByKey.set(role.key,added.participantId);if(role.optional)optionalIds.add(added.participantId);}
      let detail=await repository.detail(created.documentId);const broker=detail?.participants.find((item)=>item.isBrokerFinalSigner);if(spec.requiresBrokerSignature&&broker){participantByKey.set("broker",broker.id);
        const finalOrder=Math.max(...spec.roles.map((role)=>role.order))+1;if(broker.routingOrder!==finalOrder)await domain.updateParticipant({participantId:broker.id,nameSnapshot:broker.name,emailSnapshot:broker.email,role:broker.role,routingOrder:finalOrder,actorAdminId:cedric.id,idempotencyKey:randomUUID()});}
      detail=await repository.detail(created.documentId);if(!detail)throw new Error("phase3b_template_source_missing");let tabOrder=1;
      for(const field of spec.fields){const participantId=participantByKey.get(field.roleKey);if(!participantId)throw new Error(`phase3b_role_missing_${field.roleKey}`);const geometry=detail.version.pageGeometry[field.page];if(!geometry)throw new Error("phase3b_page_geometry_missing");
        const rect=point(Number(geometry.cropBox.width),Number(geometry.cropBox.height),field);await domain.addField({documentVersionId:created.documentVersionId,participantId,fieldType:field.type,pageIndex:field.page,
          rect,pageGeometryReference:geometry,label:field.label,required:field.required??false,tabOrder:tabOrder++,validationLimits:field.type==="text"?{maxLength:field.maxLength??120}:{},actorAdminId:cedric.id,idempotencyKey:randomUUID()});}
      detail=await repository.detail(created.documentId);if(!detail)throw new Error("phase3b_template_detail_missing");const blueprint=buildTemplateBlueprint(detail,{optionalParticipantIds:optionalIds});
      await product.createTemplate({name:spec.name,description:spec.description,documentType:spec.documentType,locale:"es-PR",routingMode:spec.routingMode,
        requiresBrokerSignature:spec.requiresBrokerSignature,sourceDocumentVersionId:created.documentVersionId,roles:blueprint.roles,fields:blueprint.fields,actorAdminId:cedric.id});
      await lifecycle.archiveDraft({documentId:created.documentId,actorAdminId:cedric.id,reason:"Fuente privada preservada para la plantilla inicial aprobada de Borikí Sign.",idempotencyKey:randomUUID()});
    }
    const counts=await database.unsafe<{templates:number;settings:number;approvals:number;consents:number;privacy:number;retention:number}>(`SELECT
      (SELECT count(*)::int FROM signature_templates WHERE status='active') templates,(SELECT count(*)::int FROM signature_signing_settings WHERE broker_admin_user_id IS NOT NULL) settings,
      (SELECT count(*)::int FROM signature_document_type_approvals WHERE status='approved') approvals,(SELECT count(*)::int FROM signature_consent_versions WHERE status='approved') consents,
      (SELECT count(*)::int FROM signature_privacy_disclosure_versions WHERE status='approved') privacy,(SELECT count(*)::int FROM signature_retention_policy_versions WHERE status='active') retention`);
    console.log(JSON.stringify({applied:true,...counts[0]}));
  }finally{await client.end();}
}

main().catch((error)=>{console.error(error instanceof Error?error.message:"phase3b_configuration_failed");process.exitCode=1;});
