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
  event_keys_unavailable: "La configuración histórica de claves de evidencia no está completa.",
  public_signing_disabled: "La firma pública permanece desactivada.",
};

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

    <section className="surface-card p-5"><h2 className="text-lg font-semibold">Monitoreo agregado</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">{Object.entries(monitoring).map(([label, value]) => <div className="rounded-lg border p-3" key={label}><dt className="font-semibold">{label.replaceAll("_", " ")}</dt><dd className="mt-1 text-2xl">{value}</dd></div>)}</dl></section>

    <section className="surface-card p-5"><h2 className="text-lg font-semibold">Procedimientos de soporte</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{SUPPORT.map(([title, procedure]) => <article className="rounded-lg border p-4" key={title}><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm text-[#555]">{procedure}</p></article>)}</div></section>
  </AdminPageShell>;
}
