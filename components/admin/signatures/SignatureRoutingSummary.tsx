import { buildSignatureRoutingStages, signatureRoutingModeLabel, type SignatureRoutingParticipant } from "@/lib/signatures/routing-ux";

export default function SignatureRoutingSummary({
  mode,
  participants,
  compact = false,
}: {
  mode: "parallel" | "sequential" | "grouped";
  participants: readonly SignatureRoutingParticipant[];
  compact?: boolean;
}) {
  const stages = buildSignatureRoutingStages(participants, mode);
  return (
    <section aria-labelledby="signature-routing-heading" className={compact ? "rounded-xl border border-slate-200 bg-slate-50 p-4" : "surface-card p-5"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="signature-routing-heading" className="font-semibold">Ruta de firmas</h3>
        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-800">
          {signatureRoutingModeLabel(mode)}
        </span>
      </div>
      {!stages.length ? <p className="mt-3 text-sm text-slate-600">Añade destinatarios para definir la ruta.</p> : (
        <ol className="mt-4 grid gap-3" aria-label={`${stages.length} etapas de firma`}>
          {stages.map((stage, index) => (
            <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3" key={stage.order}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0d1b2a] text-sm font-bold text-white" aria-hidden="true">{index + 1}</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Etapa {index + 1}</p>
                <ul className="mt-1 space-y-1">
                  {stage.participants.map((participant) => (
                    <li className="text-sm text-slate-800" key={participant.id}>
                      <span className="font-semibold">{participant.name}</span>
                      <span className="text-slate-600"> · {participant.role}</span>
                      {participant.isBrokerFinalSigner ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">Firma final</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
