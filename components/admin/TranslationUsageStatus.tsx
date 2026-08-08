import { TRANSLATION_USAGE_LIMITS } from "@/lib/i18n/translations/usage-budget";
import type { TranslationUsageStatus } from "@/lib/i18n/translations/usage-budget";

function UsageMetric({ label, used, cap }: { label: string; used: number; cap: number }) {
  const percent = Math.min(100, Math.round((used / cap) * 100));
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <p className="text-sm font-medium text-[#4d4d4d]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-black">
        {used.toLocaleString("es-PR")} / {cap.toLocaleString("es-PR")}
      </p>
      <p className={percent >= 80 ? "mt-1 text-sm font-semibold text-amber-700" : "mt-1 text-sm text-[#666]"}>
        {percent}% utilizado
      </p>
    </div>
  );
}

export default function TranslationUsageStatusPanel({
  status,
  workerEnabled,
  provider,
}: {
  status: TranslationUsageStatus | null;
  workerEnabled: boolean;
  provider: string | null;
}) {
  if (!status) {
    return (
      <section className="surface-card p-6" aria-labelledby="translation-usage-title">
        <h2 id="translation-usage-title" className="text-xl font-semibold text-black">
          Uso de traducciones automáticas
        </h2>
        <p className="mt-3 text-sm text-amber-800">
          La contabilidad de uso todavía no está disponible. El procesamiento automático permanece bloqueado.
        </p>
      </section>
    );
  }
  const atLimit =
    status.charactersToday >= TRANSLATION_USAGE_LIMITS.dailyCharacters ||
    status.charactersMonth >= TRANSLATION_USAGE_LIMITS.monthlyCharacters ||
    status.attemptsToday >= TRANSLATION_USAGE_LIMITS.dailyAttempts ||
    status.attemptsMonth >= TRANSLATION_USAGE_LIMITS.monthlyAttempts;
  const warning =
    status.charactersToday >= TRANSLATION_USAGE_LIMITS.dailyCharacters * 0.8 ||
    status.charactersMonth >= TRANSLATION_USAGE_LIMITS.monthlyCharacters * 0.8 ||
    status.attemptsToday >= TRANSLATION_USAGE_LIMITS.dailyAttempts * 0.8 ||
    status.attemptsMonth >= TRANSLATION_USAGE_LIMITS.monthlyAttempts * 0.8;

  return (
    <section className="surface-card p-6" aria-labelledby="translation-usage-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d4af37]">Operación segura</p>
          <h2 id="translation-usage-title" className="mt-2 text-xl font-semibold text-black">
            Uso de traducciones automáticas
          </h2>
        </div>
        <div className="text-right text-sm text-[#4d4d4d]">
          <p>Worker: <strong>{workerEnabled ? "Habilitado" : "Deshabilitado"}</strong></p>
          <p>Proveedor: <strong>{provider ?? "No configurado"}</strong></p>
        </div>
      </div>
      {atLimit ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 font-semibold text-red-800" role="alert">
          Traducciones automáticas pausadas por límite de uso.
        </p>
      ) : warning ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 font-semibold text-amber-800" role="status">
          El uso de traducciones alcanzó al menos 80% de un límite.
        </p>
      ) : null}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UsageMetric label="Caracteres hoy (UTC)" used={status.charactersToday} cap={TRANSLATION_USAGE_LIMITS.dailyCharacters} />
        <UsageMetric label="Caracteres este mes (UTC)" used={status.charactersMonth} cap={TRANSLATION_USAGE_LIMITS.monthlyCharacters} />
        <UsageMetric label="Intentos hoy (UTC)" used={status.attemptsToday} cap={TRANSLATION_USAGE_LIMITS.dailyAttempts} />
        <UsageMetric label="Intentos este mes (UTC)" used={status.attemptsMonth} cap={TRANSLATION_USAGE_LIMITS.monthlyAttempts} />
      </div>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-4">
        <div><dt className="text-[#666]">En cola</dt><dd className="font-semibold">{status.queuedJobs}</dd></div>
        <div><dt className="text-[#666]">Procesando</dt><dd className="font-semibold">{status.processingJobs}</dd></div>
        <div><dt className="text-[#666]">Fallidos</dt><dd className="font-semibold">{status.failedJobs}</dd></div>
        <div><dt className="text-[#666]">Pausados por límite</dt><dd className="font-semibold">{status.pausedByBudgetJobs}</dd></div>
      </dl>
    </section>
  );
}
