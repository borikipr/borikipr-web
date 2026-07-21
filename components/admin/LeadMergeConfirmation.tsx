"use client";

import { useState } from "react";
import { mergeLeadsAction } from "@/app/admin/leads/[id]/actions";

type MergeCandidate = {
  id: string;
  name: string;
};

export function LeadMergeConfirmation({
  left,
  right,
  operationKey,
}: {
  left: MergeCandidate;
  right: MergeCandidate;
  operationKey: string;
}) {
  const [primaryLeadId, setPrimaryLeadId] = useState(left.id);
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const secondaryLeadId = primaryLeadId === left.id ? right.id : left.id;
  const canSubmit = acknowledged && confirmation === "FUSIONAR";

  return (
    <form action={mergeLeadsAction} className="grid min-w-0 gap-5">
      <input name="left_lead_id" type="hidden" value={left.id} />
      <input name="right_lead_id" type="hidden" value={right.id} />
      <input name="secondary_lead_id" type="hidden" value={secondaryLeadId} />
      <input name="operation_key" type="hidden" value={operationKey} />

      <fieldset className="min-w-0">
        <legend className="text-sm font-semibold text-[#1f2937]">
          Selecciona la identidad principal que permanecerá activa
        </legend>
        <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
          {[left, right].map((candidate) => (
            <label
              className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-2xl border p-4 ${
                primaryLeadId === candidate.id
                  ? "border-[#11518b] bg-[#11518b]/5"
                  : "border-[#d9d9d9] bg-white"
              }`}
              key={candidate.id}
            >
              <input
                checked={primaryLeadId === candidate.id}
                className="mt-1 h-4 w-4 shrink-0"
                name="primary_lead_id"
                onChange={() => setPrimaryLeadId(candidate.id)}
                type="radio"
                value={candidate.id}
              />
              <span className="min-w-0 break-words text-sm font-semibold">{candidate.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex min-w-0 items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <input
          checked={acknowledged}
          className="mt-1 h-4 w-4 shrink-0"
          name="review_acknowledged"
          onChange={(event) => setAcknowledged(event.target.checked)}
          required
          type="checkbox"
        />
        <span>
          Revisé ambas identidades y entiendo que el registro secundario quedará archivado como fusionado. Ningún registro se eliminará físicamente.
        </span>
      </label>

      <div className="min-w-0">
        <label className="text-sm font-semibold" htmlFor="merge-confirmation">
          Escribe <span className="font-bold">FUSIONAR</span> para confirmar
        </label>
        <input
          autoComplete="off"
          className="input-field mt-2 w-full"
          id="merge-confirmation"
          name="confirmation"
          onChange={(event) => setConfirmation(event.target.value)}
          pattern="FUSIONAR"
          required
          value={confirmation}
        />
      </div>

      <button
        className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canSubmit}
        type="submit"
      >
        Fusionar de forma segura
      </button>
    </form>
  );
}
