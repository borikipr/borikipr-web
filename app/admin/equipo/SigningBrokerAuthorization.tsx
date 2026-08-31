"use client";

import { useActionState } from "react";
import { setSigningBrokerAuthorizationAction } from "./actions";
import { initialTeamActionState } from "./action-state";

export default function SigningBrokerAuthorization({ targetId, authorized, eligible }: { targetId: string; authorized: boolean; eligible: boolean }) {
  const [state, action, pending] = useActionState(setSigningBrokerAuthorizationAction, initialTeamActionState);
  return <section className="surface-card p-5 md:p-6" aria-labelledby="broker-auth-heading">
    <p className="eyebrow">Firmas</p><h2 id="broker-auth-heading" className="mt-2 text-lg font-bold text-slate-950">Autorización para firmar como corredor</h2>
    <p className="mt-1 text-sm text-slate-600">{authorized ? "Autorizado para ser firmante final en documentos futuros." : eligible ? "Esta cuenta cumple los requisitos profesionales, pero todavía no está autorizada." : "Requiere una cuenta activa, rol profesional de corredor(a) y número de licencia."}</p>
    <form action={action} className="mt-4"><input type="hidden" name="targetId" value={targetId} /><input type="hidden" name="authorized" value={authorized ? "false" : "true"} /><button type="submit" className={authorized ? "btn-secondary" : "btn-primary"} disabled={pending || (!eligible && !authorized)}>{pending ? "Guardando…" : authorized ? "Revocar autorización" : "Autorizar corredor(a)"}</button></form>
    {state.error ? <p className="mt-3 text-sm text-red-700" role="alert">{state.error}</p> : null}{state.success ? <p className="mt-3 text-sm text-emerald-700" role="status">{state.success}</p> : null}
  </section>;
}
