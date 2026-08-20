import { randomUUID } from "node:crypto";
import { createSignatureAdminRepository } from "./admin-repository";
import { createSignatureDraftRuntime } from "./runtime";
import { buildTemplateBlueprint, createSignatureProductRepository } from "./productization";
import { createSignatureDraftLifecycleService } from "./draft-lifecycle";

type RoleSpec={key:string;role:string;order:number;optional?:boolean};
type FieldSpec={roleKey:string;type:"signature"|"initials"|"date"|"date_signed"|"text";page:number;x:number;y:number;width:number;height:number;label:string;required?:boolean;maxLength?:number};
type Spec={documentId:string;title:string;name:string;description:string;documentType:string;routingMode:"parallel"|"sequential"|"grouped";requiresBroker:boolean;roles:RoleSpec[];fields:FieldSpec[]};

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

function specs(ids:{offer:string;buyerInfo:string;option:string}):Spec[]{return [
  {documentId:ids.offer,title:"PLANTILLA FUENTE — Hoja de Oferta",name:"Hoja de Oferta",description:"Oferta ordinaria de compraventa para el flujo pre-cierre de Erickson Real Estate.",documentType:"ordinary_offer_or_contract",routingMode:"grouped",requiresBroker:true,
   roles:[{key:"buyer-1",role:"Comprador 1",order:1},{key:"buyer-2",role:"Comprador 2",order:1,optional:true},{key:"seller-1",role:"Vendedor 1",order:1,optional:true},{key:"seller-2",role:"Vendedor 2",order:1,optional:true}],fields:[
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
  ]},
  {documentId:ids.buyerInfo,title:"PLANTILLA FUENTE — Hoja Informativa de los Compradores",name:"Hoja Informativa de los Compradores",description:"Información y autorización de compradores para el flujo privado de corretaje.",documentType:"transaction_acknowledgment",routingMode:"parallel",requiresBroker:false,
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
  ]},
  {documentId:ids.option,title:"PLANTILLA FUENTE — Contrato de Opción de Compraventa",name:"Contrato de Opción de Compraventa",description:"Contrato ordinario de opción de compraventa para preparación y firma de las partes.",documentType:"ordinary_offer_or_contract",routingMode:"grouped",requiresBroker:false,
   roles:[{key:"seller-1",role:"Vendedor 1",order:1},{key:"seller-2",role:"Vendedor 2",order:1,optional:true},{key:"buyer-1",role:"Comprador 1",order:1},{key:"buyer-2",role:"Comprador 2",order:1,optional:true}],fields:[
    {roleKey:"buyer-1",type:"text",page:0,x:185,y:139,width:107,height:26,label:"Ciudad",required:true,maxLength:80},{roleKey:"buyer-1",type:"text",page:0,x:430,y:139,width:28,height:26,label:"Día",required:true,maxLength:2},{roleKey:"buyer-1",type:"text",page:0,x:505,y:139,width:82,height:26,label:"Mes",required:true,maxLength:20},{roleKey:"buyer-1",type:"text",page:0,x:82,y:157,width:70,height:25,label:"Año",required:true,maxLength:4},
    {roleKey:"seller-1",type:"text",page:0,x:250,y:182,width:283,height:48,label:"Parte vendedora",required:true,maxLength:220},{roleKey:"buyer-1",type:"text",page:0,x:248,y:237,width:284,height:48,label:"Parte compradora",required:true,maxLength:220},{roleKey:"seller-1",type:"text",page:0,x:82,y:389,width:450,height:68,label:"Descripción de la propiedad",required:true,maxLength:300},{roleKey:"seller-1",type:"text",page:0,x:182,y:458,width:350,height:27,label:"Número de catastro",required:true,maxLength:100},
    {roleKey:"buyer-1",type:"text",page:0,x:82,y:568,width:370,height:27,label:"Precio en palabras",required:true,maxLength:180},{roleKey:"buyer-1",type:"text",page:0,x:470,y:568,width:62,height:27,label:"Precio numérico",required:true,maxLength:30},{roleKey:"buyer-1",type:"text",page:0,x:225,y:584,width:190,height:27,label:"Método — financiado o efectivo",required:true,maxLength:20},{roleKey:"buyer-1",type:"text",page:0,x:300,y:624,width:232,height:27,label:"Término de la opción",required:true,maxLength:100},{roleKey:"buyer-1",type:"text",page:0,x:82,y:639,width:90,height:27,label:"Días calendario",required:true,maxLength:10},{roleKey:"buyer-1",type:"text",page:0,x:377,y:747,width:154,height:27,label:"Entrega de la propiedad",required:true,maxLength:80},{roleKey:"seller-1",type:"text",page:0,x:340,y:886,width:192,height:48,label:"Muebles o enseres incluidos",maxLength:220},
    {roleKey:"buyer-1",type:"initials",page:0,x:397,y:935,width:32,height:24,label:"Iniciales Comprador 1 — página 1",required:true},{roleKey:"buyer-2",type:"initials",page:0,x:433,y:935,width:32,height:24,label:"Iniciales Comprador 2 — página 1",required:true},{roleKey:"seller-1",type:"initials",page:0,x:469,y:935,width:32,height:24,label:"Iniciales Vendedor 1 — página 1",required:true},{roleKey:"seller-2",type:"initials",page:0,x:505,y:935,width:32,height:24,label:"Iniciales Vendedor 2 — página 1",required:true},
    {roleKey:"buyer-1",type:"text",page:1,x:248,y:161,width:286,height:27,label:"Depósito de opción en palabras",required:true,maxLength:180},{roleKey:"buyer-1",type:"text",page:1,x:456,y:161,width:77,height:27,label:"Depósito numérico",required:true,maxLength:30},{roleKey:"buyer-1",type:"text",page:1,x:79,y:630,width:62,height:26,label:"Inspección física — Sí o No",required:true,maxLength:3},{roleKey:"buyer-1",type:"text",page:1,x:79,y:658,width:62,height:26,label:"Inspección de plomo — Sí o No",required:true,maxLength:3},{roleKey:"buyer-1",type:"text",page:1,x:190,y:685,width:343,height:54,label:"Acuerdos adicionales",maxLength:250},
    {roleKey:"seller-1",type:"signature",page:1,x:79,y:862,width:204,height:32,label:"Firma Vendedor 1",required:true},{roleKey:"buyer-1",type:"signature",page:1,x:329,y:862,width:204,height:32,label:"Firma Comprador 1",required:true},{roleKey:"seller-2",type:"signature",page:1,x:79,y:905,width:204,height:32,label:"Firma Vendedor 2",required:true},{roleKey:"buyer-2",type:"signature",page:1,x:329,y:905,width:204,height:32,label:"Firma Comprador 2",required:true},
    {roleKey:"buyer-1",type:"initials",page:1,x:397,y:935,width:32,height:24,label:"Iniciales Comprador 1 — página 2",required:true},{roleKey:"buyer-2",type:"initials",page:1,x:433,y:935,width:32,height:24,label:"Iniciales Comprador 2 — página 2",required:true},{roleKey:"seller-1",type:"initials",page:1,x:469,y:935,width:32,height:24,label:"Iniciales Vendedor 1 — página 2",required:true},{roleKey:"seller-2",type:"initials",page:1,x:505,y:935,width:32,height:24,label:"Iniciales Vendedor 2 — página 2",required:true},
  ]},
]}

export async function bootstrapPhase3BTemplates(input:{offer:string;buyerInfo:string;option:string;actorAdminId:string}){
  const runtime=createSignatureDraftRuntime();const repository=createSignatureAdminRepository(runtime.database);const product=createSignatureProductRepository(runtime.database);const lifecycle=createSignatureDraftLifecycleService(runtime.database,runtime.storage);
  for(const spec of specs(input)){
    const [existing]=await runtime.database.unsafe<{id:string}>(`SELECT id::text FROM signature_templates WHERE name=$1 AND status='active'`,[spec.name]);if(existing)continue;
    let detail=await repository.detail(spec.documentId);if(!detail||detail.status!=="draft"||detail.title!==spec.title||detail.documentType!==spec.documentType)throw new Error("phase3b_source_mismatch");
    for(const field of detail.fields)await runtime.domain.removeField({fieldId:field.id,actorAdminId:input.actorAdminId,idempotencyKey:randomUUID()});
    const sourceDetail=await repository.detail(spec.documentId);if(!sourceDetail)throw new Error("phase3b_source_missing");detail=sourceDetail;const participantByKey=new Map<string,string>();const optionalIds=new Set<string>();
    for(const role of spec.roles){let participant=detail.participants.find((item)=>!item.isBrokerFinalSigner&&item.role===role.role);
      if(!participant){const added=await runtime.domain.addParticipant({documentVersionId:detail.version.id,nameSnapshot:`Rol de plantilla — ${role.role}`,emailSnapshot:`${role.key}.${spec.documentType}@example.invalid`,role:role.role,routingOrder:role.order,actorAdminId:input.actorAdminId,idempotencyKey:randomUUID()});const refreshed=await repository.detail(spec.documentId);if(!refreshed)throw new Error("phase3b_source_missing");detail=refreshed;participant=detail.participants.find((item)=>item.id===added.participantId);}
      if(!participant)throw new Error("phase3b_role_missing");participantByKey.set(role.key,participant.id);if(role.optional)optionalIds.add(participant.id);
      if(participant.routingOrder!==role.order)await runtime.domain.updateParticipant({participantId:participant.id,nameSnapshot:participant.name,emailSnapshot:participant.email,role:participant.role,routingOrder:role.order,actorAdminId:input.actorAdminId,idempotencyKey:randomUUID()});
    }
    detail=await repository.detail(spec.documentId);const broker=detail?.participants.find((item)=>item.isBrokerFinalSigner);if(spec.requiresBroker){if(!broker)throw new Error("phase3b_broker_missing");participantByKey.set("broker",broker.id);const finalOrder=Math.max(...spec.roles.map((role)=>role.order))+1;if(broker.routingOrder!==finalOrder)await runtime.domain.updateParticipant({participantId:broker.id,nameSnapshot:broker.name,emailSnapshot:broker.email,role:broker.role,routingOrder:finalOrder,actorAdminId:input.actorAdminId,idempotencyKey:randomUUID()});}
    detail=await repository.detail(spec.documentId);if(!detail)throw new Error("phase3b_detail_missing");let tabOrder=1;
    for(const field of spec.fields){const participantId=participantByKey.get(field.roleKey);const geometry=detail.version.pageGeometry[field.page];if(!participantId||!geometry)throw new Error("phase3b_field_mapping_missing");const width=Number(geometry.cropBox.width),height=Number(geometry.cropBox.height);
      await runtime.domain.addField({documentVersionId:detail.version.id,participantId,fieldType:field.type,pageIndex:field.page,rect:{x:field.x/width,y:field.y/height,width:field.width/width,height:field.height/height},pageGeometryReference:geometry,label:field.label,required:field.required??false,tabOrder:tabOrder++,validationLimits:field.type==="text"?{maxLength:field.maxLength??120}:{},actorAdminId:input.actorAdminId,idempotencyKey:randomUUID()});}
    detail=await repository.detail(spec.documentId);if(!detail)throw new Error("phase3b_final_detail_missing");const blueprint=buildTemplateBlueprint(detail,{optionalParticipantIds:optionalIds});
    await product.createTemplate({name:spec.name,description:spec.description,documentType:spec.documentType,locale:"es-PR",routingMode:spec.routingMode,requiresBrokerSignature:spec.requiresBroker,sourceDocumentVersionId:detail.version.id,roles:blueprint.roles,fields:blueprint.fields,actorAdminId:input.actorAdminId});
    await lifecycle.archiveDraft({documentId:spec.documentId,actorAdminId:input.actorAdminId,reason:"Fuente privada preservada para la plantilla inicial aprobada de Borikí Sign.",idempotencyKey:randomUUID()});
  }
}
