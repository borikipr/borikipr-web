import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { getAdminSession } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { getSignatureGovernanceReadiness } from "@/lib/signatures/governance-readiness";
import { getSignatureOperationalSnapshot } from "@/lib/signatures/monitoring";
import { getSignatureRetentionPreview } from "@/lib/signatures/governance-workflow";
import { GovernanceForms } from "./GovernanceForms";

export const dynamic = "force-dynamic";

const BLOCKERS: Record<string, string> = {
  document_classification_approval_missing: "No existe una clasificación de documento aprobada para firma electrónica.",
  approved_consent_es_pr_missing: "Falta consentimiento aprobado en español (es-PR).",
  approved_consent_en_us_missing: "Falta consentimiento aprobado en inglés (en-US).",
  approved_privacy_es_pr_missing: "Falta divulgación de privacidad aprobada para español (es-PR).",
  approved_privacy_en_us_missing: "Falta divulgación de privacidad aprobada para inglés (en-US).",
  retention_policy_missing: "Falta una política aprobada de retención y privacidad.",
  event_keys_unavailable: "La configuración histórica de claves de evidencia no está completa.",
  public_signing_disabled: "La firma pública permanece desactivada.",
};

type ReadinessState = "PASS" | "BLOCKED" | "WARNING" | "DEFERRED" | "NOT APPLICABLE";

const OPERATIONAL_CHECKS: ReadonlyArray<Readonly<{
  label: string;
  state: ReadinessState;
  owner: string;
  evidence: string;
}>> = [
  { label: "DMARC del dominio remitente", state: "PASS", owner: "Operador DNS", evidence: "DMARC presente con p=none (monitoreo)." },
  { label: "Límites de cuenta de Resend", state: "WARNING", owner: "Operador Resend", evidence: "Cuenta Free verificada manualmente: 100/día y 3,000/mes; el API no expone el rate limit específico." },
  { label: "Restauración aislada de Neon", state: "BLOCKED", owner: "Operador Neon", evidence: "Falta una restauración real en rama/base aislada; las pruebas de migración no sustituyen un restore." },
  { label: "Recuperación de objetos R2", state: "WARNING", owner: "Operador Cloudflare", evidence: "Copia privada controlada y restauración byte por byte probadas con objeto sintético; falta respaldo independiente del mismo bucket/cuenta." },
  { label: "Simulacro habilitado de escritorio", state: "PASS", owner: "QA", evidence: "Flujo Chromium sintético habilitado completado en ambiente aislado." },
  { label: "Simulacro habilitado móvil/touch", state: "PASS", owner: "QA", evidence: "Touch real emulado, dibujo y finalización completados en ambiente aislado." },
  { label: "PDF máximo (25/8/100)", state: "PASS", owner: "Ingeniería", evidence: "Flujo real de navegador, finalización, PDF/certificado e integridad visual completados; touch genuino validado en Phase 2L." },
  { label: "Retenciones legales persistentes", state: "PASS", owner: "Ingeniería / Admin", evidence: "Persistencia, prioridad sobre retención, liberación explícita e historial inmutable validados." },
  { label: "Puerta interna de canary", state: "PASS", owner: "Ingeniería / lanzamiento", evidence: "Separada de firma pública; exige bandera servidor, hash de readiness y autorización vigente con participante y clasificación exactos." },
  { label: "Flujo de mutación de gobernanza", state: "PASS", owner: "Ingeniería / Admin", evidence: "Borrador, revisión, aprobación interna normal, revisión externa opcional, confirmación fuerte e historial inmutable." },
  { label: "Autorización de canary de producción", state: "BLOCKED", owner: "Propietario / operador", evidence: "Infraestructura de alcance y expiración disponible; no existe autorización de producción y no se creó en esta fase." },
  { label: "Autorización de lanzamiento público", state: "BLOCKED", owner: "Propietario / legal", evidence: "READY no equivale a ENABLED; requiere autorización humana separada." },
];

const SUPPORT = [
  ["No recibió o perdió la invitación", "Confirmar el estado de entrega y usar Reemitir; nunca copiar un enlace anterior."],
  ["Enlace expirado o reenviado", "Expirar/revocar la solicitud o reemitir un token nuevo. El enlace anterior queda inválido."],
  ["Correo incorrecto", "No reescribir la identidad enviada. Anular la solicitud y preparar una nueva con la identidad correcta."],
  ["Participante declina", "Registrar el rechazo y detener su acceso; escalar al responsable del contrato."],
  ["Sesión expirada", "Volver a la invitación vigente para una sesión nueva; los campos ya confirmados conservan su evidencia."],
  ["Falla de Resend", "El intento queda fallido y su token se revoca. Revisar el proveedor y reemitir explícitamente."],
  ["Falla de finalización o integridad R2", "Detener entrega, conservar evidencia, revisar hashes y escalar. Nunca sustituir el PDF manualmente."],
  ["No puede descargar un documento completado", "Verificar estado/hash y emitir acceso de finalización nuevo; no crear URL pública."],
] as const;

export default async function SignatureGovernancePage() {
  if (!(await getAdminSession())) redirect("/admin/login");
  const database = createPostgresSignatureDatabase(sql);
  const [readiness, monitoring, retentionPreview, classifications, consents, privacy, retention, documents, legalHolds, launchAuthorizations] = await Promise.all([
    getSignatureGovernanceReadiness(database),
    getSignatureOperationalSnapshot(database),
    getSignatureRetentionPreview(database),
    database.unsafe<{id:string;document_type:string;version_number:number;status:string}>(`SELECT id::text,document_type,version_number,status FROM signature_document_type_approvals WHERE status IN ('draft','pending') ORDER BY created_at DESC`),
    database.unsafe<{id:string;version_identifier:string;locale:string;status:string;consent_text:string;consent_text_sha256:string}>(`SELECT id::text,version_identifier,locale,status,consent_text,consent_text_sha256 FROM signature_consent_versions WHERE status IN ('draft','pending_review') ORDER BY created_at DESC`),
    database.unsafe<{id:string;version_identifier:string;status:string;es_pr_text:string;en_us_text:string;es_pr_sha256:string;en_us_sha256:string}>(`SELECT id::text,version_identifier,status,es_pr_text,en_us_text,es_pr_sha256,en_us_sha256 FROM signature_privacy_disclosure_versions WHERE status IN ('draft','pending_review') ORDER BY created_at DESC`),
    database.unsafe<{id:string;version_identifier:string;status:string;policy_sha256:string|null}>(`SELECT id::text,version_identifier,status,policy_sha256 FROM signature_retention_policy_versions WHERE status IN ('draft','pending_review','approved') ORDER BY created_at DESC`),
    database.unsafe<{id:string;title:string;status:string;document_type:string;participant_emails:string[]}>(`SELECT d.id::text,d.title,d.status,d.document_type,coalesce(array_agg(p.normalized_email ORDER BY p.normalized_email) FILTER (WHERE p.id IS NOT NULL),ARRAY[]::text[]) participant_emails FROM signature_documents d LEFT JOIN signature_document_versions v ON v.id=d.active_version_id LEFT JOIN signature_participants p ON p.document_version_id=v.id WHERE d.status='draft' GROUP BY d.id,d.title,d.status,d.document_type,d.created_at ORDER BY d.created_at DESC LIMIT 100`),
    database.unsafe<{id:string;reason_reference:string}>(`SELECT id::text,reason_reference FROM signature_legal_holds WHERE status='active' ORDER BY created_at DESC`),
    database.unsafe<{id:string;expires_at:Date}>(`SELECT id::text,expires_at FROM signature_launch_authorizations WHERE environment='production' AND authorization_type='internal_canary' AND status='active' AND expires_at>now() ORDER BY authorized_at DESC`),
  ]);
  const governanceDrafts = {
    classifications: classifications.map((row) => ({ id: row.id, label: `${row.document_type} v${row.version_number} · ${row.status}`, status: row.status })),
    consents: consents.map((row) => ({ id: row.id, label: `${row.locale} · ${row.version_identifier} · ${row.status}`, status: row.status,reviewText:row.consent_text,reviewHash:row.consent_text_sha256 })),
    privacy: privacy.map((row) => ({ id: row.id, label: `${row.version_identifier} · ${row.status}`, status: row.status,reviewText:`es-PR\n${row.es_pr_text}\n\nen-US\n${row.en_us_text}`,reviewHash:`es-PR ${row.es_pr_sha256} / en-US ${row.en_us_sha256}` })),
    retention: retention.map((row) => ({ id: row.id, label: `${row.version_identifier} · ${row.status}${row.policy_sha256?` · ${row.policy_sha256.slice(0,12)}…`:""}`, status: row.status })),
    documents: documents.map(row=>({id:row.id,label:`${row.title} · ${row.status}`,documentType:row.document_type,participantEmails:row.participant_emails})),
    legalHolds: legalHolds.map(row=>({id:row.id,label:row.reason_reference})),
    launchAuthorizations:launchAuthorizations.map(row=>({id:row.id,label:`Canary · expira ${new Date(row.expires_at).toLocaleString("es-PR")}`})),
  };
  const launchChecks: ReadonlyArray<Readonly<{ label: string; state: ReadinessState; owner: string; evidence: string }>> = [
    { label: "Clasificaciones aprobadas para firma electrónica", state: readiness.activeApprovalCount > 0 ? "PASS" as const : "BLOCKED" as const, owner: "Erickson Real Estate / operador autorizado", evidence: readiness.activeApprovalCount > 0 ? `${readiness.activeApprovalCount} aprobación(es) vigente(s).` : "No existen aprobaciones vigentes. Los documentos ordinarios pueden seguir la aprobación interna; las formalidades externas se evalúan por documento." },
    ...readiness.consentSlots.map((slot) => ({ label: `Consentimiento ${slot.locale}`, state: slot.approved ? "PASS" as const : "BLOCKED" as const, owner: "Erickson Real Estate / revisión externa opcional", evidence: slot.approved ? "Versión aprobada y vigente." : "Falta texto exacto, referencia, fecha efectiva y aprobación humana." })),
    ...readiness.privacySlots.map((slot) => ({ label: `Privacidad ${slot.locale}`, state: slot.approved ? "PASS" as const : "BLOCKED" as const, owner: "Privacidad / operador autorizado", evidence: slot.approved ? "Texto aprobado, vigente y ligado a un snapshot bilingüe inmutable." : "Falta una versión aprobada y vigente que incluya este locale." })),
    { label: "Política de retención", state: readiness.retention.configured ? "PASS" as const : "BLOCKED" as const, owner: "Legal / negocio / operador", evidence: readiness.retention.configured ? "Configuración validada; evidencia completada protegida según política." : "La ausencia mantiene toda limpieza desactivada y bloquea lanzamiento." },
    { label: "Bandera de firma pública desactivada", state: readiness.publicSigningEnabled ? "WARNING" as const : "PASS" as const, owner: "Propietario / lanzamiento", evidence: readiness.publicSigningEnabled ? "Habilitada; revisar autorización inmediatamente." : "Desactivada. READY no equivale a ENABLED." },
    ...OPERATIONAL_CHECKS,
  ];
  return <AdminPageShell>
    <AdminPageHeader breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/signatures", label: "Firmas" }, { label: "Gobernanza" }]} eyebrow="Firmas · Preparación operativa" title="Gobernanza y preparación de lanzamiento" description="Vista agregada y privada. Ningún estado en esta pantalla habilita por sí solo la firma pública." actions={<Link className="btn-secondary" href="/admin/signatures">Volver a solicitudes</Link>} />

    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      <section className={`surface-card min-w-0 border-l-4 p-5 ${readiness.spanishCanaryReady ? "border-green-600" : "border-amber-500"}`}>
        <h2 className="text-lg font-semibold">Canary sólo en español: {readiness.spanishCanaryReady ? "preparado" : "bloqueado"}</h2>
        <p className="mt-2 text-sm text-slate-600">Evalúa es-PR únicamente. No exige consentimiento en-US si el canary no incluye inglés.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{readiness.spanishCanaryBlockers.map((blocker) => <li key={blocker}>{BLOCKERS[blocker] ?? "Hay un control pendiente que requiere revisión del operador."}</li>)}</ul>
      </section>
      <section className={`surface-card min-w-0 border-l-4 p-5 ${readiness.bilingualCanaryReady ? "border-green-600" : "border-amber-500"}`}>
        <h2 className="text-lg font-semibold">Canary bilingüe: {readiness.bilingualCanaryReady ? "preparado" : "bloqueado"}</h2>
        <p className="mt-2 text-sm text-slate-600">Exige gobernanza vigente tanto para es-PR como para en-US.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{readiness.bilingualCanaryBlockers.map((blocker) => <li key={blocker}>{BLOCKERS[blocker] ?? "Hay un control pendiente que requiere revisión del operador."}</li>)}</ul>
      </section>
    </div>

    <div className="grid min-w-0 gap-6 xl:grid-cols-2">
      <section className="surface-card overflow-hidden"><h2 className="p-5 text-lg font-semibold">Clasificaciones de documentos</h2><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead className="bg-slate-950 text-left text-white"><tr><th className="p-3">Tipo</th><th className="p-3">Estado</th><th className="p-3">Modo</th><th className="p-3">Vigencia</th></tr></thead><tbody>{readiness.approvals.map((row, index) => <tr className="border-b" key={`${row.document_type}-${index}`}><td className="p-3">{row.document_type}</td><td className="p-3">{row.status}</td><td className="p-3">{row.approval_mode === "internal_business" ? "Aprobación interna" : row.approval_mode === "external_review" ? "Revisión externa" : "Fuera de alcance"}</td><td className="p-3">{row.effective_from ? new Date(row.effective_from).toLocaleDateString("es-PR") : "No vigente"}</td></tr>)}{readiness.approvals.length === 0 && <tr><td className="p-5 text-[#555]" colSpan={4}>No hay decisiones de clasificación registradas.</td></tr>}</tbody></table></div></section>
      <section className="surface-card overflow-hidden"><h2 className="p-5 text-lg font-semibold">Consentimientos</h2><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="bg-slate-950 text-left text-white"><tr><th className="p-3">Locale</th><th className="p-3">Versión</th><th className="p-3">Estado</th><th className="p-3">SHA-256</th></tr></thead><tbody>{readiness.consents.map((row) => <tr className="border-b" key={`${row.locale}-${row.version_identifier}`}><td className="p-3">{row.locale}</td><td className="p-3">{row.version_identifier}</td><td className="p-3">{row.status}</td><td className="max-w-40 truncate p-3 font-mono text-xs" title={row.consent_text_sha256}>{row.consent_text_sha256}</td></tr>)}{readiness.consentSlots.map((slot) => !readiness.consents.some((row) => row.locale === slot.locale) && <tr className="border-b" key={slot.locale}><td className="p-3">{slot.locale}</td><td className="p-3">Sin versión</td><td className="p-3">pendiente</td><td className="p-3">—</td></tr>)}</tbody></table></div></section>
    </div>

    <section className="surface-card p-5"><h2 className="text-lg font-semibold">Política de retención</h2>{readiness.retention.configured && readiness.retention.policy ? <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="font-semibold">Versión</dt><dd>{readiness.retention.policy.version}</dd></div><div><dt className="font-semibold">PDF completado</dt><dd>{readiness.retention.policy.completedCleanupEnabled ? `${readiness.retention.policy.completedPdfDays} días` : "Preservación; limpieza desactivada"}</dd></div><div><dt className="font-semibold">Tokens</dt><dd>{readiness.retention.policy.tokenDays} días</dd></div><div><dt className="font-semibold">Sesiones</dt><dd>{readiness.retention.policy.sessionHours} horas</dd></div></dl> : <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No hay política aprobada configurada. La limpieza de evidencia completada permanece desactivada.</p>}</section>

    <section className="surface-card p-5"><h2 className="text-lg font-semibold">Divulgación de privacidad para firmantes</h2>{readiness.privacyDisclosure.configured && readiness.privacyDisclosure.disclosure ? <dl className="mt-4 grid min-w-0 gap-3 text-sm sm:grid-cols-3"><div className="min-w-0"><dt className="font-semibold">Versión</dt><dd className="break-words">{readiness.privacyDisclosure.disclosure.version}</dd></div><div className="min-w-0"><dt className="font-semibold">es-PR SHA-256</dt><dd className="truncate font-mono text-xs">{readiness.privacyDisclosure.disclosure.locales["es-PR"].sha256}</dd></div><div className="min-w-0"><dt className="font-semibold">en-US SHA-256</dt><dd className="truncate font-mono text-xs">{readiness.privacyDisclosure.disclosure.locales["en-US"].sha256}</dd></div></dl> : <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No configurada. Debe existir texto aprobado y versionado en ambos idiomas antes del lanzamiento.</p>}</section>

    <section className="surface-card overflow-hidden"><h2 className="p-5 text-lg font-semibold">Matriz de preparación operativa</h2><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-950 text-left text-white"><tr><th className="p-3">Control</th><th className="p-3">Estado</th><th className="p-3">Responsable</th><th className="p-3">Evidencia pendiente/actual</th></tr></thead><tbody>{launchChecks.map((item) => <tr className="border-b" key={item.label}><td className="p-3 font-medium">{item.label}</td><td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{item.state}</span></td><td className="p-3">{item.owner}</td><td className="p-3 text-[#555]">{item.evidence}</td></tr>)}</tbody></table></div></section>

    <section className="surface-card p-5"><h2 className="text-lg font-semibold">Alcance y pasos del operador</h2><p className="mt-3 text-sm">Borikí Signing sirve documentos operacionales del corretaje de Erickson Real Estate. No sustituye cierres, escrituras, instrumentos notariales ni formalidades externas.</p><ol className="mt-4 list-decimal space-y-2 pl-5 text-sm"><li>Crear la clasificación y documentar su uso dentro del flujo de corretaje.</li><li>Para documentos ordinarios, registrar la aprobación interna de Erickson Real Estate. La revisión externa es opcional y debe registrarse solo si realmente ocurrió.</li><li>Marcar fuera de alcance cualquier versión que pertenezca al cierre o requiera una formalidad externa no cubierta.</li><li>Crear versiones independientes del consentimiento y la privacidad con el texto exacto aprobado.</li><li>Verificar los hashes, referencias y fechas efectivas. Para corregir texto aprobado, crear una versión nueva; nunca editar la anterior.</li><li>La preparación del borrador, la aprobación de gobernanza y la activación de firma son controles separados.</li></ol></section>

    <section className="surface-card p-5"><h2 className="text-lg font-semibold">Vista previa de retención (solo agregados)</h2><p className="mt-2 text-sm text-slate-600">Calculada {new Date(retentionPreview.asOf).toLocaleString("es-PR")}. Esta vista no elimina ni modifica registros.</p><dl className="mt-4 grid gap-3 sm:grid-cols-5"><div><dt>Borradores</dt><dd className="text-xl font-semibold">{retentionPreview.drafts}</dd></div><div><dt>Sesiones activas</dt><dd className="text-xl font-semibold">{retentionPreview.sessions}</dd></div><div><dt>Tokens activos</dt><dd className="text-xl font-semibold">{retentionPreview.tokens}</dd></div><div><dt>Completados protegidos</dt><dd className="text-xl font-semibold">{retentionPreview.completed}</dd></div><div><dt>Retenciones legales</dt><dd className="text-xl font-semibold">{retentionPreview.legal_holds}</dd></div></dl></section>

    <GovernanceForms drafts={governanceDrafts} />

    <section className="surface-card p-5"><h2 className="text-lg font-semibold">Monitoreo agregado</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">{Object.entries(monitoring).map(([label, value]) => <div className="rounded-lg border p-3" key={label}><dt className="font-semibold">{label.replaceAll("_", " ")}</dt><dd className="mt-1 text-2xl">{value}</dd></div>)}</dl></section>

    <section className="surface-card p-5"><h2 className="text-lg font-semibold">Procedimientos de soporte</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{SUPPORT.map(([title, procedure]) => <article className="rounded-lg border p-4" key={title}><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm text-[#555]">{procedure}</p></article>)}</div></section>
  </AdminPageShell>;
}
