"use client";

import { useMemo, useState } from "react";

type NavigableField = Readonly<{
  id: string;
  label: string;
  field_type: string;
  page_index: number;
  required: boolean;
  completed: boolean;
}>;

export default function SignerRequiredFieldNavigator({
  fields,
}: {
  fields: readonly NavigableField[];
}) {
  const actionable = useMemo(
    () =>
      fields.filter(
        (field) => field.required && !["date_signed", "signer_name"].includes(field.field_type),
      ),
    [fields],
  );
  const pending = useMemo(
    () => actionable.filter((field) => !field.completed),
    [actionable],
  );
  const [cursor, setCursor] = useState(0);
  const completed = actionable.length - pending.length;

  function nextRequiredField() {
    if (!pending.length) return;
    const field = pending[cursor % pending.length];
    setCursor((value) => value + 1);
    window.dispatchEvent(
      new CustomEvent("boriki:signer-page", {
        detail: { pageIndex: field.page_index },
      }),
    );
    window.setTimeout(() => {
      const container = document.getElementById(`signer-field-${field.id}`);
      container?.scrollIntoView({ behavior: "smooth", block: "center" });
      (
        container?.querySelector("input,button,canvas") as HTMLElement | null
      )?.focus({ preventScroll: true });
    }, 80);
  }

  return (
    <nav
      className="signer-required-navigator"
      aria-label="Progreso de campos requeridos"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">
            {completed} de {actionable.length} campos completados
          </p>
          <span className="text-xs text-slate-500">
            {actionable.length
              ? Math.round((completed / actionable.length) * 100)
              : 100}
            %
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-[#11518b] transition-all"
            style={{
              width: `${actionable.length ? (completed / actionable.length) * 100 : 100}%`,
            }}
          />
        </div>
      </div>
      <button
        className="min-h-11 rounded-lg bg-[#0d1b2a] px-4 py-2 text-sm font-semibold text-white disabled:bg-emerald-700"
        disabled={!pending.length}
        onClick={nextRequiredField}
        type="button"
      >
        {pending.length ? "Próximo campo" : "Listo para finalizar"}
      </button>
    </nav>
  );
}
