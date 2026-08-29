import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import StatusBadge from "@/components/admin/StatusBadge";
import { getAdminSession } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { getSignatureGovernanceReadiness } from "@/lib/signatures/governance-readiness";
import { inspectProductionPublicLaunchGate } from "@/lib/signatures/public-launch";

export const dynamic = "force-dynamic";

const BLOCKER_LABELS: Record<string, string> = {
  document_classification_approval_missing: "La configuración de documentos requiere revisión.",
  approved_consent_es_pr_missing: "El consentimiento en español requiere atención.",
  approved_consent_en_us_missing: "El consentimiento en inglés requiere atención.",
  approved_privacy_es_pr_missing: "La información de privacidad requiere atención.",
  approved_privacy_en_us_missing: "La información de privacidad en inglés requiere atención.",
  retention_policy_missing: "La política de conservación requiere atención.",
  event_keys_unavailable: "La integridad del servicio requiere revisión.",
  neon_restore_unproven: "La recuperación de Neon requiere atención.",
  r2_independent_recovery_unproven: "La recuperación de R2 requiere atención.",
  public_launch_authorization_missing: "La activación pública requiere revisión.",
  public_readiness_hash_missing: "La validación del servicio requiere revisión.",
  public_signing_disabled: "La firma pública no está disponible.",
};

function uniqueMessages(messages: readonly string[]) {
  return [...new Set(messages)];
}

export default async function SignatureGovernancePage() {
  if (!(await getAdminSession())) redirect("/admin/login");

  const database = createPostgresSignatureDatabase(sql);
  const [readiness, publicLaunchGate] = await Promise.all([
    getSignatureGovernanceReadiness(database),
    inspectProductionPublicLaunchGate(database),
  ]);

  const languagesReady = readiness.consentSlots.every((slot) => slot.approved)
    && readiness.privacySlots.every((slot) => slot.approved);
  const neonRecoveryReady = !publicLaunchGate.blockers.includes("neon_restore_unproven");
  const r2RecoveryReady = !publicLaunchGate.blockers.includes("r2_independent_recovery_unproven");
  const recoveryReady = neonRecoveryReady && r2RecoveryReady;
  const healthy = publicLaunchGate.allowed && languagesReady && recoveryReady;
  const blockers = uniqueMessages(publicLaunchGate.blockers.map((blocker) => BLOCKER_LABELS[blocker] ?? "Firmas requiere una revisión del equipo autorizado."));
  const recoveryBlockers = uniqueMessages(publicLaunchGate.blockers
    .filter((blocker) => blocker === "neon_restore_unproven" || blocker === "r2_independent_recovery_unproven")
    .map((blocker) => BLOCKER_LABELS[blocker] ?? "La recuperación requiere atención."));
  const operationalBlockers = blockers.filter((blocker) => !recoveryBlockers.includes(blocker));

  return <AdminPageShell>
    <AdminPageHeader
      breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/signatures", label: "Firmas" }, { label: "Estado y soporte" }]}
      eyebrow="Firmas"
      title="Estado y soporte"
      description="Estado operativo y ayuda cuando Firmas requiera atención."
      actions={<Link className="btn-secondary" href="/admin/signatures">Volver a Firmas</Link>}
    />

    <section className="surface-card overflow-hidden" aria-labelledby="estado-firmas">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="estado-firmas" className="text-lg font-semibold text-slate-950">{healthy ? "Firmas operando normalmente" : "Firmas requiere atención"}</h2>
          <p className="mt-1 text-sm text-slate-600">{healthy ? "La firma pública está disponible y los idiomas de firma están listos." : "Revise los elementos pendientes antes de continuar con documentos nuevos."}</p>
        </div>
        <StatusBadge variant={healthy ? "green" : "red"}>{healthy ? "Operativo" : "Revisión necesaria"}</StatusBadge>
      </div>

      <dl className="grid border-t border-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-slate-100">
        <div className="p-4">
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Firma pública</dt>
          <dd className="mt-2 font-semibold text-slate-950">{publicLaunchGate.allowed ? "Activa" : "Requiere atención"}</dd>
        </div>
        <div className="border-t border-slate-100 p-4 sm:border-t-0">
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Idiomas</dt>
          <dd className="mt-2 font-semibold text-slate-950">{languagesReady ? "Español e inglés listos" : "Revisión necesaria"}</dd>
        </div>
      </dl>

      {!healthy && operationalBlockers.length > 0 && <div className="border-t border-red-100 bg-red-50 px-5 py-4" role="alert">
        <p className="font-semibold text-red-950">Acción requerida</p>
        <ul className="mt-2 space-y-1 text-sm text-red-900">
          {operationalBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
        </ul>
      </div>}
    </section>

    <section className="surface-card overflow-hidden" aria-labelledby="recuperacion">
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="recuperacion" className="text-lg font-semibold text-slate-950">Recuperación</h2>
          <p className="mt-1 text-sm text-slate-600">{recoveryReady ? "Lista para incidentes excepcionales de infraestructura." : "La recuperación de archivos requiere atención."}</p>
        </div>
        <StatusBadge variant={recoveryReady ? "green" : "red"}>{recoveryReady ? "Lista" : "Revisión necesaria"}</StatusBadge>
      </div>
      <dl className="grid border-t border-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-slate-100">
        <div className="p-4"><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Neon</dt><dd className="mt-2 font-semibold text-slate-950">{neonRecoveryReady ? "Listo" : "Requiere atención"}</dd></div>
        <div className="border-t border-slate-100 p-4 sm:border-t-0"><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">R2</dt><dd className="mt-2 font-semibold text-slate-950">{r2RecoveryReady ? "Listo" : "Requiere atención"}</dd></div>
      </dl>
      {!recoveryReady && <div className="border-t border-red-100 bg-red-50 px-5 py-4" role="alert"><p className="font-semibold text-red-950">Recuperación requiere atención</p><ul className="mt-2 space-y-1 text-sm text-red-900">{recoveryBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div>}
      <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-600">La recuperación se usa ante incidentes de infraestructura; no es una papelera para documentos eliminados.</p>
    </section>
  </AdminPageShell>;
}
