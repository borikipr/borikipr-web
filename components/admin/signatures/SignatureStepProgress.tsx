const STEPS=["Documento","Destinatarios","Campos","Revisar","Enviar"] as const;

export default function SignatureStepProgress({current}:{current:number}) {
  return <nav aria-label="Progreso de preparación" className="surface-card px-4 py-3 md:px-5">
    <div className="flex items-center justify-between gap-3 md:hidden"><p className="text-sm font-semibold text-slate-800">Paso {current} de {STEPS.length}: {STEPS[current-1]}</p><span className="text-xs text-slate-500">{Math.round((current/STEPS.length)*100)}%</span></div>
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 md:hidden"><div className="h-full rounded-full bg-[#11518b]" style={{width:`${(current/STEPS.length)*100}%`}} /></div>
    <ol className="hidden grid-cols-5 gap-1 md:grid" data-testid="signature-step-progress">{STEPS.map((step,index)=>{
      const number=index+1; const active=number===current; const complete=number<current;
      return <li className="relative min-w-0 text-center" key={step}><div className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${active?"bg-[#0d1b2a] text-white":complete?"bg-emerald-700 text-white":"bg-slate-200 text-slate-600"}`}>{number}</div><span className={`mt-1.5 block truncate text-xs font-semibold ${active?"text-[#0d1b2a]":"text-slate-500"}`}>{step}</span></li>;
    })}</ol>
  </nav>;
}
