const STEPS=["Documento","Destinatarios","Campos","Revisar","Enviar"] as const;

export default function SignatureStepProgress({current}:{current:number}) {
  return <nav aria-label="Progreso de preparación" className="surface-card p-4">
    <p className="mb-3 text-sm font-semibold text-slate-700 md:hidden">Paso {current} de {STEPS.length}: {STEPS[current-1]}</p>
    <ol className="grid grid-cols-5 gap-1" data-testid="signature-step-progress">{STEPS.map((step,index)=>{
      const number=index+1; const active=number===current; const complete=number<current;
      return <li className="min-w-0 text-center" key={step}><div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${active?"bg-[#0d1b2a] text-white":complete?"bg-green-700 text-white":"bg-slate-200 text-slate-600"}`}>{number}</div><span className={`mt-2 hidden truncate text-xs font-semibold md:block ${active?"text-[#0d1b2a]":"text-slate-500"}`}>{step}</span></li>;
    })}</ol>
  </nav>;
}
