import { randomUUID } from "node:crypto";
import { getAdminSession } from "@/lib/admin/auth";
import { createSignatureAdminRepository } from "@/lib/signatures/admin-repository";
import { parseSignatureParticipantDraft } from "@/lib/signatures/admin-participant";
import { createSignatureProductRepository } from "@/lib/signatures/productization";
import { createSignatureDraftRuntime } from "@/lib/signatures/runtime";
import { sameSignerOrigin } from "@/lib/signatures/signer/origin";

export const runtime="nodejs";export const dynamic="force-dynamic";

function expiration(value:string){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error("expiration_invalid");const date=new Date(`${value}:00-04:00`);if(!Number.isFinite(date.getTime())||date.getTime()<=Date.now())throw new Error("expiration_invalid");return date;}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getAdminSession();if(!session||!sameSignerOrigin(request))return new Response(null,{status:404});
  const browserOrigin=request.headers.get("origin")??request.url;
  try{
    const {id}=await params;const form=await request.formData();const runtime=createSignatureDraftRuntime();
    const product=createSignatureProductRepository(runtime.database);const template=await product.template(id);if(!template)return new Response(null,{status:404});
    const roleInputs=template.roles.filter((role)=>!role.isBrokerFinalSigner).flatMap((blueprintRole)=>{
      const name=String(form.get(`name:${blueprintRole.key}`)??"").trim();const email=String(form.get(`email:${blueprintRole.key}`)??"").trim();
      if(blueprintRole.optional&&!name&&!email)return [];
      return [{blueprintRole,participant:parseSignatureParticipantDraft({name,email,role:blueprintRole.role,routingOrder:String(blueprintRole.routingOrder??1)})}];
    });
    const [source]=await runtime.database.unsafe<{source_r2_key:string;filename_snapshot:string;byte_count:number;source_sha256:string}>(
      `SELECT source_r2_key,filename_snapshot,byte_count::integer,source_sha256 FROM signature_document_versions
        WHERE id=$1::uuid AND source_deleted_at IS NULL`,[template.sourceDocumentVersionId]);if(!source)throw new Error("template_source_missing");
    const bytes=await runtime.storage.getSource({key:source.source_r2_key,byteCount:source.byte_count,sourceSha256:source.source_sha256});
    const created=await runtime.drafts.createDraft({title:String(form.get("title")??template.name),documentType:template.documentType,
      createdByAdminId:session.id,expiresAt:expiration(String(form.get("expiresAt")??"")),filename:source.filename_snapshot,
      mimeType:"application/pdf",bytes,routingMode:template.routingMode,requiresBrokerSignature:template.requiresBrokerSignature,
      brokerCandidateId:String(form.get("brokerCandidateId")??"")||null});
    await runtime.database.unsafe(`UPDATE signature_documents SET source_template_id=$2::uuid WHERE id=$1::uuid AND status='draft'`,[created.documentId,template.id]);
    const roleParticipants=new Map<string,string>();
    for(const item of roleInputs){const added=await runtime.domain.addParticipant({documentVersionId:created.documentVersionId,
      nameSnapshot:item.participant.name,emailSnapshot:item.participant.email,role:item.participant.role,routingOrder:item.participant.routingOrder,
      actorAdminId:session.id,idempotencyKey:randomUUID()});roleParticipants.set(item.blueprintRole.key,added.participantId);}
    let detail=await createSignatureAdminRepository(runtime.database).detail(created.documentId);
    let broker=detail?.participants.find((participant)=>participant.isBrokerFinalSigner);
    if(broker){const finalOrder=Math.max(0,...roleInputs.map((item)=>item.participant.routingOrder??1))+1;
      if(broker.routingOrder!==finalOrder){await runtime.domain.updateParticipant({participantId:broker.id,nameSnapshot:broker.name,
        emailSnapshot:broker.email,role:broker.role,routingOrder:finalOrder,actorAdminId:session.id,idempotencyKey:randomUUID()});
        detail=await createSignatureAdminRepository(runtime.database).detail(created.documentId);broker=detail?.participants.find((participant)=>participant.isBrokerFinalSigner);}}
    for(const role of template.roles)if(role.isBrokerFinalSigner&&broker)roleParticipants.set(role.key,broker.id);
    for(const field of template.fields){const participantId=roleParticipants.get(field.ownerRoleKey);const ownerRole=template.roles.find((role)=>role.key===field.ownerRoleKey);
      if(!participantId&&ownerRole?.optional)continue;if(!participantId)throw new Error("template_role_mapping_missing");
      await runtime.domain.addField({documentVersionId:created.documentVersionId,participantId,fieldType:field.fieldType,pageIndex:field.pageIndex,
        rect:{x:field.x,y:field.y,width:field.width,height:field.height},pageGeometryReference:field.pageGeometryReference,
        label:field.label,required:field.required,tabOrder:field.tabOrder,validationLimits:field.validationLimits,
        actorAdminId:session.id,idempotencyKey:randomUUID()});}
    return Response.redirect(new URL(`/admin/signatures/${created.documentId}`,browserOrigin),303);
  }catch{return Response.redirect(new URL("/admin/signatures/plantillas?error=invalid",browserOrigin),303);}
}
