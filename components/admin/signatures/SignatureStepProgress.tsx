const STEPS = [
  "Documento",
  "Destinatarios",
  "Campos",
  "Revisar",
  "Enviar",
] as const;

export default function SignatureStepProgress({
  current,
}: {
  current: number;
}) {
  return (
    <nav
      aria-label="Progreso de preparación"
      className="signature-workflow-progress"
    >
      <div className="flex items-center justify-between gap-3 md:hidden">
        <p className="text-sm font-semibold text-slate-800">
          Paso {current} de {STEPS.length}: {STEPS[current - 1]}
        </p>
        <span className="text-xs text-slate-500">
          {Math.round((current / STEPS.length) * 100)}%
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 md:hidden">
        <div
          className="h-full rounded-full bg-[#11518b]"
          style={{ width: `${(current / STEPS.length) * 100}%` }}
        />
      </div>
      <ol
        className="hidden grid-cols-5 md:grid"
        data-testid="signature-step-progress"
      >
        {STEPS.map((step, index) => {
          const number = index + 1;
          const active = number === current;
          const complete = number < current;
          return (
            <li
              className={`signature-workflow-step ${active ? "is-active" : ""} ${complete ? "is-complete" : ""}`}
              key={step}
            >
              <span className="signature-workflow-step-number">
                {complete ? "✓" : number}
              </span>
              <span className="truncate text-xs font-semibold">{step}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
