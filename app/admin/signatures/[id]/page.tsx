import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SignatureDraftEditor from "@/components/admin/signatures/SignatureDraftEditor";
import IsolatedDeliveryControl from "@/components/admin/signatures/IsolatedDeliveryControl";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createSignatureAdminRepository } from "@/lib/signatures/admin-repository";
import { signatureEventLabel, signatureStatusLabel, signatureStatusTone } from "@/lib/signatures/admin-ux";
import { getSignatureDocumentTypeDefinition } from "@/lib/signatures/document-classification";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { evaluateSignatureSendReadiness } from "@/lib/signatures/send-readiness";
import { isInternalCanarySigningEnabled, isPublicSigningEnabled } from "@/lib/signatures/public-config";
import { isSignerAccessAuthorized } from "@/lib/signatures/canary-gate";
import { getSignatureSecurityConfig } from "@/lib/signatures/config";
import { inspectSignatureRetentionPolicy } from "@/lib/signatures/retention-policy";
import { inspectSignaturePrivacyDisclosure } from "@/lib/signatures/privacy-disclosure";
import { loadActivePrivacyDisclosure, loadActiveRetentionPolicy } from "@/lib/signatures/governance-config";
import { evaluateSignaturePreflight } from "@/lib/signatures/preflight";

export default async function SignatureDraftPage({params}:{params:Promise<{id:string}>}) {
  if(!(await getAdminSessionUser())) redirect("/admin/login");
  const {id}=await params; const database=createPostgresSignatureDatabase(sql); const repository=createSignatureAdminRepository(database);
  const detail=await repository.detail(id); if(!detail) notFound();
  const definition=getSignatureDocumentTypeDefinition(detail.documentType);
  let keysConfigured=false; try{getSignatureSecurityConfig();keysConfigured=true}catch{keysConfigured=false}
  const [{preflight_expiration:preflightExpiration}]=await sql<{preflight_expiration:Date}[]>`SELECT now()+interval '1 hour' preflight_expiration`;
  const [durableRetention,durablePrivacy,participantAuthorizations,preflight]=await Promise.all([
    loadActiveRetentionPolicy(database),loadActivePrivacyDisclosure(database),
    Promise.all(detail.participants.map((participant)=>isSignerAccessAuthorized(database,{participantId:participant.id,documentVersionId:detail.version.id}))),
    evaluateSignaturePreflight({database,documentId:id,locales:["es-PR"],participantEmails:detail.participants.map((p)=>p.email),documentTypes:[detail.documentType],environment:"production",authorizationType:"internal_canary",authorizationExpiresAt:preflightExpiration}),
  ]);
  const scoped=detail.participants.length>0&&participantAuthorizations.every(Boolean);
  const activationMode=isPublicSigningEnabled()&&scoped?"public":isInternalCanarySigningEnabled()||scoped?"internal_canary":"disabled";
  const readiness=await evaluateSignatureSendReadiness({database,documentId:id,locale:"es-PR",publicSigningEnabled:isInternalCanarySigningEnabled()||scoped,eventKeysConfigured:keysConfigured,retentionPolicyConfigured:Boolean(durableRetention)||inspectSignatureRetentionPolicy().configured,privacyDisclosureConfigured:Boolean(durablePrivacy)||inspectSignaturePrivacyDisclosure().configured});

  return <AdminPageShell>
    <AdminPageHeader breadcrumbs={[{href:"/admin",label:"Admin"},{href:"/admin/signatures",label:"Firmas"},{label:detail.title}]} eyebrow="Firmas · Documento" title={detail.title} description="Prepara destinatarios y campos, revisa todo y envía únicamente cuando los controles estén completos." actions={!detail.version.sourceDeleted&&detail.status!=="archived"?<Link className="btn-secondary" href={`/admin/signatures/${detail.id}/source`} target="_blank">Abrir PDF</Link>:undefined} />

    <section className="surface-card admin-meta-grid grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen del documento">
      <div><dt>Estado</dt><dd><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${signatureStatusTone(detail.status)}`}>{signatureStatusLabel(detail.status)}</span></dd></div>
      <div><dt>Documento</dt><dd>{detail.version.pageCount} páginas · {(detail.version.byteCount/1024).toFixed(1)} KB</dd></div>
      <div><dt>Destinatarios</dt><dd>{detail.participants.length}</dd></div>
      <div><dt>Expiración</dt><dd>{detail.expiresAt?new Date(detail.expiresAt).toLocaleDateString("es-PR"):"Sin fecha"}</dd></div>
    </section>

    {detail.status==="completed"&&<section className="surface-card flex flex-wrap gap-3 p-5"><Link className="btn-primary" href={`/admin/signatures/${detail.id}/final`}>Descargar documento firmado</Link><Link className="btn-secondary" href={`/admin/signatures/${detail.id}/certificate`}>Descargar certificado</Link><Link className="btn-secondary" href={`/admin/signatures/${detail.id}/evidence`}>Ver evidencia</Link></section>}
    {process.env.NODE_ENV!=="production"&&process.env.SIGNING_ISOLATED_ENVIRONMENT==="true"&&!['draft','completed'].includes(detail.status)&&<IsolatedDeliveryControl />}
    {definition?.scope!=="ordinary_brokerage"&&<section className="surface-card border-l-4 border-amber-500 p-5 text-sm text-amber-900">{definition?.guidance}</section>}

    {detail.status==="archived"||detail.operationallyHiddenAt?<section className="surface-card p-5"><h2 className="text-lg font-semibold">Fuera de solicitudes activas</h2><p className="mt-2 text-sm text-slate-600">Borikí conserva automáticamente la evidencia que deba mantenerse. Este registro continúa disponible como historial.</p></section>:<SignatureDraftEditor detail={detail} readiness={readiness} preflight={preflight} activationMode={activationMode} />}

    <section className="surface-card overflow-hidden"><header className="admin-section-header"><div><h2 className="text-lg font-semibold">Actividad</h2><p className="mt-1 text-sm text-slate-600">Historial inmutable de la solicitud.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{detail.events.length} eventos</span></header><ol className="divide-y divide-slate-100 px-5">{detail.events.map((event)=><li className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={event.id}><p className="text-sm font-medium">{signatureEventLabel(event.eventType)}</p><time className="text-xs text-slate-500" dateTime={new Date(event.createdAt).toISOString()}>{new Date(event.createdAt).toLocaleString("es-PR")}</time></li>)}</ol>{!detail.events.length&&<p className="p-5 text-sm text-slate-500">No hay actividad registrada.</p>}</section>

    <details className="surface-card p-5"><summary className="cursor-pointer font-semibold">Detalles avanzados</summary><dl className="mt-4 grid min-w-0 gap-4 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Clasificación</dt><dd>{definition?.label??"Desconocida"} · {detail.documentTypeApprovalReference?"Aprobada":"Pendiente"}</dd></div><div><dt className="font-semibold">Versión</dt><dd>{detail.version.number}</dd></div><div className="min-w-0"><dt className="font-semibold">SHA-256 fuente</dt><dd className="truncate font-mono text-xs" title={detail.version.sourceSha256}>{detail.version.sourceSha256}</dd></div><div className="min-w-0"><dt className="font-semibold">SHA-256 de campos</dt><dd className="truncate font-mono text-xs" title={detail.currentFieldDefinitionSha256}>{detail.currentFieldDefinitionSha256}</dd></div><div className="min-w-0 sm:col-span-2"><dt className="font-semibold">Readiness snapshot</dt><dd className="truncate font-mono text-xs" title={preflight.readinessHash}>{preflight.readinessHash}</dd></div></dl></details>
  </AdminPageShell>;
}
