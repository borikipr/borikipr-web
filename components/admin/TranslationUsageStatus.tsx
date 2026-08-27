import { Activity, ChevronDown, Languages, TriangleAlert } from "lucide-react";
import { TRANSLATION_USAGE_LIMITS } from "@/lib/i18n/translations/usage-budget";
import type { TranslationUsageStatus } from "@/lib/i18n/translations/usage-budget";

function UsageMetric({ label, used, cap }: { label: string; used: number; cap: number }) {
  const percent = Math.min(100, Math.round((used / cap) * 100));
  return (
    <div className="dashboard-translation-metric">
      <div className="flex items-end justify-between gap-3">
        <p className="text-xs font-medium text-slate-600">{label}</p>
        <p className="text-xs font-semibold tabular-nums text-slate-800">{percent}%</p>
      </div>
      <progress aria-label={`${label}: ${percent}% utilizado`} className="dashboard-usage-progress" max={cap} value={used} />
      <p className="mt-1 text-xs tabular-nums text-slate-500">{used.toLocaleString("es-PR")} / {cap.toLocaleString("es-PR")}</p>
    </div>
  );
}

export default function TranslationUsageStatusPanel({ status, workerEnabled, provider }: { status: TranslationUsageStatus | null; workerEnabled: boolean; provider: string | null }) {
  if (!status) {
    return (
      <section className="dashboard-translation-panel surface-card" aria-labelledby="translation-usage-title">
        <div className="flex items-start gap-3">
          <span className="dashboard-translation-icon is-warning" aria-hidden="true"><TriangleAlert size={19} /></span>
          <div><h2 id="translation-usage-title" className="font-semibold text-slate-950">Traducción automática</h2><p className="mt-1 text-sm leading-relaxed text-amber-800">La contabilidad de uso todavía no está disponible. El procesamiento automático permanece bloqueado.</p></div>
        </div>
      </section>
    );
  }

  const atLimit = status.charactersToday >= TRANSLATION_USAGE_LIMITS.dailyCharacters || status.charactersMonth >= TRANSLATION_USAGE_LIMITS.monthlyCharacters || status.attemptsToday >= TRANSLATION_USAGE_LIMITS.dailyAttempts || status.attemptsMonth >= TRANSLATION_USAGE_LIMITS.monthlyAttempts;
  const warning = status.charactersToday >= TRANSLATION_USAGE_LIMITS.dailyCharacters * 0.8 || status.charactersMonth >= TRANSLATION_USAGE_LIMITS.monthlyCharacters * 0.8 || status.attemptsToday >= TRANSLATION_USAGE_LIMITS.dailyAttempts * 0.8 || status.attemptsMonth >= TRANSLATION_USAGE_LIMITS.monthlyAttempts * 0.8;
  const failedOrPaused = status.failedJobs + status.pausedByBudgetJobs;
  const healthy = workerEnabled && !atLimit && failedOrPaused === 0;

  return (
    <section className="dashboard-translation-panel surface-card" aria-labelledby="translation-usage-title">
      <div className="flex items-start gap-3">
        <span className={`dashboard-translation-icon ${healthy ? "is-healthy" : "is-warning"}`} aria-hidden="true"><Languages size={19} /></span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Operación automática</p>
          <h2 id="translation-usage-title" className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-950">Traducciones</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-600"><span className={`dashboard-health-dot ${healthy ? "is-healthy" : "is-warning"}`} aria-hidden="true" />{healthy ? "Servicio operativo" : atLimit ? "Límite de uso alcanzado" : "Revisión recomendada"}</p>
        </div>
      </div>

      {atLimit ? <p className="dashboard-translation-alert is-error" role="alert">Traducciones automáticas pausadas por límite de uso.</p> : warning ? <p className="dashboard-translation-alert is-warning" role="status">El uso de traducciones alcanzó al menos 80% de un límite.</p> : null}

      <div className="mt-5 grid gap-4">
        <UsageMetric label="Caracteres este mes (UTC)" used={status.charactersMonth} cap={TRANSLATION_USAGE_LIMITS.monthlyCharacters} />
        <UsageMetric label="Intentos este mes (UTC)" used={status.attemptsMonth} cap={TRANSLATION_USAGE_LIMITS.monthlyAttempts} />
      </div>

      <details className="dashboard-translation-details group">
        <summary><span className="flex items-center gap-2"><Activity size={15} aria-hidden="true" /> Ver detalle operativo</span><ChevronDown className="transition group-open:rotate-180" size={16} aria-hidden="true" /></summary>
        <div className="space-y-4 border-t border-slate-200 px-4 py-4">
          <UsageMetric label="Caracteres hoy (UTC)" used={status.charactersToday} cap={TRANSLATION_USAGE_LIMITS.dailyCharacters} />
          <UsageMetric label="Intentos hoy (UTC)" used={status.attemptsToday} cap={TRANSLATION_USAGE_LIMITS.dailyAttempts} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <div><dt className="text-slate-500">En cola</dt><dd className="mt-0.5 font-semibold text-slate-900">{status.queuedJobs}</dd></div>
            <div><dt className="text-slate-500">Procesando</dt><dd className="mt-0.5 font-semibold text-slate-900">{status.processingJobs}</dd></div>
            <div><dt className="text-slate-500">Fallidos</dt><dd className="mt-0.5 font-semibold text-slate-900">{status.failedJobs}</dd></div>
            <div><dt className="text-slate-500">Pausados por límite</dt><dd className="mt-0.5 font-semibold text-slate-900">{status.pausedByBudgetJobs}</dd></div>
          </dl>
          <div className="border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-500">
            <p>Worker: <strong className="font-semibold text-slate-700">{workerEnabled ? "Habilitado" : "Deshabilitado"}</strong></p>
            <p className="break-words">Proveedor: <strong className="font-semibold text-slate-700">{provider ?? "No configurado"}</strong></p>
          </div>
        </div>
      </details>
    </section>
  );
}
