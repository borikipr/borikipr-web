"use client";

import { useActionState } from "react";
import { initialTeamActionState, setAssignedSigningBrokerAction } from "./actions";

type BrokerOption = Readonly<{ id: string; displayName: string; licenseNumber: string }>;

export default function AssignedSigningBroker({ targetId, assignedBrokerUserId, assignedBrokerName, brokers }: {
  targetId: string;
  assignedBrokerUserId: string | null;
  assignedBrokerName: string | null;
  brokers: readonly BrokerOption[];
}) {
  const [state, action, pending] = useActionState(setAssignedSigningBrokerAction, initialTeamActionState);
  return <section className="surface-card p-5 md:p-6" aria-labelledby="assigned-broker-heading">
    <p className="eyebrow">Firmas</p>
    <h2 id="assigned-broker-heading" className="mt-2 text-lg font-bold text-slate-950">Corredor asignado</h2>
    <p className="mt-1 text-sm text-slate-600">Se usará automáticamente cuando esta cuenta prepare un documento que requiera firma de corredor(a).</p>
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <input type="hidden" name="targetId" value={targetId} />
      <label className="block text-sm font-semibold text-slate-800">
        Corredor(a) autorizado
        <select className="mt-2 w-full rounded-xl border border-[#d9d9d9] bg-white px-4 py-3 font-normal" name="brokerAdminId" defaultValue={assignedBrokerUserId ?? ""}>
          <option value="">Sin asignar</option>
          {brokers.map((broker) => <option key={broker.id} value={broker.id}>{broker.displayName} · Lic. {broker.licenseNumber}</option>)}
        </select>
      </label>
      <button type="submit" className="btn-secondary" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>
    </form>
    {assignedBrokerName ? <p className="mt-3 text-sm text-slate-600">Actual: <strong className="text-slate-900">{assignedBrokerName}</strong></p> : null}
    {state.error ? <p className="mt-3 text-sm text-red-700" role="alert">{state.error}</p> : null}
    {state.success ? <p className="mt-3 text-sm text-emerald-700" role="status">{state.success}</p> : null}
  </section>;
}
