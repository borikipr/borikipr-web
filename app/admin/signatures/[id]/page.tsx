import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SignatureDraftEditor from "@/components/admin/signatures/SignatureDraftEditor";
import IsolatedDeliveryControl from "@/components/admin/signatures/IsolatedDeliveryControl";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createSignatureAdminRepository } from "@/lib/signatures/admin-repository";
import { getSignatureDocumentTypeDefinition, isSignatureDocumentTypeApproved } from "@/lib/signatures/document-classification";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { evaluateSignatureSendReadiness } from "@/lib/signatures/send-readiness";
import { isPublicSigningEnabled } from "@/lib/signatures/public-config";
import { getSignatureSecurityConfig } from "@/lib/signatures/config";
import { inspectSignatureRetentionPolicy } from "@/lib/signatures/retention-policy";
import { inspectSignaturePrivacyDisclosure } from "@/lib/signatures/privacy-disclosure";

export default async function SignatureDraftPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSessionUser())) redirect("/admin/login");
  const { id } = await params;
  const repository = createSignatureAdminRepository(createPostgresSignatureDatabase(sql));
  const detail = await repository.detail(id);
  if (!detail) notFound();
  const definition = getSignatureDocumentTypeDefinition(detail.documentType);
  const approved = definition ? isSignatureDocumentTypeApproved(definition) : false;
  let keysConfigured = false;
  try { getSignatureSecurityConfig(); keysConfigured = true; } catch { keysConfigured = false; }
  const readiness = await evaluateSignatureSendReadiness({
    database: createPostgresSignatureDatabase(sql), documentId: id, locale: "es-PR",
    publicSigningEnabled: isPublicSigningEnabled(), eventKeysConfigured: keysConfigured,
    retentionPolicyConfigured: inspectSignatureRetentionPolicy().configured,
    privacyDisclosureConfigured: inspectSignaturePrivacyDisclosure().configured,
  });

  return (
    <AdminPageShell>
      <AdminPageHeader breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/signatures", label: "Firmas" }, { label: detail.title }]} eyebrow="Firmas · Ensamblaje" title={detail.title} description="Vista privada del PDF fuente y su definición de campos. El documento original no se modifica durante la preparación." actions={<Link className="btn-secondary" href={`/admin/signatures/${detail.id}/source`} target="_blank">Abrir PDF privado</Link>} />

      <section className="surface-card grid gap-4 p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="font-semibold text-[#555]">Compatibilidad</p><p className="mt-1 text-green-700">PDF validado</p></div>
        <div><p className="font-semibold text-[#555]">Clasificación legal</p><p className={`mt-1 ${approved ? "text-green-700" : "text-amber-800"}`}>{definition?.classification ?? "Desconocida"} · {approved ? "Aprobado" : "Pendiente"}</p></div>
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

      <SignatureDraftEditor detail={detail} readiness={readiness} />
    </AdminPageShell>
  );
}
