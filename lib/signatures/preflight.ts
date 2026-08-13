import { createHash } from "node:crypto";
import { getSignatureSecurityConfig } from "./config";
import { getSignatureDocumentTypeDefinition } from "./document-classification";
import type { SignatureQueryExecutor } from "./domain/types";
import { canonicalJson } from "./prototype/hash";
import { hashSignatureFieldDefinition } from "./field-definition";
import { INTERNAL_CANARY_MAX_AUTHORIZATION_MS } from "./preflight-constants";
export { INTERNAL_CANARY_MAX_AUTHORIZATION_MS, INTERNAL_CANARY_CONFIRMATION_PHRASE, RISK_ACCEPTANCE_CONFIRMATION_PHRASE } from "./preflight-constants";

export type SignaturePreflightLocale = "es-PR" | "en-US";
export type SignaturePreflightAuthorizationType = "internal_canary" | "production_public_launch";
export type SignaturePreflightItem = Readonly<{
  code: string;
  category: "preparation" | "governance" | "recovery" | "security" | "authorization";
  status: "pass" | "warning" | "blocked";
  message: string;
  remediation?: string;
}>;

export type SignaturePreflightResult = Readonly<{
  overallStatus: "pass" | "blocked";
  state: "not_prepared" | "prepared" | "governance_ready" | "technically_ready";
  evaluatedAt: string;
  environment: "isolated" | "preview" | "production";
  authorizationType: SignaturePreflightAuthorizationType;
  documentId: string;
  documentVersionId: string | null;
  participantIds: readonly string[];
  participantEmails: readonly string[];
  documentTypes: readonly string[];
  locales: readonly SignaturePreflightLocale[];
  authorizationExpiresAt: string;
  items: readonly SignaturePreflightItem[];
  blockingItems: readonly SignaturePreflightItem[];
  warnings: readonly SignaturePreflightItem[];
  governanceVersionIds: Readonly<{
    classificationId: string | null;
    consentIds: Readonly<Record<SignaturePreflightLocale, string | null>>;
    privacyId: string | null;
    retentionId: string | null;
    riskAcceptanceIds: readonly string[];
  }>;
  snapshot: Readonly<Record<string, unknown>>;
  readinessHash: string;
}>;

function digest(value: unknown) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function textDigest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizedUnique(values: readonly string[]) {
  return [...new Set(values.map((value) => value.normalize("NFC").trim().toLowerCase()))].sort();
}

function normalizedLocales(values: readonly SignaturePreflightLocale[]) {
  return [...new Set(values.map((value) => value.normalize("NFC").trim().toLowerCase()))]
    .map((value) => value === "es-pr" ? "es-PR" : value === "en-us" ? "en-US" : value)
    .sort() as SignaturePreflightLocale[];
}

function sameValues(left: readonly string[], right: readonly string[]) {
  const a = [...left].sort(); const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function item(code: string, category: SignaturePreflightItem["category"], status: SignaturePreflightItem["status"], message: string, remediation?: string): SignaturePreflightItem {
  return Object.freeze({ code, category, status, message, ...(remediation ? { remediation } : {}) });
}

export async function evaluateSignaturePreflight(input: {
  database: SignatureQueryExecutor;
  documentId: string;
  locales: readonly SignaturePreflightLocale[];
  participantEmails?: readonly string[];
  documentTypes?: readonly string[];
  environment: "isolated" | "preview" | "production";
  authorizationType: SignaturePreflightAuthorizationType;
  authorizationExpiresAt: Date;
  environmentVariables?: Readonly<Record<string,string|undefined>>;
  now?: Date;
}): Promise<SignaturePreflightResult> {
  const now = input.now ?? new Date();
  const env = input.environmentVariables ?? process.env;
  const locales = normalizedLocales(input.locales);
  const rows = await input.database.unsafe<{
    id:string; status:string; document_type:string; expires_at:string|Date|null; version_id:string|null;
    mime_type:string|null; byte_count:number|null; page_count:number|null; source_sha256:string|null;
    field_definition_sha256:string|null;
  }>(`SELECT d.id::text,d.status,d.document_type,d.expires_at,v.id::text version_id,v.mime_type,
      v.byte_count::integer,v.page_count,v.source_sha256,v.field_definition_sha256
      FROM signature_documents d LEFT JOIN signature_document_versions v ON v.id=d.active_version_id
      WHERE d.id=$1::uuid`,[input.documentId]);
  const document = rows[0];
  const items: SignaturePreflightItem[] = [];
  if (!document) items.push(item("document_not_found","preparation","blocked","No se encontró el documento.","Vuelve a Firmas y selecciona un borrador válido."));
  const signableStatuses = new Set(["draft","sent","viewed","partially_signed"]);
  if (document && !signableStatuses.has(document.status)) items.push(item("document_status_invalid","preparation","blocked","El estado del documento no permite firma.","Revisa el estado o prepara una nueva versión."));
  if (!document?.version_id) items.push(item("active_version_missing","preparation","blocked","Falta una versión activa del documento.","Carga y valida el PDF."));
  if (document && (document.mime_type!=="application/pdf" || !document.byte_count || document.byte_count>3_000_000 || !document.page_count || document.page_count>25)) {
    items.push(item("source_pdf_incompatible","preparation","blocked","El PDF no cumple los límites admitidos.","Carga un PDF válido de hasta 25 páginas y 3 MB."));
  }
  if (!document?.expires_at || new Date(document.expires_at).getTime()<=now.getTime()) items.push(item("expiration_invalid","preparation","blocked","La expiración no es válida.","Selecciona una fecha futura."));

  const participants = document?.version_id ? await input.database.unsafe<{id:string;normalized_email:string}>(
    `SELECT id::text,normalized_email FROM signature_participants WHERE document_version_id=$1::uuid AND removed_at IS NULL ORDER BY normalized_email,id`,[document.version_id]) : [];
  const participantIds = participants.map((row)=>row.id).sort();
  const participantEmails = normalizedUnique(participants.map((row)=>row.normalized_email));
  if (participants.length<1 || participants.length>8 || participantEmails.length!==participants.length) {
    items.push(item("participant_scope_invalid","preparation","blocked","Debe haber entre 1 y 8 participantes con correos únicos.","Corrige los participantes del borrador."));
  }
  if (participantEmails.some((email)=>!/^([^@\s*]+)@([^@\s*]+\.)+[^@\s*]+$/.test(email))) {
    items.push(item("participant_email_invalid","preparation","blocked","Hay un correo inválido o con comodín.","Usa correos exactos; no se permiten dominios o destinatarios comodín."));
  }
  if(input.authorizationType==="internal_canary"&&participantEmails.length){
    const [leadMatch]=await input.database.unsafe<{count:number}>(`SELECT count(*)::integer count FROM leads WHERE email_normalized=ANY($1::text[]) AND status<>'merged'`,[participantEmails]);
    if((leadMatch?.count??0)>0) items.push(item("customer_identity_detected","authorization","blocked","Un participante coincide con una identidad de cliente o lead de producción.","Usa identidades internas/sintéticas exactas; el primer canary no admite clientes."));
  }
  const requestedEmails = normalizedUnique(input.participantEmails ?? participantEmails);
  if (!sameValues(requestedEmails,participantEmails)) items.push(item("participant_scope_mismatch","authorization","blocked","El alcance no coincide exactamente con los participantes.","Autoriza únicamente los correos exactos del documento."));
  const requestedTypes = normalizedUnique(input.documentTypes ?? (document ? [document.document_type] : []));
  if (!document || requestedTypes.length!==1 || requestedTypes[0]!==document.document_type) items.push(item("classification_scope_mismatch","authorization","blocked","La clasificación autorizada no coincide exactamente con el documento.","Selecciona una sola clasificación exacta para el primer canary."));
  if (locales.length!==1 && input.authorizationType==="internal_canary") items.push(item("locale_scope_invalid","authorization","blocked","El primer canary debe usar un solo idioma.","Selecciona exactamente es-PR o en-US."));
  if (locales.length<1 || locales.some((locale)=>locale!=="es-PR" && locale!=="en-US")) items.push(item("locale_scope_invalid","authorization","blocked","El alcance de idioma no es válido.","Selecciona un idioma admitido."));

  const fields=document?.version_id?await input.database.unsafe<{participant_id:string;field_type:"signature"|"initials"|"date"|"text";page_index:number;normalized_x:string;normalized_y:string;normalized_width:string;normalized_height:string;required:boolean;tab_order:number;validation_limits:Record<string,number>|string}>(
    `SELECT participant_id::text,field_type,page_index,normalized_x::text,normalized_y::text,normalized_width::text,normalized_height::text,required,tab_order,validation_limits FROM signature_fields WHERE document_version_id=$1::uuid ORDER BY tab_order,id`,[document.version_id]):[];
  if(fields.length<1||fields.length>100) items.push(item("field_count_invalid","preparation","blocked","El documento debe tener entre 1 y 100 campos.","Añade los campos requeridos."));
  if(participantIds.some((participantId)=>!fields.some((field)=>field.participant_id===participantId&&field.required))) items.push(item("required_field_missing","preparation","blocked","Cada participante necesita al menos un campo requerido propio.","Asigna campos requeridos a cada participante."));
  const computedFieldDefinitionSha256=document?.version_id&&fields.length?hashSignatureFieldDefinition({documentVersionId:document.version_id,fields:fields.map((field)=>({participantId:field.participant_id,fieldType:field.field_type,pageIndex:field.page_index,normalizedX:Number(field.normalized_x),normalizedY:Number(field.normalized_y),normalizedWidth:Number(field.normalized_width),normalizedHeight:Number(field.normalized_height),required:field.required,tabOrder:field.tab_order,validationLimits:typeof field.validation_limits==="string"?JSON.parse(field.validation_limits):field.validation_limits}))}):null;
  if(document?.field_definition_sha256&&document.field_definition_sha256!==computedFieldDefinitionSha256) items.push(item("field_definition_hash_stale","preparation","blocked","La definición de campos cambió desde su bloqueo.","Revisa el documento y crea una nueva autorización."));

  const expirationMs=input.authorizationExpiresAt.getTime()-now.getTime();
  if (!Number.isFinite(expirationMs) || expirationMs<=0 || (input.authorizationType==="internal_canary" && expirationMs>INTERNAL_CANARY_MAX_AUTHORIZATION_MS)) {
    items.push(item("authorization_expiration_invalid","authorization","blocked","La autorización debe expirar dentro de las próximas 24 horas.","Selecciona una expiración corta y futura."));
  }

  const definition=document ? getSignatureDocumentTypeDefinition(document.document_type) : null;
  const classifications=document ? await input.database.unsafe<{id:string;status:string;approval_mode:string;approval_snapshot_sha256:string|null;effective_from:string|Date|null}>(
    `SELECT id::text,status,approval_mode,approval_snapshot_sha256,effective_from FROM signature_document_type_approvals
     WHERE document_type=$1 AND status IN ('approved','restricted') AND revoked_at IS NULL AND retired_at IS NULL AND effective_from<=$2::timestamptz
     ORDER BY effective_from DESC,version_number DESC LIMIT 1`,[document.document_type,now.toISOString()]) : [];
  const classification=classifications[0]??null;
  if (!classification) items.push(item("classification_missing","governance","blocked","La clasificación del documento no está aprobada.","Ve a Firmas > Gobernanza > Clasificaciones."));
  if (classification?.status==="restricted") items.push(item("document_out_of_scope","governance","blocked","Este documento está fuera del alcance de firma electrónica interna de Erickson Real Estate.","No existe un botón para continuar. Registra una nueva versión de gobernanza sólo si cambia deliberadamente el alcance."));
  if (classification && definition?.scope!=="ordinary_brokerage" && classification.approval_mode!=="external_review") {
    items.push(item("high_formality_scope_blocked","governance","blocked","Esta categoría requiere manejo externo y no puede aprobarse por la vía interna ordinaria.","Registra revisión externa o clasifícala fuera de alcance."));
  }
  if (classification && !/^[0-9a-f]{64}$/.test(classification.approval_snapshot_sha256??"")) items.push(item("classification_hash_invalid","governance","blocked","La evidencia inmutable de clasificación no es válida.","Registra una nueva versión correctamente aprobada."));

  const consentIds={"es-PR":null,"en-US":null} as Record<SignaturePreflightLocale,string|null>;
  const consentBindings: Record<string,unknown>[]=[];
  for (const locale of locales) {
    const [consent]=await input.database.unsafe<{id:string;version_identifier:string;consent_text:string;consent_text_sha256:string}>(
      `SELECT id::text,version_identifier,consent_text,consent_text_sha256 FROM signature_consent_versions
       WHERE locale=$1 AND status='approved' AND effective_from<=$2::timestamptz AND retired_at IS NULL
       ORDER BY effective_from DESC,created_at DESC LIMIT 1`,[locale,now.toISOString()]);
    if (!consent) items.push(item(`consent_${locale}_missing`,"governance","blocked",`Falta un consentimiento ${locale} aprobado y vigente.`,`Ve a Firmas > Gobernanza > Consentimientos ${locale}.`));
    else if (textDigest(consent.consent_text.normalize("NFC").trim())!==consent.consent_text_sha256) items.push(item(`consent_${locale}_hash_invalid`,"governance","blocked",`El hash del consentimiento ${locale} no coincide.`,`Retira la versión y registra una nueva versión íntegra.`));
    else { consentIds[locale]=consent.id; consentBindings.push({locale,id:consent.id,version:consent.version_identifier,sha256:consent.consent_text_sha256}); }
  }
  const [privacy]=await input.database.unsafe<{id:string;version_identifier:string;es_pr_text:string;en_us_text:string;es_pr_sha256:string;en_us_sha256:string}>(
    `SELECT id::text,version_identifier,es_pr_text,en_us_text,es_pr_sha256,en_us_sha256 FROM signature_privacy_disclosure_versions
     WHERE status='approved' AND effective_from<=$1::timestamptz AND retired_at IS NULL LIMIT 1`,[now.toISOString()]);
  if (!privacy) items.push(item("privacy_missing","governance","blocked","Falta una divulgación de privacidad aprobada y vigente.","Ve a Firmas > Gobernanza > Privacidad."));
  else for (const locale of locales) {
    const text=locale==="es-PR"?privacy.es_pr_text:privacy.en_us_text; const hash=locale==="es-PR"?privacy.es_pr_sha256:privacy.en_us_sha256;
    if (textDigest(text.normalize("NFC").trim())!==hash) items.push(item(`privacy_${locale}_hash_invalid`,"governance","blocked",`El hash de privacidad ${locale} no coincide.`,`Registra una nueva versión íntegra.`));
  }
  const [retention]=await input.database.unsafe<{id:string;version_identifier:string;policy_sha256:string|null;completed_cleanup_enabled:boolean}>(
    `SELECT id::text,version_identifier,policy_sha256,completed_cleanup_enabled FROM signature_retention_policy_versions WHERE status='active' LIMIT 1`);
  if (!retention) items.push(item("retention_missing","governance","blocked","Falta una política de retención activa.","Ve a Firmas > Gobernanza > Política de retención."));
  else if (!/^[0-9a-f]{64}$/.test(retention.policy_sha256??"")) items.push(item("retention_hash_invalid","governance","blocked","La política activa no tiene evidencia íntegra.","Registra y activa una nueva versión válida."));

  let hmacVersion:number|null=null;
  try { hmacVersion=getSignatureSecurityConfig(env).currentVersion; }
  catch { items.push(item("hmac_unavailable","security","blocked","La configuración de integridad HMAC no está disponible.","Revisa la configuración server-side; no introduzcas secretos en Admin.")); }
  const invalidHolds=document ? await input.database.unsafe<{count:number}>(
    `SELECT count(*)::integer count FROM signature_legal_holds WHERE document_id=$1::uuid AND status NOT IN ('active','released')`,[document.id]) : [{count:0}];
  if ((invalidHolds[0]?.count??0)>0) items.push(item("legal_hold_state_invalid","security","blocked","Existe un estado inválido de retención legal.","Revisa las retenciones legales antes de continuar."));

  const riskRows=await input.database.unsafe<{id:string;risk_code:string;authorization_scope:string;expires_at:string|Date}>(
    `SELECT id::text,risk_code,authorization_scope,expires_at FROM signature_risk_acceptances
     WHERE authorization_scope=$1 AND expires_at>=$2::timestamptz ORDER BY accepted_at DESC`,[input.authorizationType,input.authorizationExpiresAt.toISOString()]);
  const riskIds:string[]=[];
  const recoveryRequirements=[
    {code:"neon_restore_unproven",proof:env.SIGNING_NEON_RECOVERY_PROVEN?.toLowerCase()==="true",message:"Neon recovery: NO PROBADO"},
    {code:"r2_independent_recovery_unproven",proof:env.SIGNING_R2_INDEPENDENT_RECOVERY_PROVEN?.toLowerCase()==="true",message:"R2 independiente: NO PROBADO"},
  ];
  for (const requirement of recoveryRequirements) {
    if (requirement.proof) continue;
    const risk=riskRows.find((row)=>row.risk_code===requirement.code);
    if (input.authorizationType==="internal_canary" && risk) { riskIds.push(risk.id); items.push(item(requirement.code,"recovery","warning",`${requirement.message}; existe aceptación vigente solo para canary interno.`)); }
    else items.push(item(requirement.code,"recovery","blocked",requirement.message,input.authorizationType==="internal_canary"?"Realiza la prueba o registra una aceptación de riesgo acotada y vigente.":"La autorización pública exige evidencia independiente; una aceptación de canary no aplica."));
  }
  if (input.authorizationType==="production_public_launch" && env.SIGNING_PUBLIC_ENABLED?.toLowerCase()!=="false" && env.SIGNING_PUBLIC_ENABLED!==undefined) {
    items.push(item("public_flag_must_remain_off_before_authorization","authorization","blocked","La firma pública debe permanecer apagada durante la autorización.","Desactiva el flag y vuelve a ejecutar pre-flight."));
  }

  const blockingItems=items.filter((entry)=>entry.status==="blocked");
  const warnings=items.filter((entry)=>entry.status==="warning");
  const preparationBlocked=blockingItems.some((entry)=>entry.category==="preparation");
  const governanceBlocked=blockingItems.some((entry)=>entry.category==="governance");
  const technicalBlocked=blockingItems.some((entry)=>["recovery","security","authorization"].includes(entry.category));
  const state=preparationBlocked?"not_prepared":governanceBlocked?"prepared":technicalBlocked?"governance_ready":"technically_ready";
  const snapshot=Object.freeze({schema:"signature-preflight-v1",environment:input.environment,authorizationType:input.authorizationType,
    document:{id:document?.id??input.documentId,versionId:document?.version_id??null,documentType:document?.document_type??null,
      sourceSha256:document?.source_sha256??null,fieldDefinitionSha256:computedFieldDefinitionSha256,
      expiration:document?.expires_at?new Date(document.expires_at).toISOString():null},
    scope:{participantIds,participantEmails,documentTypes:requestedTypes,locales},authorizationExpiresAt:input.authorizationExpiresAt.toISOString(),
    governance:{classification:classification?{id:classification.id,mode:classification.approval_mode,sha256:classification.approval_snapshot_sha256}:null,
      consents:consentBindings,privacy:privacy?{id:privacy.id,version:privacy.version_identifier,sha256ByLocale:Object.fromEntries(locales.map((locale)=>[locale,locale==="es-PR"?privacy.es_pr_sha256:privacy.en_us_sha256]))}:null,
      retention:retention?{id:retention.id,version:retention.version_identifier,sha256:retention.policy_sha256}:null},
    recovery:{riskAcceptanceIds:[...riskIds].sort()},security:{hmacVersion},blockingCodes:blockingItems.map((entry)=>entry.code).sort(),warningCodes:warnings.map((entry)=>entry.code).sort()});
  return Object.freeze({overallStatus:blockingItems.length?"blocked":"pass",state,evaluatedAt:now.toISOString(),environment:input.environment,
    authorizationType:input.authorizationType,documentId:input.documentId,documentVersionId:document?.version_id??null,
    participantIds:Object.freeze(participantIds),participantEmails:Object.freeze(participantEmails),documentTypes:Object.freeze(requestedTypes),locales:Object.freeze(locales),
    authorizationExpiresAt:input.authorizationExpiresAt.toISOString(),items:Object.freeze(items),blockingItems:Object.freeze(blockingItems),warnings:Object.freeze(warnings),
    governanceVersionIds:Object.freeze({classificationId:classification?.id??null,consentIds:Object.freeze(consentIds),privacyId:privacy?.id??null,retentionId:retention?.id??null,riskAcceptanceIds:Object.freeze([...riskIds].sort())}),
    snapshot,readinessHash:digest(snapshot)});
}

export async function persistSignatureReadinessSnapshot(input:{database:SignatureQueryExecutor;result:SignaturePreflightResult;actorAdminId:string}) {
  if(input.result.overallStatus!=="pass") throw new Error("signature_preflight_blocked");
  const [row]=await input.database.unsafe<{id:string}>(`INSERT INTO signature_readiness_snapshots
    (environment,authorization_type,overall_status,participant_emails,document_types,locales,snapshot,snapshot_sha256,created_by_admin_id)
    VALUES ($1,$2,'pass',$3::text[],$4::text[],$5::text[],$6::jsonb,$7,$8::uuid) RETURNING id::text`,
    [input.result.environment,input.result.authorizationType,[...input.result.participantEmails],[...input.result.documentTypes],[...input.result.locales],JSON.stringify(input.result.snapshot),input.result.readinessHash,input.actorAdminId]);
  return row;
}
