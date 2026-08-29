"use client";

import { useActionState } from "react";
import type { AccessLevel, ModuleKey } from "@/lib/admin/access-types";
import { initialTeamActionState, setMemberModuleAccessAction } from "./actions";

const MODULES: Array<{ key: ModuleKey; label: string }> = [
  { key: "properties", label: "Propiedades" }, { key: "leads", label: "Leads" }, { key: "signatures", label: "Firmas" }, { key: "testimonials", label: "Testimonios" }, { key: "analytics", label: "Analytics" },
];

export default function ModuleAccessControls({ targetId, access }: { targetId: string; access: ReadonlyMap<ModuleKey, AccessLevel> }) {
  const [state, action, pending] = useActionState(setMemberModuleAccessAction, initialTeamActionState);
  return <section className="surface-card p-5 md:p-6" aria-labelledby="module-access-heading">
    <p className="eyebrow">Acceso del sistema</p><h2 id="module-access-heading" className="mt-2 text-lg font-bold text-slate-950">Acceso a módulos</h2>
    <p className="mt-1 text-sm leading-6 text-slate-600">Cada acceso se aplica de forma explícita. “Administrar” también permite ver.</p>
    <div className="mt-5 grid divide-y divide-slate-100 border-y border-slate-100">
      {MODULES.map((module) => <form key={module.key} action={action} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-center">
        <input type="hidden" name="targetId" value={targetId} /><input type="hidden" name="moduleKey" value={module.key} />
        <label htmlFor={`access-${module.key}`} className="font-semibold text-slate-900">{module.label}<span className="mt-1 block text-sm font-normal text-slate-500">{access.get(module.key) ? "Acceso asignado" : "Sin acceso asignado"}</span></label>
        <select id={`access-${module.key}`} name="accessLevel" defaultValue={access.get(module.key) ?? ""} className="input-premium" disabled={pending} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
          <option value="">Sin acceso</option><option value="view">Ver</option><option value="manage">Administrar</option>
        </select>
      </form>)}
    </div>
    {state.error ? <p className="mt-3 text-sm text-red-700" role="alert">{state.error}</p> : null}
    {state.success ? <p className="mt-3 text-sm text-emerald-700" role="status">{state.success}</p> : null}
  </section>;
}
