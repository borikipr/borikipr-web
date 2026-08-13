import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SignatureDraftEditor from "@/components/admin/signatures/SignatureDraftEditor";
import IsolatedDeliveryControl from "@/components/admin/signatures/IsolatedDeliveryControl";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createSignatureAdminRepository } from "@/lib/signatures/admin-repository";
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

export default async function SignatureDraftPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSessionUser())) redirect("/admin/login");
  const { id } = await params;
  const database = createPostgresSignatureDatabase(sql);
  const repository = createSignatureAdminRepository(database);
  const detail = await repository.detail(id);
  if (!detail) notFound();
  const definition = getSignatureDocumentTypeDefinition(detail.documentType);
  let keysConfigured = false;
  try { getSignatureSecurityConfig(); keysConfigured = true; } catch { keysConfigured = false; }
  const [{preflight_expiration:preflightExpiration}]=await sql<{preflight_expiration:Date}[]>`SELECT now()+interval '1 hour' preflight_expiration`;
  const [durableRetention,durablePrivacy,participantAuthorizations,preflight] = await Promise.all([
    loadActiveRetentionPolicy(database),
    loadActivePrivacyDisclosure(database),
    Promise.all(detail.participants.map((participant) => isSignerAccessAuthorized(database, {
      participantId: participant.id,
      documentVersionId: detail.version.id,
    }))),
    evaluateSignaturePreflight({database,documentId:id,locales:["es-PR"],participantEmails:detail.participants.map((participant)=>participant.email),
      documentTypes:[detail.documentType],environment:"production",authorizationType:"internal_canary",authorizationExpiresAt:preflightExpiration}),
  ]);
  const scopedAccessEnabled=detail.participants.length > 0 && participantAuthorizations.every(Boolean);
  const signingAccessEnabled = isInternalCanarySigningEnabled() || scopedAccessEnabled;
  const activationMode=isPublicSigningEnabled()&&scopedAccessEnabled?"public":isInternalCanarySigningEnabled()||scopedAccessEnabled?"internal_canary":"disabled";
  const readiness = await evaluateSignatureSendReadiness({
    database, documentId: id, locale: "es-PR",
    publicSigningEnabled: signingAccessEnabled, eventKeysConfigured: keysConfigured,
    retentionPolicyConfigured: Boolean(durableRetention) || inspectSignatureRetentionPolicy().configured,
    privacyDisclosureConfigured: Boolean(durablePrivacy) || inspectSignaturePrivacyDisclosure().configured,
  });

  return (
    <AdminPageShell>
      <AdminPageHeader breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/signatures", label: "Firmas" }, { label: detail.title }]} eyebrow="Firmas · Ensamblaje" title={detail.title} description="Vista privada del PDF fuente y su definición de campos. El documento original no se modifica durante la preparación." actions={detail.status === "archived" ? undefined : <Link className="btn-secondary" href={`/admin/signatures/${detail.id}/source`} target="_blank">Abrir PDF privado</Link>} />

      <section className="surface-card grid gap-4 p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="font-semibold text-[#555]">Compatibilidad</p><p className="mt-1 text-green-700">PDF validado</p></div>
        <div><p className="font-semibold text-[#555]">Clasificación del documento</p><p className="mt-1 text-amber-800">{definition?.label ?? "Desconocida"} · {detail.documentTypeApprovalReference ? "Aprobado para firma electrónica" : "Pendiente"}</p></div>
        <div><p className="font-semibold text-[#555]">Documento</p><p className="mt-1">{detail.version.pageCount} páginas · {(detail.version.byteCount / 1024).toFixed(1)} KB</p></div>
        <div><p className="font-semibold text-[#555]">Estado</p><p className="mt-1">{detail.status}</p></div>
        <div className="min-w-0 sm:col-span-2"><p className="font-semibold text-[#555]">SHA-256 fuente</p><code className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap" title={detail.version.sourceSha256}>{detail.version.sourceSha256}</code></div>
        <div className="min-w-0 sm:col-span-2"><p className="font-semibold text-[#555]">SHA-256 definición de campos</p><code className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap" title={detail.currentFieldDefinitionSha256}>{detail.currentFieldDefinitionSha256}</code></div>
      </section>

      {detail.status === "completed" && <section className="surface-card flex flex-wrap gap-3 p-5">
        <Link className="btn-primary" href={`/admin/signatures/${detail.id}/final`}>Descargar PDF firmado</Link>
        <Link className="btn-secondary" href={`/admin/signatures/${detail.id}/certificate`}>Descargar certificado</Link>
        <Link className="btn-secondary" href={`/admin/signatures/${detail.id}/evidence`}>Ver resumen de evidencia</Link>
      </section>}

      {process.env.NODE_ENV !== "production" &&
        process.env.SIGNING_ISOLATED_ENVIRONMENT === "true" &&
        detail.status !== "draft" &&
        detail.status !== "completed" && (
          <IsolatedDeliveryControl />
        )}

      {definition?.scope !== "ordinary_brokerage" && <section className="surface-card border-l-4 border-amber-500 p-5 text-sm text-amber-900">{definition?.guidance}</section>}
      {detail.status === "archived" ? <section className="surface-card p-5"><h2 className="text-lg font-semibold">Borrador archivado</h2><p className="mt-2 text-sm text-slate-600">Está fuera de la vista operativa. La evidencia histórica se conserva y no puede volver al flujo de envío.</p></section> : <SignatureDraftEditor detail={detail} readiness={readiness} preflight={preflight} activationMode={activationMode} />}
    </AdminPageShell>
  );
}
