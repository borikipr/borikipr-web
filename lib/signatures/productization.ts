import { createHash, randomUUID } from "node:crypto";
import type { SignatureDatabase } from "./domain/types";
import type { SignatureDraftDetail } from "./admin-repository";

export const BROKER_SETTINGS_CONFIRMATION = "CONFIGURAR CORREDORA FINAL";

export type SignatureTemplateBlueprint = Readonly<{
  id:string;name:string;description:string|null;documentType:string;locale:"es-PR"|"en-US";
  routingMode:"parallel"|"sequential"|"grouped";requiresBrokerSignature:boolean;
  sourceDocumentVersionId:string;
  roles:readonly Readonly<{key:string;role:string;routingOrder:number|null;isBrokerFinalSigner:boolean;optional?:boolean}>[];
  fields:readonly Readonly<{ownerRoleKey:string;fieldType:"signature"|"initials"|"date"|"date_signed"|"text";
    pageIndex:number;x:number;y:number;width:number;height:number;pageGeometryReference:unknown;
    label:string;required:boolean;tabOrder:number;validationLimits:Record<string,number>}>[];
}>;

export function buildTemplateBlueprint(detail:SignatureDraftDetail,input?:{optionalParticipantIds?:ReadonlySet<string>}) {
  const roles=detail.participants.map((participant,index)=>({
    key:`role-${index+1}`,role:participant.role,routingOrder:participant.routingOrder,
    isBrokerFinalSigner:participant.isBrokerFinalSigner,
    optional:participant.isBrokerFinalSigner?false:Boolean(input?.optionalParticipantIds?.has(participant.id)),
  }));
  const participantKeys=new Map(detail.participants.map((participant,index)=>[participant.id,roles[index].key]));
  const fields=detail.fields.map((field)=>({
    ownerRoleKey:participantKeys.get(field.participantId)!,fieldType:field.fieldType,pageIndex:field.pageIndex,
    x:field.normalizedX,y:field.normalizedY,width:field.normalizedWidth,height:field.normalizedHeight,
    pageGeometryReference:field.pageGeometryReference,label:field.label,required:field.required,
    tabOrder:field.tabOrder,validationLimits:field.validationLimits,
  }));
  return {roles,fields};
}

export function templateSnapshotSha256(value:unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function parse<T>(value:unknown):T { return (typeof value==="string"?JSON.parse(value):value) as T; }

export function createSignatureProductRepository(database:SignatureDatabase) {
  return {
    async settings() {
      const [settings]=await database.unsafe<{broker_admin_user_id:string|null;broker_name_snapshot:string|null;broker_email_snapshot:string|null;row_version:number;updated_at:string|Date}>(
        `SELECT broker_admin_user_id::text,broker_name_snapshot,broker_email_snapshot,row_version,updated_at
           FROM signature_signing_settings WHERE singleton=true`
      );
      const admins=await database.unsafe<{id:string;display_name:string|null;username:string;email:string|null}>(
        `SELECT id::text,display_name,username,email FROM admin_users WHERE activo=true ORDER BY coalesce(display_name,username)`
      );
      return {settings:settings??null,admins:admins.map((row)=>({id:row.id,name:row.display_name?.trim()||row.username,email:row.email}))};
    },
    async saveBrokerSettings(input:{brokerAdminUserId:string;actorAdminId:string;confirmationPhrase:string}) {
      if(input.confirmationPhrase!==BROKER_SETTINGS_CONFIRMATION) throw new Error("signature_broker_confirmation_invalid");
      return database.begin(async(tx)=>{
        const [admin]=await tx.unsafe<{id:string;name:string;email:string}>(
          `SELECT id::text,coalesce(nullif(btrim(display_name),''),username) name,email
             FROM admin_users WHERE id=$1::uuid AND activo=true AND email IS NOT NULL FOR UPDATE`,[input.brokerAdminUserId]
        );
        if(!admin) throw new Error("signature_broker_admin_invalid");
        const [row]=await tx.unsafe<{row_version:number}>(`INSERT INTO signature_signing_settings(singleton,broker_admin_user_id,broker_name_snapshot,broker_email_snapshot,updated_by_admin_id)
          VALUES(true,$1::uuid,$2,lower($3),$4::uuid)
          ON CONFLICT(singleton) DO UPDATE SET broker_admin_user_id=excluded.broker_admin_user_id,
            broker_name_snapshot=excluded.broker_name_snapshot,broker_email_snapshot=excluded.broker_email_snapshot,
            updated_by_admin_id=excluded.updated_by_admin_id,row_version=signature_signing_settings.row_version+1,updated_at=now()
          RETURNING row_version`,[admin.id,admin.name,admin.email,input.actorAdminId]);
        const snapshot=templateSnapshotSha256({brokerAdminUserId:admin.id,name:admin.name,email:admin.email,rowVersion:row.row_version});
        await tx.unsafe(`INSERT INTO signature_governance_events(entity_type,entity_id,action,actor_admin_id,snapshot_sha256,previous_state,new_state,idempotency_key)
          VALUES('signing_settings',$1::uuid,'updated',$2::uuid,$3,'previous_configuration','broker_final_configured',$4::uuid)`,
          [admin.id,input.actorAdminId,snapshot,randomUUID()]);
        return {configured:true as const};
      });
    },
    async createTemplate(input:{name:string;description?:string|null;documentType:string;locale:"es-PR"|"en-US";
      routingMode:"parallel"|"sequential"|"grouped";requiresBrokerSignature:boolean;sourceDocumentVersionId:string;
      roles:SignatureTemplateBlueprint["roles"];fields:SignatureTemplateBlueprint["fields"];actorAdminId:string}) {
      const name=input.name.normalize("NFC").trim();const description=input.description?.normalize("NFC").trim()||null;
      if(!name||name.length>200||description&&description.length>500||!input.roles.length||!input.fields.length)throw new Error("signature_template_invalid");
      const snapshot={name,description,documentType:input.documentType,sourceDocumentVersionId:input.sourceDocumentVersionId,
        locale:input.locale,routingMode:input.routingMode,requiresBrokerSignature:input.requiresBrokerSignature,roles:input.roles,fields:input.fields};
      return database.begin(async(tx)=>{
        const [created]=await tx.unsafe<{id:string}>(`INSERT INTO signature_templates(name,description,document_type,source_document_version_id,
          locale,routing_mode,requires_broker_signature,role_blueprint,field_blueprint,snapshot_sha256,created_by_admin_id)
          VALUES($1,$2,$3,$4::uuid,$5,$6,$7,$8::text::jsonb,$9::text::jsonb,$10,$11::uuid) RETURNING id::text`,
          [name,description,input.documentType,input.sourceDocumentVersionId,input.locale,input.routingMode,input.requiresBrokerSignature,
            JSON.stringify(input.roles),JSON.stringify(input.fields),templateSnapshotSha256(snapshot),input.actorAdminId]);
        await tx.unsafe(`INSERT INTO signature_governance_events(entity_type,entity_id,action,actor_admin_id,snapshot_sha256,previous_state,new_state,idempotency_key)
          VALUES('signature_template',$1::uuid,'created',$2::uuid,$3,NULL,'active',$4::uuid)`,
          [created.id,input.actorAdminId,templateSnapshotSha256(snapshot),randomUUID()]);
        return created;
      });
    },
    async templates(status="active") {
      const rows=await database.unsafe<{id:string;name:string;description:string|null;document_type:string;source_document_version_id:string;
        locale:"es-PR"|"en-US";routing_mode:"parallel"|"sequential"|"grouped";requires_broker_signature:boolean;
        role_blueprint:unknown;field_blueprint:unknown}>(`SELECT id::text,name,description,document_type,source_document_version_id::text,
          locale,routing_mode,requires_broker_signature,role_blueprint,field_blueprint FROM signature_templates
          WHERE status=$1 ORDER BY created_at DESC`,[status]);
      return rows.map((row)=>({id:row.id,name:row.name,description:row.description,documentType:row.document_type,
        sourceDocumentVersionId:row.source_document_version_id,locale:row.locale,routingMode:row.routing_mode,
        requiresBrokerSignature:row.requires_broker_signature,
        roles:parse<SignatureTemplateBlueprint["roles"]>(row.role_blueprint),fields:parse<SignatureTemplateBlueprint["fields"]>(row.field_blueprint)}));
    },
    async template(id:string) {
      const rows=await database.unsafe<{id:string;name:string;description:string|null;document_type:string;source_document_version_id:string;
        locale:"es-PR"|"en-US";routing_mode:"parallel"|"sequential"|"grouped";requires_broker_signature:boolean;
        role_blueprint:unknown;field_blueprint:unknown}>(`SELECT id::text,name,description,document_type,source_document_version_id::text,
          locale,routing_mode,requires_broker_signature,role_blueprint,field_blueprint FROM signature_templates
          WHERE id=$1::uuid AND status='active'`,[id]);
      const row=rows[0]; if(!row)return null;
      return {id:row.id,name:row.name,description:row.description,documentType:row.document_type,
        sourceDocumentVersionId:row.source_document_version_id,locale:row.locale,routingMode:row.routing_mode,
        requiresBrokerSignature:row.requires_broker_signature,
        roles:parse<SignatureTemplateBlueprint["roles"]>(row.role_blueprint),fields:parse<SignatureTemplateBlueprint["fields"]>(row.field_blueprint)};
    },
  };
}
