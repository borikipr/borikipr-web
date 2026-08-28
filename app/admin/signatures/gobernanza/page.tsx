import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { DetailSection, SectionHeader, SummaryCard } from "@/components/admin/AdminUI";
import StatusBadge from "@/components/admin/StatusBadge";
import { getAdminSession } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { getSignatureDocumentTypeDefinition } from "@/lib/signatures/document-classification";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { getSignatureGovernanceReadiness } from "@/lib/signatures/governance-readiness";
import { getSignatureOperationalSnapshot } from "@/lib/signatures/monitoring";
import { getSignatureRetentionPreview } from "@/lib/signatures/governance-workflow";
import { isProductionInternalCanaryCapabilityEnabled, isPublicSigningEnabled } from "@/lib/signatures/public-config";
import { inspectProductionPublicLaunchGate } from "@/lib/signatures/public-launch";
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

const READINESS_LABELS: Record<ReadinessState, string> = {
  PASS: "Listo",
  BLOCKED: "Bloqueado",
  WARNING: "Advertencia",
  DEFERRED: "Diferido",
  "NOT APPLICABLE": "No aplica",
};

function readinessVariant(state: ReadinessState) {
  if (state === "PASS") return "green" as const;
  if (state === "BLOCKED") return "red" as const;
  if (state === "WARNING") return "amber" as const;
  return "gray" as const;
}

function recordStateLabel(state: string) {
  return ({ approved: "Aprobado", active: "Activo", draft: "Borrador", pending: "Pendiente", pending_review: "En revisión", retired: "Retirado" } as Record<string, string>)[state] ?? state;
}

const OPERATIONAL_CHECKS: ReadonlyArray<Readonly<{
  label: string;
  state: ReadinessState;
  owner: string;
  evidence: string;
}>> = [
  { label: "DMARC del dominio remitente", state: "PASS", owner: "Operador DNS", evidence: "DMARC presente con p=none (monitoreo)." },
  { label: "Límites de cuenta de Resend", state: "WARNING", owner: "Operador Resend", evidence: "Cuenta Free verificada manualmente: 100/día y 3,000/mes; el API no expone el rate limit específico." },
  { label: "Simulacro habilitado de escritorio", state: "PASS", owner: "QA", evidence: "Flujo Chromium sintético habilitado completado en ambiente aislado." },
  { label: "Simulacro habilitado móvil/touch", state: "PASS", owner: "QA", evidence: "Touch real emulado, dibujo y finalización completados en ambiente aislado." },
  { label: "PDF máximo (25/8/100)", state: "PASS", owner: "Ingeniería", evidence: "Flujo real de navegador, finalización, PDF/certificado e integridad visual completados; interacción táctil genuina validada." },
  { label: "Retenciones legales persistentes", state: "PASS", owner: "Ingeniería / Admin", evidence: "Persistencia, prioridad sobre retención, liberación explícita e historial inmutable validados." },
  { label: "Puerta interna de canary", state: "PASS", owner: "Ingeniería / lanzamiento", evidence: "Separada de firma pública; exige bandera servidor, hash de readiness y autorización vigente con participante y clasificación exactos." },
  { label: "Flujo de mutación de gobernanza", state: "PASS", owner: "Ingeniería / Admin", evidence: "Borrador, revisión, aprobación interna normal, revisión externa opcional, confirmación fuerte e historial inmutable." },
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
  const [readiness, monitoring, retentionPreview, classifications, consents, privacy, retention, documents, legalHolds, launchAuthorizations, publicLaunchGate] = await Promise.all([
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
    inspectProductionPublicLaunchGate(database),
  ]);
  const publicFlag = isPublicSigningEnabled();
  const internalCanaryEnabled = isProductionInternalCanaryCapabilityEnabled();
  const neonRecoveryProven = !publicLaunchGate.blockers.includes("neon_restore_unproven");
  const r2RecoveryProven = !publicLaunchGate.blockers.includes("r2_independent_recovery_unproven");
  const publicGateState: ReadinessState = publicLaunchGate.allowed ? "PASS" : "BLOCKED";
  const recoveryChecks: ReadonlyArray<Readonly<{ label: string; state: ReadinessState; owner: string; evidence: string }>> = [
    { label: "Restauración aislada de Neon", state: neonRecoveryProven ? "PASS" : "BLOCKED", owner: "Operador Neon", evidence: neonRecoveryProven ? "Prueba de recuperación registrada y aceptada por la puerta canónica." : "Falta evidencia de recuperación válida para la puerta pública." },
    { label: "Recuperación independiente de objetos R2", state: r2RecoveryProven ? "PASS" : "BLOCKED", owner: "Operador Cloudflare", evidence: r2RecoveryProven ? "Prueba independiente registrada y aceptada por la puerta canónica." : "Falta evidencia independiente de recuperación válida para la puerta pública." },
  ];
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
    ...recoveryChecks,
    { label: "Lanzamiento público", state: publicGateState, owner: "Propietario / lanzamiento", evidence: publicLaunchGate.allowed ? "Bandera, autorización pública, hash de readiness y controles canónicos vigentes." : `Bloqueado por: ${publicLaunchGate.blockers.join(", ") || "un control canónico pendiente"}.` },
    ...OPERATIONAL_CHECKS,
  ];
  return <AdminPageShell>
    <AdminPageHeader breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/signatures", label: "Firmas" }, { label: "Gobernanza" }]} eyebrow="Firmas" title="Gobernanza" description="Configura las decisiones humanas necesarias sin habilitar la firma." actions={<Link className="btn-secondary" href="/admin/signatures">Volver a solicitudes</Link>} />

    <nav aria-label="Secciones de gobernanza" className="surface-card flex flex-wrap gap-1.5 p-2 text-sm font-semibold">
      {[['documentos','Documentos permitidos'],['consentimiento','Consentimiento'],['privacidad','Privacidad'],['retencion','Retención'],['recuperacion','Recuperación'],['activacion','Activación']].map(([id,label])=><a className="shrink-0 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href={`#${id}`} key={id}>{label}</a>)}
    </nav>

    <section className="surface-card overflow-hidden">
      <SectionHeader title="Preparación para canary interno" description="Resumen en español. Preparado no significa habilitado." action={<StatusBadge variant={readiness.spanishCanaryReady ? "green" : "red"}>{readiness.spanishCanaryReady ? "Listo" : "Bloqueado"}</StatusBadge>} />
      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div><h3 className="font-semibold">Lo que falta</h3>{readiness.spanishCanaryBlockers.length ? <ul className="mt-2 space-y-2 text-sm text-slate-700">{readiness.spanishCanaryBlockers.map((blocker)=><li className="flex gap-2" key={blocker}><span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />{BLOCKERS[blocker] ?? "Hay un control pendiente que requiere revisión del operador."}</li>)}</ul> : <p className="mt-2 text-sm text-emerald-800">La gobernanza configurada satisface este alcance.</p>}</div>
        <div className="rounded-xl bg-slate-50 p-4 text-sm"><p className="font-semibold text-slate-950">Alcance bilingüe</p><p className="mt-1 text-slate-600">Incluir inglés requiere también consentimiento y privacidad en en-US.</p><details className="mt-3"><summary className="cursor-pointer font-semibold">Ver estado bilingüe</summary><ul className="mt-2 space-y-1 text-slate-600">{readiness.bilingualCanaryBlockers.map((blocker)=><li key={blocker}>{BLOCKERS[blocker] ?? "Control pendiente."}</li>)}</ul></details></div>
      </div>
    </section>

    <section className="scroll-mt-24 space-y-4" id="documentos">
      <SectionHeader title="Documentos permitidos" description="Aprobación interna para documentos ordinarios; revisión externa sólo cuando corresponda." />
      <div className="surface-card overflow-hidden"><div className="overflow-x-auto"><table className="admin-table min-w-[640px]"><thead><tr><th>Documento</th><th>Estado</th><th>Fuente de aprobación</th><th>Vigencia</th></tr></thead><tbody>{readiness.approvals.map((row,index)=>{const definition=getSignatureDocumentTypeDefinition(row.document_type);return <tr key={`${row.document_type}-${index}`}><td><span className="font-semibold">{definition?.label ?? "Clasificación de documento"}</span><details className="mt-1 text-xs text-slate-500"><summary className="cursor-pointer">Detalles avanzados</summary><code>{row.document_type}</code></details></td><td><StatusBadge variant={row.status === "approved" ? "green" : "gray"}>{recordStateLabel(row.status)}</StatusBadge></td><td>{row.approval_mode === "internal_business" ? "Aprobación interna" : row.approval_mode === "external_review" ? "Revisión externa" : "Fuera de alcance"}</td><td>{row.effective_from ? new Date(row.effective_from).toLocaleDateString("es-PR") : "No vigente"}</td></tr>})}{readiness.approvals.length===0&&<tr><td className="text-slate-500" colSpan={4}>No hay decisiones de clasificación registradas.</td></tr>}</tbody></table></div></div>
    </section>

    <div className="grid gap-5 xl:grid-cols-2">
      <section className="scroll-mt-24 space-y-3" id="consentimiento"><SectionHeader title="Consentimiento" description="Texto exacto, versión y fecha efectiva por idioma."/><div className="surface-card divide-y divide-slate-100">{readiness.consentSlots.map((slot)=>{const row=readiness.consents.find((item)=>item.locale===slot.locale);return <article className="flex items-center justify-between gap-4 p-4" key={slot.locale}><div><h3 className="font-semibold">{slot.locale === "es-PR" ? "Español (Puerto Rico)" : "English (United States)"}</h3><p className="text-sm text-slate-500">{row ? `Versión ${row.version_identifier}` : "Sin versión aprobada"}</p>{row&&<details className="mt-1 text-xs text-slate-500"><summary>Detalles avanzados</summary><code className="break-all">{row.consent_text_sha256}</code></details>}</div><StatusBadge variant={slot.approved?"green":"red"}>{slot.approved?"Listo":"Bloqueado"}</StatusBadge></article>})}</div></section>
      <section className="scroll-mt-24 space-y-3" id="privacidad"><SectionHeader title="Privacidad" description="La evidencia de firma se vincula a la versión aprobada por idioma."/><div className="surface-card p-5">{readiness.privacyDisclosure.configured&&readiness.privacyDisclosure.disclosure?<><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">Versión {readiness.privacyDisclosure.disclosure.version}</p><p className="text-sm text-slate-500">Snapshot bilingüe inmutable</p></div><StatusBadge variant="green">Listo</StatusBadge></div><DetailSection title="Detalles avanzados"><dl className="space-y-2 font-mono text-xs"><div><dt>es-PR SHA-256</dt><dd className="break-all">{readiness.privacyDisclosure.disclosure.locales["es-PR"].sha256}</dd></div><div><dt>en-US SHA-256</dt><dd className="break-all">{readiness.privacyDisclosure.disclosure.locales["en-US"].sha256}</dd></div></dl></DetailSection></>:<div className="flex items-center justify-between gap-4"><p className="text-sm text-slate-600">No hay una divulgación aprobada y vigente.</p><StatusBadge variant="red">Bloqueado</StatusBadge></div>}</div></section>
    </div>

    <section className="scroll-mt-24 space-y-3" id="retencion"><SectionHeader title="Retención" description="La ausencia de una política válida mantiene toda limpieza desactivada."/><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]"><div className="surface-card p-5">{readiness.retention.configured&&readiness.retention.policy?<><div className="flex items-center justify-between"><p className="font-semibold">Versión {readiness.retention.policy.version}</p><StatusBadge variant="green">Activa</StatusBadge></div><dl className="admin-meta-grid mt-4 text-sm"><div><dt>PDF completado</dt><dd>{readiness.retention.policy.completedCleanupEnabled?`${readiness.retention.policy.completedPdfDays} días`:"Preservación"}</dd></div><div><dt>Tokens</dt><dd>{readiness.retention.policy.tokenDays} días</dd></div><div><dt>Sesiones</dt><dd>{readiness.retention.policy.sessionHours} horas</dd></div></dl></>:<div className="flex items-center justify-between gap-4"><p className="text-sm text-slate-600">No hay política aprobada y activa.</p><StatusBadge variant="red">Bloqueado</StatusBadge></div>}</div><div className="surface-card p-5"><h3 className="font-semibold">Vista previa agregada</h3><p className="mt-1 text-xs text-slate-500">No elimina ni modifica registros.</p><dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5"><SummaryCard label="Borradores" value={retentionPreview.drafts}/><SummaryCard label="Sesiones" value={retentionPreview.sessions}/><SummaryCard label="Tokens" value={retentionPreview.tokens}/><SummaryCard label="Protegidos" value={retentionPreview.completed}/><SummaryCard label="Retenciones legales" value={retentionPreview.legal_holds}/></dl></div></div></section>

    <section className="scroll-mt-24 space-y-3" id="recuperacion"><SectionHeader title="Recuperación" description="Evidencia operacional verificada contra la puerta pública canónica."/><div className="grid gap-3 md:grid-cols-2">{recoveryChecks.map((item)=><article className="surface-card p-5" key={item.label}><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{item.label}</h3><StatusBadge variant={readinessVariant(item.state)}>{READINESS_LABELS[item.state]}</StatusBadge></div><p className="mt-3 text-sm text-slate-600">{item.evidence}</p><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Responsable: {item.owner}</p></article>)}</div></section>

    <section className="scroll-mt-24 space-y-3" id="activacion"><SectionHeader title="Activación" description="Canary interno y firma pública conservan autorizaciones independientes."/><div className="grid gap-4 md:grid-cols-2"><article className="surface-card border-l-4 border-amber-500 p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Canary interno</h3><StatusBadge variant={internalCanaryEnabled ? "amber" : "gray"}>{internalCanaryEnabled ? "Activo con validación" : "Desactivado"}</StatusBadge></div><p className="mt-2 text-sm text-slate-600">Requiere autorización vigente, alcance exacto, readiness hash y bandera servidor.</p></article><article className="surface-card border-l-4 border-slate-400 p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Firma pública</h3><StatusBadge variant={readinessVariant(publicGateState)}>{publicLaunchGate.allowed ? "Activa" : publicFlag ? "Habilitada · bloqueada" : "Desactivada"}</StatusBadge></div><p className="mt-2 text-sm text-slate-600">{publicLaunchGate.allowed ? "La autorización pública y el readiness actual coinciden con la configuración de producción." : "La puerta pública permanece cerrada hasta que todos sus controles canónicos coincidan."}</p></article></div></section>

    <GovernanceForms drafts={governanceDrafts} />

    <DetailSection title="Matriz completa de preparación"><div className="overflow-x-auto"><table className="admin-table min-w-[760px]"><thead><tr><th>Control</th><th>Estado</th><th>Responsable</th><th>Evidencia</th></tr></thead><tbody>{launchChecks.map((item)=><tr key={item.label}><td className="font-medium">{item.label}</td><td><StatusBadge variant={readinessVariant(item.state)}>{READINESS_LABELS[item.state]}</StatusBadge></td><td>{item.owner}</td><td className="text-slate-600">{item.evidence}</td></tr>)}</tbody></table></div></DetailSection>
    <DetailSection title="Monitoreo agregado"><dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">{Object.entries(monitoring).map(([label,value])=><SummaryCard key={label} label={label.replaceAll("_"," ")} value={value}/>)}</dl></DetailSection>
    <DetailSection title="Procedimientos de soporte"><div className="grid gap-3 md:grid-cols-2">{SUPPORT.map(([title,procedure])=><article className="rounded-xl bg-slate-50 p-4" key={title}><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm text-slate-600">{procedure}</p></article>)}</div></DetailSection>
  </AdminPageShell>;
}
