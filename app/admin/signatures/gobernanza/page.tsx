import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { getSignatureGovernanceReadiness } from "@/lib/signatures/governance-readiness";
import { getSignatureOperationalSnapshot } from "@/lib/signatures/monitoring";

export const dynamic = "force-dynamic";

const BLOCKERS: Record<string, string> = {
  counsel_approval_missing: "No existe una clasificación documental aprobada por asesoría legal.",
  approved_consent_es_pr_missing: "Falta consentimiento aprobado en español (es-PR).",
  approved_consent_en_us_missing: "Falta consentimiento aprobado en inglés (en-US).",
  retention_policy_missing: "Falta una política aprobada de retención y privacidad.",
  privacy_disclosure_missing: "Falta una divulgación de privacidad de firma, versionada y aprobada, en es-PR y en-US.",
  event_keys_unavailable: "La configuración histórica de claves de evidencia no está completa.",
  public_signing_disabled: "La firma pública permanece desactivada.",
};

type ReadinessState = "READY" | "BLOCKED" | "NOT CONFIGURED" | "REQUIRES LEGAL APPROVAL" | "REQUIRES OPERATOR ACTION";

const OPERATIONAL_CHECKS: ReadonlyArray<Readonly<{
  label: string;
  state: ReadinessState;
  owner: string;
  evidence: string;
}>> = [
  { label: "DMARC del dominio remitente", state: "REQUIRES OPERATOR ACTION", owner: "Operador DNS", evidence: "Verificar y documentar el registro antes del canary." },
  { label: "Límites de cuenta de Resend", state: "REQUIRES OPERATOR ACTION", owner: "Operador Resend", evidence: "Settings → Usage; registrar cuota diaria, mensual y rate limit." },
  { label: "Restauración aislada de Neon", state: "BLOCKED", owner: "Operador Neon", evidence: "Falta una restauración real en rama/base aislada; las pruebas de migración no sustituyen un restore." },
  { label: "Recuperación de objetos R2", state: "BLOCKED", owner: "Operador Cloudflare", evidence: "La durabilidad no recupera borrados; falta lock o copia independiente verificada." },
  { label: "Simulacro habilitado de escritorio", state: "REQUIRES OPERATOR ACTION", owner: "QA", evidence: "Requiere ambiente aislado con base y almacenamiento sintéticos." },
  { label: "Simulacro habilitado móvil/touch", state: "REQUIRES OPERATOR ACTION", owner: "QA", evidence: "Requiere ambiente aislado con base y almacenamiento sintéticos." },
  { label: "PDF máximo (25/8/100)", state: "READY", owner: "Ingeniería", evidence: "Topología y límites cubiertos por pruebas sintéticas automatizadas." },
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
  if (!(await getAdminSessionUser())) redirect("/admin/login");
  const database = createPostgresSignatureDatabase(sql);
  const [readiness, monitoring] = await Promise.all([
    getSignatureGovernanceReadiness(database),
    getSignatureOperationalSnapshot(database),
  ]);
  const launchChecks: ReadonlyArray<Readonly<{ label: string; state: ReadinessState; owner: string; evidence: string }>> = [
    { label: "Clasificaciones aprobadas por asesoría legal", state: readiness.activeApprovalCount > 0 ? "READY" as const : "REQUIRES LEGAL APPROVAL" as const, owner: "Abogado licenciado / operador", evidence: readiness.activeApprovalCount > 0 ? `${readiness.activeApprovalCount} aprobación(es) vigente(s).` : "No existen aprobaciones vigentes." },
    ...readiness.consentSlots.map((slot) => ({ label: `Consentimiento ${slot.locale}`, state: slot.approved ? "READY" as const : "REQUIRES LEGAL APPROVAL" as const, owner: "Abogado licenciado / operador", evidence: slot.approved ? "Versión aprobada y vigente." : "Falta texto exacto, referencia y aprobación." })),
    { label: "Divulgación de privacidad", state: readiness.privacyDisclosure.configured ? "READY" as const : "NOT CONFIGURED" as const, owner: "Legal / privacidad / operador", evidence: readiness.privacyDisclosure.configured ? "Ambos idiomas configurados con hashes." : "Falta texto versionado y aprobado en es-PR y en-US." },
    { label: "Política de retención", state: readiness.retention.configured ? "READY" as const : "NOT CONFIGURED" as const, owner: "Legal / negocio / operador", evidence: readiness.retention.configured ? "Configuración validada; evidencia completada protegida según política." : "La ausencia mantiene toda limpieza de evidencia completada desactivada." },
    { label: "Bandera de firma pública", state: readiness.publicSigningEnabled ? "READY" as const : "BLOCKED" as const, owner: "Propietario / lanzamiento", evidence: readiness.publicSigningEnabled ? "Habilitada." : "Desactivada; requiere autorización separada." },
    ...OPERATIONAL_CHECKS,
  ];
  return <AdminPageShell>
    <AdminPageHeader breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/signatures", label: "Firmas" }, { label: "Gobernanza" }]} eyebrow="Firmas · Preparación operativa" title="Gobernanza y preparación de lanzamiento" description="Vista agregada y privada. Ningún estado en esta pantalla habilita por sí solo la firma pública." actions={<Link className="btn-secondary" href="/admin/signatures">Volver a solicitudes</Link>} />

    <section className={`surface-card border-l-4 p-5 ${readiness.launchReady ? "border-green-600" : "border-amber-500"}`}>
      <h2 className="text-lg font-semibold">Estado general: {readiness.launchReady ? "preparado" : "bloqueado"}</h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{readiness.blockers.map((blocker) => <li key={blocker}>{BLOCKERS[blocker] ?? blocker}</li>)}</ul>
    </section>

    <div className="grid gap-6 xl:grid-cols-2">
      <section className="surface-card overflow-hidden"><h2 className="p-5 text-lg font-semibold">Clasificaciones documentales</h2><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="bg-slate-950 text-left text-white"><tr><th className="p-3">Tipo</th><th className="p-3">Estado</th><th className="p-3">Vigencia</th></tr></thead><tbody>{readiness.approvals.map((row, index) => <tr className="border-b" key={`${row.document_type}-${index}`}><td className="p-3">{row.document_type}</td><td className="p-3">{row.status}</td><td className="p-3">{row.effective_from ? new Date(row.effective_from).toLocaleDateString("es-PR") : "No vigente"}</td></tr>)}{readiness.approvals.length === 0 && <tr><td className="p-5 text-[#555]" colSpan={3}>No hay decisiones legales registradas.</td></tr>}</tbody></table></div></section>
      <section className="surface-card overflow-hidden"><h2 className="p-5 text-lg font-semibold">Consentimientos</h2><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="bg-slate-950 text-left text-white"><tr><th className="p-3">Locale</th><th className="p-3">Versión</th><th className="p-3">Estado</th><th className="p-3">SHA-256</th></tr></thead><tbody>{readiness.consents.map((row) => <tr className="border-b" key={`${row.locale}-${row.version_identifier}`}><td className="p-3">{row.locale}</td><td className="p-3">{row.version_identifier}</td><td className="p-3">{row.status}</td><td className="max-w-40 truncate p-3 font-mono text-xs" title={row.consent_text_sha256}>{row.consent_text_sha256}</td></tr>)}{readiness.consentSlots.map((slot) => !readiness.consents.some((row) => row.locale === slot.locale) && <tr className="border-b" key={slot.locale}><td className="p-3">{slot.locale}</td><td className="p-3">Sin versión</td><td className="p-3">pendiente</td><td className="p-3">—</td></tr>)}</tbody></table></div></section>
    </div>

    <section className="surface-card p-5"><h2 className="text-lg font-semibold">Política de retención</h2>{readiness.retention.configured && readiness.retention.policy ? <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="font-semibold">Versión</dt><dd>{readiness.retention.policy.version}</dd></div><div><dt className="font-semibold">PDF completado</dt><dd>{readiness.retention.policy.completedCleanupEnabled ? `${readiness.retention.policy.completedPdfDays} días` : "Preservación; limpieza desactivada"}</dd></div><div><dt className="font-semibold">Tokens</dt><dd>{readiness.retention.policy.tokenDays} días</dd></div><div><dt className="font-semibold">Sesiones</dt><dd>{readiness.retention.policy.sessionHours} horas</dd></div></dl> : <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No hay política aprobada configurada. La limpieza de evidencia completada permanece desactivada.</p>}</section>

    <section className="surface-card p-5"><h2 className="text-lg font-semibold">Divulgación de privacidad para firmantes</h2>{readiness.privacyDisclosure.configured && readiness.privacyDisclosure.disclosure ? <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="font-semibold">Versión</dt><dd>{readiness.privacyDisclosure.disclosure.version}</dd></div><div><dt className="font-semibold">es-PR SHA-256</dt><dd className="truncate font-mono text-xs">{readiness.privacyDisclosure.disclosure.locales["es-PR"].sha256}</dd></div><div><dt className="font-semibold">en-US SHA-256</dt><dd className="truncate font-mono text-xs">{readiness.privacyDisclosure.disclosure.locales["en-US"].sha256}</dd></div></dl> : <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No configurada. Debe existir texto aprobado y versionado en ambos idiomas antes del lanzamiento.</p>}</section>

    <section className="surface-card overflow-hidden"><h2 className="p-5 text-lg font-semibold">Matriz de preparación operativa</h2><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-950 text-left text-white"><tr><th className="p-3">Control</th><th className="p-3">Estado</th><th className="p-3">Responsable</th><th className="p-3">Evidencia pendiente/actual</th></tr></thead><tbody>{launchChecks.map((item) => <tr className="border-b" key={item.label}><td className="p-3 font-medium">{item.label}</td><td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{item.state}</span></td><td className="p-3">{item.owner}</td><td className="p-3 text-[#555]">{item.evidence}</td></tr>)}</tbody></table></div></section>

    <section className="surface-card p-5"><h2 className="text-lg font-semibold">Pasos del operador (sin fabricar aprobaciones)</h2><ol className="mt-4 list-decimal space-y-2 pl-5 text-sm"><li>Obtener del abogado licenciado la clasificación, decisión, referencia, fecha efectiva y alcance.</li><li>Crear una decisión pendiente por tipo y registrar la decisión legal. Revocar cuando corresponda; no editar evidencia aprobada.</li><li>Crear versiones nuevas e independientes del consentimiento es-PR y en-US con el texto exacto aprobado.</li><li>Verificar el SHA-256 mostrado contra el texto aprobado y registrar la referencia de aprobación y vigencia.</li><li>Para reemplazar texto, retirar la versión anterior y crear otra; nunca editar una versión aprobada.</li><li>Confirmar que esta pantalla muestre la clasificación vigente y ambos locales aprobados. La bandera pública sigue siendo una autorización separada.</li></ol></section>

    <section className="surface-card p-5"><h2 className="text-lg font-semibold">Monitoreo agregado</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">{Object.entries(monitoring).map(([label, value]) => <div className="rounded-lg border p-3" key={label}><dt className="font-semibold">{label.replaceAll("_", " ")}</dt><dd className="mt-1 text-2xl">{value}</dd></div>)}</dl></section>

    <section className="surface-card p-5"><h2 className="text-lg font-semibold">Procedimientos de soporte</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{SUPPORT.map(([title, procedure]) => <article className="rounded-lg border p-4" key={title}><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm text-[#555]">{procedure}</p></article>)}</div></section>
  </AdminPageShell>;
}
